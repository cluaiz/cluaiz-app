const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../app/node_modules/typescript');

// Execute the real filtering/store modules; only HTTP, routing and storage are boundaries.
function load(relative, imports, globals = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, { exports, URL, console, ...globals, require: name => {
        if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
        return imports[name];
    } });
    return exports;
}
const filter = load('src/features/api/utils/modelFilter.ts', {});
const models = [
    { id: 'text', category: 'chat', format_type: 'gguf', supported_tasks: ['text-generation'] },
    { id: 'visual', category: 'ingest', format_type: 'gguf', supported_tasks: ['spatial-vision'] },
    { id: 'av', category: 'chat', format_type: 'gguf', supported_tasks: ['multimodal-vision', 'multimodal-audio'] },
    { id: 'speaker', category: 'audio', supported_tasks: ['text-to-speech'] },
    { id: 'preview', category: 'tts', experimental: true },
    { id: 'listener', category: 'audio', supported_tasks: ['automatic-speech-recognition'] },
    { id: 'native-vector', format_type: 'gguf', supported_tasks: ['feature-extraction'] },
    { id: 'onnx-text-vector', format_type: 'onnx', supported_tasks: ['feature-extraction'] },
    { id: 'image-vector', category: 'ingest', format_type: 'onnx', supported_tasks: ['image-feature-extraction'] },
];
const ids = list => Array.from(list, m => m.id);
const bodyFor = parts => JSON.stringify({ messages: [{ role: 'user', content: parts }] });

test('registry tasks select speech and vectors without model-name guesses', () => {
    assert.deepEqual(ids(filter.getFilteredModelsForEndpoint('/v1/audio/speech', models)), ['speaker', 'preview']);
    assert.deepEqual(ids(filter.getFilteredModelsForEndpoint('/v1/audio/transcriptions', models)), ['listener']);
    assert.deepEqual(ids(filter.getFilteredModelsForEndpoint('/v1/embeddings', models)), ['native-vector', 'onnx-text-vector']);
    assert.equal(filter.isTtsModel({id:'kokoro-looking-name', category:'chat'}), false);
});

test('visual/audio chat selects capable models while documents allow text chat', () => {
    const chat = body => ids(filter.getFilteredModelsForEndpoint('/v1/chat/completions', models, body));
    assert.deepEqual(chat(bodyFor([{type:'image_url', image_url:{url:'source'}}])), ['visual', 'av']);
    assert.deepEqual(chat(bodyFor([{type:'video_url', video_url:{url:'source', include_audio:true}}])), ['av']);
    assert.deepEqual(chat(bodyFor([{type:'audio_url', audio_url:{url:'source'}}])), ['av']);
    assert.deepEqual(chat(bodyFor([{type:'file_url', file_url:{url:'source'}}])), ['text', 'visual', 'av']);
    assert.deepEqual(chat('{'), ['text', 'visual', 'av']);
});

test('ingest offers optional models and object embeddings only list ONNX candidates', () => {
    assert.equal(filter.endpointUsesModel({path:'/v1/ingest', params:[{name:'model'}]}), true);
    assert.equal(filter.endpointUsesModel({path:'/v1/chat/memory', method:'GET'}), false);
    assert.deepEqual(ids(filter.getFilteredModelsForEndpoint('/v1/ingest', models)), ['visual', 'av', 'native-vector', 'onnx-text-vector', 'image-vector']);
    assert.deepEqual(ids(filter.getFilteredModelsForEndpoint('/v1/embeddings', models,
        JSON.stringify({input:[{type:'image', source:'source'}]}))), ['image-vector']);
});

