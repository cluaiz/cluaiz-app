const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,harness}=require('./cepHarness.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});
function setup(handler){
  const h=harness((url,body)=>{assert.equal(url,'/v1/cep');return handler(body);});
  return {...h,...load('src/api/engine/fs/projectAgent.ts',{'../../client/cep':h,'../../client/errors':h.errors})};
}
const index={root:'/p',instructions:[{label:'.agents/AGENTS.md',path:'/p/.agents/AGENTS.md',chars:10}],
  rules:[{name:'style',kind:'rule',path:'/p/.agents/rules/style.md'}],workflows:[],skills:[],memory:[],problems:[]};

test('index and facts validate every list',async()=>{
  assert.equal((await setup(body=>reply(body,index)).projectAgentApi.index()).rules[0].name,'style');
  await assert.rejects(setup(body=>reply(body,{...index,skills:null})).projectAgentApi.index(),{statusText:'INVALID_PROJECT_RESPONSE'});
  const facts=setup(body=>reply(body,{facts:[{name:'port',kind:'memory',path:'/p/.agents/memory/port.md',text:'8011'}]}));
  assert.equal((await facts.projectAgentApi.facts())[0].text,'8011');
  await assert.rejects(setup(body=>reply(body,{facts:[{name:'port',path:'x'}]})).projectAgentApi.facts(),{statusText:'INVALID_PROJECT_RESPONSE'});
});

test('remember trims, names its source and checks length; forget must name the same fact',async()=>{
  let sent;
  const h=setup(body=>{sent=plain(body.params);return reply(body,{saved:'port',path:'/p/.agents/memory/port.md',replaced:[],similar:['deploy']});});
  const result=await h.projectAgentApi.remember(' port ',' The port is 8011. ');
  assert.deepEqual(sent,{name:'port',fact:'The port is 8011.',source:'Cluaiz App'});
  assert.deepEqual(plain(result.similar),['deploy']);
  await h.projectAgentApi.remember('port','x','port');assert.equal(sent.replaces,'port');
  await assert.rejects(h.projectAgentApi.remember('port','   '),{statusText:'INVALID_PROJECT_INPUT'});
  await assert.rejects(h.projectAgentApi.remember('port','x'.repeat(2001)),{statusText:'INVALID_PROJECT_INPUT'});
  await setup(body=>reply(body,{forgotten:'port',path:'x'})).projectAgentApi.forget('port');
  await assert.rejects(setup(body=>reply(body,{forgotten:'other'})).projectAgentApi.forget('port'),{statusText:'INVALID_PROJECT_RESPONSE'});
});
