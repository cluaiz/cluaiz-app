const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,harness}=require('./cepHarness.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});
const provider=(patch={})=>({name:'mock',base_url:'http://127.0.0.1:8099/v1',key:'in providers.json',type:'openai',
  models:[{id:'mock-chat',model:'mock/mock-chat',context:8192,kind:'chat'}],...patch});
function setup(handler){
  const h=harness((url,body)=>{assert.equal(url,'/v1/cep');return handler(body);});
  return {...h,...load('src/api/engine/providers/providers.api.ts',{'../../client/cep':h,'../../client/errors':h.errors})};
}

test('list and the provider model list are read from the Engine and checked',async()=>{
  const h=setup(body=>body.method==='providers.list'?reply(body,{providers:[provider()]})
    :reply(body,{models:[{id:'mock-chat',model:'mock/mock-chat',context:8192}]}));
  assert.equal((await h.providersApi.list())[0].models[0].model,'mock/mock-chat');
  assert.equal((await h.providersApi.available('mock'))[0].id,'mock-chat');
  await assert.rejects(setup(body=>reply(body,{providers:[provider({base_url:''})]})).providersApi.list(),{statusText:'INVALID_PROVIDER_RESPONSE'});
  await assert.rejects(setup(body=>reply(body,{models:[{id:'x'}]})).providersApi.available('mock'),{statusText:'INVALID_PROVIDER_RESPONSE'});
});

test('save checks name and URL before sending, and the answer must be the same provider',async()=>{
  let sent;
  const h=setup(body=>{sent=plain(body.params);return reply(body,{provider:provider()});});
  await h.providersApi.save({name:'mock',base_url:' http://127.0.0.1:8099/v1 ',api_key:'k',models:{'mock-chat':{context:8192}}});
  assert.deepEqual(sent,{name:'mock',base_url:'http://127.0.0.1:8099/v1',api_key:'k',models:{'mock-chat':{context:8192}}});
  await assert.rejects(h.providersApi.save({name:'bad name',base_url:'http://x'}),{statusText:'INVALID_PROVIDER_INPUT'});
  await assert.rejects(h.providersApi.save({name:'mock',base_url:'ftp://x'}),{statusText:'INVALID_PROVIDER_INPUT'});
  await assert.rejects(setup(body=>reply(body,{provider:provider({name:'other'})})).providersApi.save({name:'mock',base_url:'http://x'}),{statusText:'INVALID_PROVIDER_RESPONSE'});
});

test('remove must name the provider; test returns the real answer',async()=>{
  await setup(body=>reply(body,{removed:'mock'})).providersApi.remove('mock');
  await assert.rejects(setup(body=>reply(body,{removed:'x'})).providersApi.remove('mock'),{statusText:'INVALID_PROVIDER_RESPONSE'});
  const h=setup(body=>{assert.deepEqual(plain(body.params),{name:'mock',model:'mock-chat'});return reply(body,{answer:'ready',model:'mock/mock-chat',ms:3});});
  assert.equal((await h.providersApi.test('mock','mock-chat')).model,'mock/mock-chat');
});

test('a chosen provider model is sent only while it is still listed',async()=>{
  const providers=load('src/api/engine/providers/providers.api.ts',{'../../client/cep':{callCep:async()=>({providers:[provider()]})},'../../client/errors':load('src/api/client/errors.ts',{})});
  const values=new Map();
  const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const store=load('src/store/cloud/useProvidersStore.ts',{zustand:require('zustand'),'zustand/middleware':require('zustand/middleware'),
    '../../api/engine/providers':providers,'../../api/client/errors':load('src/api/client/errors.ts',{}),
    '../../features/extensions/toolkitNavigation':{toolkitParam:()=>'',setToolkitParams(){},onToolkitHistory(){}}},{localStorage,window:{localStorage}});
  store.useProvidersStore.getState().setChatModel('mock/mock-chat');
  assert.equal(store.chatRequestModel('local-model'),'local-model','not listed until providers are read');
  await store.useProvidersStore.getState().refresh();
  assert.equal(store.chatRequestModel('local-model'),'mock/mock-chat');
  assert.equal(store.isProviderModel('mock/mock-chat',store.useProvidersStore.getState().providers),true);
  store.useProvidersStore.getState().setChatModel(null);
  assert.equal(store.chatRequestModel('local-model'),'local-model');
});
