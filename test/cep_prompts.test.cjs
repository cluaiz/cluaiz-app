const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,harness}=require('./cepHarness.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
const record=(patch={})=>({id:'tools.workspace',description:'Folder line',text:'Tools run in {{folder}}.',variables:['folder'],overridden:false,...patch});
function setup(handler){
  const h=harness((url,body)=>{assert.equal(url,'/v1/cep');return handler(body);});
  return {...h,...load('src/api/engine/prompts/prompts.api.ts',{'../../client/cep':h,'../../client/errors':h.errors})};
}
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});

test('list keeps every prompt; malformed lists fail',async()=>{
  const h=setup(body=>reply(body,{prompts:[record(),record({id:'chat.flow_hint',variables:[]})]}));
  assert.deepEqual((await h.promptsApi.list()).map(item=>item.id),['tools.workspace','chat.flow_hint']);
  for(const value of [null,{},{prompts:[record({variables:null})]},{prompts:[record({overridden:'no'})]}]){
    await assert.rejects(setup(body=>reply(body,value)).promptsApi.list(),{statusText:'INVALID_PROMPTS_RESPONSE'});
  }
});

test('set and reset must answer for the same prompt with the expected state',async()=>{
  const sent=[];
  const h=setup(body=>{sent.push(plain(body));
    return reply(body,{prompt:body.method==='prompts.set'?record({text:body.params.text,overridden:true}):record()});});
  assert.equal((await h.promptsApi.set('tools.workspace','Work in {{folder}}.')).overridden,true);
  assert.equal((await h.promptsApi.reset('tools.workspace')).overridden,false);
  assert.deepEqual(sent.map(body=>[body.method,body.params]),[['prompts.set',{id:'tools.workspace',text:'Work in {{folder}}.'}],['prompts.reset',{id:'tools.workspace'}]]);
  const other=setup(body=>reply(body,{prompt:record({id:'other',overridden:true,text:'x'})}));
  await assert.rejects(other.promptsApi.set('tools.workspace','x'),{statusText:'INVALID_PROMPTS_RESPONSE'});
  const unsaved=setup(body=>reply(body,{prompt:record({text:'x'})}));
  await assert.rejects(unsaved.promptsApi.set('tools.workspace','x'),{statusText:'INVALID_PROMPTS_RESPONSE'});
});

test('history belongs to the prompt asked for',async()=>{
  const h=setup(body=>reply(body,{id:'tools.workspace',history:[{text:'old',replaced_at:'20261101T101500.120Z'}]}));
  assert.equal((await h.promptsApi.history('tools.workspace'))[0].text,'old');
  const other=setup(body=>reply(body,{id:'other',history:[]}));
  await assert.rejects(other.promptsApi.history('tools.workspace'),{statusText:'INVALID_PROMPTS_RESPONSE'});
});
