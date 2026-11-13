const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./cepHarness.cjs');
const supported=require('../src/api/catalogue/supportedProviders.json');
const plain=value=>JSON.parse(JSON.stringify(value));
const {keepProviders,parseProviders}=load('src/api/catalogue/providers.ts',{
  './supportedProviders.json':supported,'./public':{readPublicCatalogue(){}},
},{URL});

const chat={name:'Chat One',description:'d',tool_call:true,reasoning:true,modalities:{input:['text','image']},
  limit:{context:131072,output:8192},cost:{input:0.5,output:1.5,cache_read:0.1},release_date:'2026-01-01',status:'beta'};

test('only supported providers are kept, with URL, key variable, test status and model facts',()=>{
  const kept=plain(keepProviders({
    groq:{name:'Groq',env:['GROQ_API_KEY'],doc:'https://console.groq.com/docs/models',models:{'chat-1':chat,
      whisper:{name:'Whisper',type:'transcription'},art:{name:'Art',type:'image'}}},
    nvidia:{name:'Nvidia',api:'https://integrate.api.nvidia.com/v1/',models:{m:{name:'M'}}},
    zenmux:{name:'ZenMux',api:'https://zenmux.ai/api/v1',models:{m:{}}},
  }));
  assert.deepEqual(kept.map(p=>[p.id,p.api,p.tested]),[['groq','https://api.groq.com/openai/v1',true],['nvidia','https://integrate.api.nvidia.com/v1',false]]);
  const groq=kept[0];
  assert.deepEqual(groq.env,['GROQ_API_KEY']);
  assert.deepEqual(groq.models.map(m=>[m.id,m.kind]),[['chat-1','chat'],['whisper','stt']]);
  assert.deepEqual(groq.models[0].price,{input:0.5,output:1.5,cacheRead:0.1});
  assert.equal(groq.models[0].context,131072);
  assert.deepEqual(groq.models[0].inputs,['text','image']);
  assert.equal(kept[1].models[0].price,undefined);
});

test('a saved list from before the filter is refused, so it is read again',()=>{
  assert.throws(()=>parseProviders([{id:'zenmux',api:'https://zenmux.ai/api/v1',models:[]}]),/Invalid provider entry/);
  assert.throws(()=>parseProviders(Array.from({length:300},(_,i)=>({id:'p'+i}))),/Invalid provider catalogue/);
  assert.throws(()=>keepProviders([]),/Invalid provider catalogue/);
  assert.equal(keepProviders({deepseek:{name:'DeepSeek',api:'http://insecure.dev',models:{m:{}}}}).length,0);
});

test('the Cloud filters pick models by type, capability and status, and deprecated models sort last',()=>{
  const view=load('src/features/extensions/cloudModelView.ts',{zustand:{create:()=>()=>({})},'lucide-react':{},'../../components/ui/dropdown':{},'./toolkitNavigation':{toolkitParam:()=>'',setToolkitParams(){}},'./useToolkitUrl':{useToolkitUrl(){}}});
  const base={inputs:[],tools:false,reasoning:false,openWeights:false,status:'',released:''};
  const chatTools={...base,id:'a',kind:'chat',tools:true,inputs:['text','image'],released:'2026-01-01'};
  const old={...base,id:'b',kind:'chat',tools:true,status:'deprecated',released:'2026-09-01'};
  const voice={...base,id:'c',kind:'tts',released:'2026-05-01'};
  const all={kind:'',traits:[],hideDeprecated:false};
  assert.deepEqual([voice,old,chatTools].sort(view.compareModels('newest')).map(m=>m.id),['c','a','b']);
  assert.deepEqual([chatTools,old,voice].filter(m=>view.matchesFilter(m,{...all,kind:'tts'})).map(m=>m.id),['c']);
  assert.deepEqual([chatTools,old,voice].filter(m=>view.matchesFilter(m,{...all,traits:['Tools','Vision']})).map(m=>m.id),['a']);
  assert.deepEqual([chatTools,old,voice].filter(m=>view.matchesFilter(m,{...all,hideDeprecated:true})).map(m=>m.id),['a','c']);
  assert.deepEqual(plain(view.capabilities(voice)),['Speech (TTS)']);
  assert.equal(view.tokens(1000000),'1M');
  assert.equal(view.tokens(131072),'131K');
});

test('a provider page offers only the types and capabilities its models have',()=>{
  const view=load('src/features/extensions/cloudModelView.ts',{zustand:{create:()=>()=>({})},'lucide-react':{},'../../components/ui/dropdown':{},'./toolkitNavigation':{toolkitParam:()=>'',setToolkitParams(){}},'./useToolkitUrl':{useToolkitUrl(){}}});
  const base={inputs:[],tools:false,reasoning:false,openWeights:false,status:'',released:''};
  const filter=view.useCloudFilter(undefined,[{...base,id:'a',kind:'chat',tools:true},{...base,id:'b',kind:'stt'}]);
  assert.deepEqual(plain(filter.categories.map(c=>[c.id,c.options.map(o=>o.value)])),[['kind',['','chat','stt']],['traits',['Tools']]]);
});
