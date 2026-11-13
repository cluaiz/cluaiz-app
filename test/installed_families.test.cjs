const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./cepHarness.cjs');
const api=load('src/api/catalogue/models.ts',{'./public':{}});
const view=load('src/features/extensions/catalogueView.ts',{'../../api/catalogue/models':api},{URL});
const plain=value=>JSON.parse(JSON.stringify(value));
const model=(id,family,repo)=>({id,family,repo,provider:'Maker',logo:'',name:id,variants:[]});

test('installed models are grouped under their catalogue family; unknown ones go last',()=>{
  const models=[model('a','Qwen','q/a'),model('b','Qwen','q/b'),model('c','BGE','g/c')];
  const installed=[{id:'x',huggingface_repo:'q/b'},{id:'y',huggingface_repo:'g/c'},{id:'z',huggingface_repo:'none/z'},{id:'w',huggingface_repo:'q/a'}];
  const groups=plain(view.groupInstalled(installed,models,'Other'));
  assert.deepEqual(groups.map(g=>[g.family,g.entries.map(e=>e.entry.id)]),[['BGE',['y']],['Qwen',['x','w']],['Other',['z']]]);
  assert.equal(view.isModelInstalled(installed,models[0]),true);
  assert.equal(view.isModelInstalled(installed,model('d','Qwen','q/d')),false);
});

test('a family page offers only the types and formats its models have, and filters by them from the URL',()=>{
  let search='?type=tts';
  const params=()=>new URLSearchParams(search);
  const filters=load('src/features/extensions/familyFilter.ts',{'lucide-react':{},'./catalogueView':view,
    './cloudModelView':{KIND_LABELS:{chat:'Chat',embedding:'Embedding',tts:'Speech (TTS)',stt:'Transcription (STT)'}},
    './toolkitNavigation':{toolkitParam:name=>params().get(name)??'',setToolkitParams(){}},'./useToolkitUrl':{useToolkitUrl(){}}});
  const chat={...model('a','F','r/a'),tasks:['image-text-to-text'],variants:[{format:'gguf'}]};
  const voice={...model('b','F','r/b'),tasks:['text-to-speech'],variants:[{format:'onnx'}]};
  assert.deepEqual(plain(filters.modelTypes(chat)),['chat','vision']);
  const filter=filters.useFamilyFilter([chat,voice],[]);
  assert.deepEqual(plain(filter.categories.map(c=>[c.id,c.options.map(o=>o.value)])),
    [['type',['','chat','vision','tts']],['format',['','gguf','onnx']],['show',['','installed']]]);
  assert.deepEqual([chat,voice].filter(filter.matches).map(m=>m.id),['b']);
  search='?format=gguf&show=installed';
  const installedOnly=filters.useFamilyFilter([chat,voice],[{huggingface_repo:'r/a'}]);
  assert.deepEqual([chat,voice].filter(installedOnly.matches).map(m=>m.id),['a']);
  assert.deepEqual(plain(installedOnly.chips.map(c=>c.label)),['GGUF','Installed only']);
});

test('an ONNX package in a repo folder matches the installed file the Engine keeps by name',()=>{
  const variant={id:'q',quant:'Q4F16',format:'onnx',file:'onnx/model_q4f16.onnx'};
  const item={...model('n','Nomic','nomic-ai/nomic-embed-text-v1.5'),variants:[variant]};
  const entry={id:'e',huggingface_repo:item.repo,format_type:'onnx',files:[{name:'model_q4f16.onnx',is_primary:true}]};
  assert.equal(view.installedModelForVariant([entry],item,variant)?.id,'e');
  assert.equal(view.installedModelForVariant([{...entry,files:[{name:'model_int8.onnx',is_primary:true}]}],item,variant),undefined);
});
