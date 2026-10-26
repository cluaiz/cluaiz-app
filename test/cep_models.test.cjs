const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require(require.resolve('typescript',{paths:[path.join(__dirname,'../app')]}));

// Only the existing authenticated client boundary is injected; adapters below are real code.
function load(file,imports){
    const exports={};
    const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code,{exports,AbortController,Error,console,require:name=>{
        if(!(name in imports))throw Error('Unexpected import '+name);return imports[name];
    }});
    return exports;
}
function harness(handler){
    const requests=[];
    const client={post:async(url,body,options)=>{
        requests.push({url,body,options});
        return handler(url,body,options);
    },get:async()=>{throw Error('Unexpected retired GET endpoint');}};
    const errors=load('src/api/client/errors.ts',{});
    const cep=load('src/api/client/cep.ts',{'./client':{client},'./errors':errors});
    const permission=load('src/api/engine/permission/permission.api.ts',{
        '../../client':{client},'../../client/cep':cep,'../../client/errors':errors,
        './permission.endpoints':{PERMISSION_ENDPOINTS:{}},
    });
    const models=load('src/api/engine/models/models.api.ts',{
        '../../client':{client},'../../client/cep':cep,'../../client/errors':errors,
        '../permission/permission.api':permission,'./models.endpoints':{MODELS_ENDPOINTS:{}},
    });
    return {...cep,...permission,...models,errors,requests,client};
}
const result=(request,value)=>({jsonrpc:'2.0',id:request.id,result:value});

test('CEP preserves concurrent response identity and transport options',async()=>{
    const pending=[];
    const h=harness((url,body,options)=>new Promise(resolve=>pending.push({url,body,options,resolve})));
    const controller=new AbortController();
    const first=h.callCep('models.list',{}, {signal:controller.signal});
    const second=h.callCep('config.get',{section:'engine'});
    assert.notEqual(pending[0].body.id,pending[1].body.id);
    assert.equal(pending[0].url,'/v1/cep');
    assert.equal(pending[0].options.signal,controller.signal);
    pending[1].resolve(result(pending[1].body,{engine:{}}));
    pending[0].resolve(result(pending[0].body,[]));
    assert.equal((await first).length,0);assert.ok((await second).engine);
});

test('CEP failures preserve domain code/data and HTTP auth errors are not rewritten',async()=>{
    const data={type:'approval_required',approval_id:'request-bound-id'};
    const h=harness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code:-32003,message:'Approval required',data}}));
    await assert.rejects(h.callCep('config.set',{}),error=>error instanceof h.CepError
        &&error.code===-32003&&error.data===data&&error.status===200&&!error.isOffline());
    const unauthorized=new h.errors.ApiError('Token rejected',401,'Unauthorized');
    const auth=harness(()=>{throw unauthorized;});
    await assert.rejects(auth.modelsApi.getInstalled(),error=>error===unauthorized);
});

test('invalid CEP envelopes fail instead of becoming domain results; null is valid',async()=>{
    for(const response of [body=>null,body=>({jsonrpc:'2.0',id:body.id+1,result:[]}),
        body=>({jsonrpc:'2.0',id:body.id}),body=>({jsonrpc:'2.0',id:body.id,result:[],error:{code:1,message:'bad'}}),
        body=>({jsonrpc:'2.0',id:body.id,error:{code:'bad',message:'bad'}})]){
        const h=harness((url,body)=>response(body));
        await assert.rejects(h.callCep('models.list'),error=>error.statusText==='INVALID_CEP_RESPONSE');
    }
    const h=harness((url,body)=>result(body,null));assert.equal(await h.callCep('test.null'),null);
});

test('installed inventory preserves metadata and normalizes format for all App callers',async()=>{
    const entry={id:'arbitrary-installed-id',category:'chat',format:'gguf',supported_tasks:['text-generation'],
        metadata:{context_window:8192,architecture:'fixture'},files:[{name:'weights',is_primary:true}]};
    const h=harness((url,body)=>result(body,[entry]));
    const list=await h.modelsApi.getInstalled();
    assert.equal(list.count,1);assert.equal(list.installed,list.models);
    assert.equal(list.installed[0].format_type,'gguf');
    assert.equal(list.installed[0].metadata,entry.metadata);
    assert.equal(h.requests[0].body.method,'models.list');
    assert.equal(Object.keys(h.requests[0].body.params).length,0);
    assert.equal((await h.modelsApi.getInstalledModels()).models[0].id,entry.id);
});