function storeHarness() {
    const values = new Map();
    const localStorage = {getItem:key=>values.get(key) ?? null,
        setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key)};
    const { useApiStore } = load('src/store/api/useApiStore.ts', {
        zustand: require('zustand'),
        '../engine/useConnectionStore': {useConnectionStore:{getState:()=>({protocol:'http', getBaseUrl:()=> 'http://127.0.0.1:8000'})}},
        '../../api': {http:{getToken:()=>null}, modelsApi:{}},
        '../../api/engine/audio/audio.endpoints': {AUDIO_ENDPOINTS:{SPEECH:'/v1/audio/speech'}},
        '../../features/api/utils/modelFilter': filter,
        '../../core/router': {pushApiRoute:()=>{}},
    }, {localStorage});
    useApiStore.setState({installedModels: models});
    return {store:useApiStore, values};
}
const ep = (path, body, method='POST') => ({path, method, request_payload:body ? JSON.stringify(body) : ''});

test('endpoint selection and model changes update/persist POST JSON, not unrelated fields', () => {
    const {store, values} = storeHarness();
    store.getState().selectEndpoint(ep('/v1/embeddings', {model:'<installed-model>', input:['Keep this text']}));
    assert.equal(JSON.parse(store.getState().reqBody).model, 'native-vector');
    store.getState().setSelectedModel('image-vector');
    assert.deepEqual(JSON.parse(store.getState().reqBody), {model:'image-vector', input:['Keep this text']});
    assert.equal(values.get('cluaiz_payload_POST_/v1/embeddings'), store.getState().reqBody);
    store.getState().setReqBody('{');
    store.getState().setSelectedModel('native-vector');
    assert.equal(store.getState().reqBody, '{');
});

test('GET discovery sets encoded model query, retains other queries and sends no body', () => {
    const {store} = storeHarness();
    store.getState().selectEndpoint(ep('/v1/audio/languages', null, 'GET'));
    assert.equal(new URL(store.getState().reqUrl).searchParams.get('model'), 'listener');
    store.getState().setReqUrl('http://127.0.0.1:8000/v1/audio/languages?extra=keep');
    store.getState().setSelectedModel('ID / with spaces');
    const url = new URL(store.getState().reqUrl);
    assert.equal(url.searchParams.get('model'), 'ID / with spaces');
    assert.equal(url.searchParams.get('extra'), 'keep');
    assert.equal(store.getState().reqBody, '');
    store.getState().setReqUrl('unfinished');
    assert.doesNotThrow(()=>store.getState().setSelectedModel('listener'));
});

test('opening saved speech keeps its voice; explicit model switch clears package-specific voice', () => {
    const {store} = storeHarness();
    store.getState().selectEndpoint(ep('/v1/audio/speech', {model:'speaker', input:'Keep narration', voice:'preset'}));
    assert.equal(JSON.parse(store.getState().reqBody).voice, 'preset');
    store.getState().setSelectedModel('preview');
    assert.deepEqual(JSON.parse(store.getState().reqBody), {model:'preview', input:'Keep narration'});
    store.getState().selectEndpoint(ep('/v1/ingest', {source:'document'}));
    assert.equal(store.getState().selectedModel, '');
    store.getState().setSelectedModel('');
    assert.deepEqual(JSON.parse(store.getState().reqBody), {source:'document'});
});

test('ingest switching native/vector/vision modes keeps controls consistent', () => {
    const {store} = storeHarness();
    store.getState().selectEndpoint(ep('/v1/ingest', {source:'document'}));
    store.getState().setSelectedModel('native-vector');
    assert.deepEqual(JSON.parse(store.getState().reqBody), {source:'document', model:'native-vector', output_controls:{return_embeddings:true}});
    store.getState().setSelectedModel('visual');
    assert.equal(JSON.parse(store.getState().reqBody).output_controls.return_embeddings, undefined);
    store.getState().setReqBody(JSON.stringify({source:'image',model:'visual',vision_settings:{use_vision:true}}));
    store.getState().setSelectedModel('');
    assert.deepEqual(JSON.parse(store.getState().reqBody), {source:'image'});
});