test('empty inventory is valid; malformed inventory does not turn into empty success',async()=>{
    const empty=harness((url,body)=>result(body,[]));assert.equal((await empty.modelsApi.getInstalled()).count,0);
    for(const invalid of [{models:[]},null,[{}],[{id:' '}],[{id:'valid',supported_tasks:'wrong'}],
        [{id:'valid',format:3}],[{id:'valid',supported_tasks:[3]}]]){
        const h=harness((url,body)=>result(body,invalid));
        await assert.rejects(h.modelsApi.getInstalled(),error=>error.statusText==='INVALID_MODELS_RESPONSE');
    }
});

test('model selection saves only slots, preserving other slots and server settings',async()=>{
    const engine={lazy_load_model:false,api_auth:{required:true},active_slots:{
        chat_slot:{model_id:'old',format_type:'gguf'},tts_slot:{model_id:'voice'},embed_slot:{model_id:'vector'}
    }};
    const h=harness((url,body)=>{
        if(body.method==='config.get')return result(body,{engine});
        assert.equal(body.method,'config.set');assert.equal(body.params.section,'engine');
        assert.deepEqual(Object.keys(body.params.patch),['active_slots']);
        Object.assign(engine,body.params.patch);return result(body,{engine});
    });
    const saved=await h.modelsApi.selectChatModel({id:'selected',format_type:'gguf',supported_tasks:['text-generation']});
    assert.equal(h.requests.length,2);assert.equal(saved.chat_models.text,'selected');
    assert.equal(saved.active_slots.tts_slot.model_id,'voice');assert.equal(saved.active_slots.embed_slot.model_id,'vector');
    assert.equal(saved.api_auth.required,true);
});

test('selection rejects refused or cleared slots and abort prevents the config write',async()=>{
    const h=harness((url,body)=>result(body,{engine:{active_slots:{chat_slot:{model_id:null}}}}));
    await assert.rejects(h.modelsApi.selectChatModel({id:'removed'}),error=>error.statusText==='MODEL_SELECTION_NOT_SAVED');
    const controller=new AbortController();
    const aborted=harness((url,body)=>{controller.abort();return result(body,{engine:{active_slots:{}}});});
    await assert.rejects(aborted.modelsApi.selectChatModel({id:'selected'},controller.signal),error=>error.name==='AbortError');
    assert.equal(aborted.requests.length,1);
});

test('Explorer inventory consumes the same model adapter without duplicate requests',async()=>{
    const h=harness((url,body)=>result(body,[{id:'installed',format:'onnx',category:'stt'}]));
    const discovery=load('src/features/api/services/catalogDiscovery.ts',{
        '../../../api/client/cep':h,'../../../api/engine/models/models.api':h,
    });
    assert.equal((await discovery.discoverInstalledModels())[0].format_type,'onnx');
    assert.equal(h.requests.length,1);
});

test('models store reports failed inventory and keeps previous inventory instead of false empty success',async()=>{
    let fail=false;
    const h=harness((url,body)=>{if(fail)throw Error('Inventory unavailable');return result(body,[{id:'retained'}]);});
    const store=load('src/api/engine/models/models.store.ts',{
        zustand:require('zustand'),'./models.api':h,'../../client/errors':h.errors,
        '../../../components/ui/toast':{toast:{promise:()=>{throw Error('Unexpected write operation');}}},
    }).useModelsStore;
    await store.getState().load();assert.equal(store.getState().installed[0].id,'retained');
    fail=true;await store.getState().load();assert.equal(store.getState().status,'error');
    assert.equal(store.getState().error,'Inventory unavailable');assert.equal(store.getState().installed[0].id,'retained');
});