test('payload examples choose the required model task and can restore native processing', () => {
    const {store} = storeHarness();
    const endpoint = ep('/v1/ingest', {source:'document'});
    endpoint.payload_examples = [
        {id:'image', title:'Image vectors', model_task:'image_embedding', payload:JSON.stringify({source:'image',model:'<image-model>'})},
        {id:'native', title:'Native PDF', payload:JSON.stringify({source:'pdf'})},
        {id:'vision', title:'Vision', model_task:'vision', payload:JSON.stringify({source:'image',model:'<vision-model>'})},
    ];
    store.getState().selectEndpoint(endpoint);
    store.getState().applyPayloadExample('image');
    assert.equal(JSON.parse(store.getState().reqBody).model, 'image-vector');
    store.getState().applyPayloadExample('native');
    assert.deepEqual(JSON.parse(store.getState().reqBody), {source:'pdf'});
    store.getState().applyPayloadExample('vision');
    assert.equal(JSON.parse(store.getState().reqBody).model, 'visual');
    store.getState().setReqBody(JSON.stringify({source:'image',model:'uninstalled-explicit-id'}));
    store.getState().selectEndpoint(endpoint);
    assert.equal(JSON.parse(store.getState().reqBody).model, 'uninstalled-explicit-id');
    store.getState().setReqBody(JSON.stringify({source:'image',model:123}));
    assert.doesNotThrow(()=>store.getState().selectEndpoint(endpoint));
    assert.equal(JSON.parse(store.getState().reqBody).model,123,'Invalid typed models must remain visible to request validation');
    store.setState({installedModels:[]});
    store.getState().applyPayloadExample('image');
    assert.equal(JSON.parse(store.getState().reqBody).model,'<image-model>',
        'An unavailable model example must not silently run native extraction');
});

test('real Explorer components render native model selection and the payload-type menu', () => {
    const React = require('react');
    const {renderToStaticMarkup} = require('react-dom/server');
    const common = {react:React, 'react/jsx-runtime':require('react/jsx-runtime'),
        'lucide-react':require('lucide-react')};
    const {CustomDropdown} = load('src/components/ui/dropdown/CustomDropdown.tsx', {
        ...common, 'react-dom':{createPortal:children=>children}, 'framer-motion':require('framer-motion'),
    }, {document:{body:{}}}); // Portal placement is a browser boundary, not this render assertion.
    const {store} = storeHarness();
    const endpoint = ep('/v1/ingest', {source:'document'});
    endpoint.payload_examples = [{id:'pdf',title:'PDF — native',payload:'{"source":"document.pdf"}'}];
    store.getState().selectEndpoint(endpoint);
    const storeHook = Object.assign(()=>store.getState(),store);
    const dropdown = {'../../../components/ui/dropdown/CustomDropdown':{CustomDropdown}};
    const state = {'../../../store/api/useApiStore':{useApiStore:storeHook,fetchActiveBearerToken:async()=>null}};
    const {RequestHeader} = load('src/features/api/components/RequestHeader.tsx', {
        ...common,...dropdown,...state,'../types':{},
        '../../../store/engine/useConnectionStore':{useConnectionStore:()=>({host:'127.0.0.1',port:8000})},
        '../services/apiTransport':{executeApiRequest:()=>{}},'../utils/modelFilter':filter,
        '../../../api/engine/audio/audio.api':{audioApi:{}},
        '../../../api/engine/audio/audio.endpoints':{AUDIO_ENDPOINTS:{SPEECH:'/v1/audio/speech'}},
    });
    assert.match(renderToStaticMarkup(React.createElement(RequestHeader)),/Native extraction \(no model\)/);
    const {RequestTabs} = load('src/features/api/components/RequestTabs.tsx', {
        ...common,...dropdown,...state,
        '../../../components/ui/MarkdownRenderer':{MarkdownRenderer:()=>null},
        '../../../components/ui/CodeEditor':{CodeEditor:({value})=>React.createElement('textarea',{readOnly:true,value})},
    });
    const body = renderToStaticMarkup(React.createElement(RequestTabs));
    assert.match(body,/Payload example/);
    assert.match(body,/Choose input type/);
});
