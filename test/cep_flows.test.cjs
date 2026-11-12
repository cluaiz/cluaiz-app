const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,harness}=require('./cepHarness.cjs');
const flow=(patch={})=>({name:'weekly',scope:'user',path:'~/.cluaiz/flows/weekly.flow.yaml',format:'yaml',enabled:true,
  triggers:[{id:'schedule_0',kind:'schedule',status:'active'}],...patch});
const runRecord=(patch={})=>({run_id:'run_1',flow:'weekly',scope:'user',status:'succeeded',created_at:'2026-11-06T18:00:00Z',...patch});
function setup(handler){
  const h=harness((url,body,options)=>{assert.equal(url,'/v1/cep');return handler(body,options);});
  return {...h,...load('src/api/engine/automation/flows.api.ts',{'../../client/cep':h,'../../client/errors':h.errors})};
}
// Adapters run in their own VM realm; compare their objects as plain data.
const plain=value=>JSON.parse(JSON.stringify(value));
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});
const failure=(body,code,message,data)=>({jsonrpc:'2.0',id:body.id,error:{code,message,data}});

test('flows.list asks for both scopes and keeps flows with problems',async()=>{
  const broken=flow({name:'broken',scope:'project',enabled:false,triggers:undefined,problems:[{severity:'error',code:'parse_error',path:'',message:'x'}]});
  const h=setup(body=>{assert.equal(body.method,'flows.list');assert.deepEqual(plain(body.params),{scope:'all'});return reply(body,{flows:[flow(),broken]});});
  const flows=await h.flowsApi.list();
  assert.deepEqual(flows.map(item=>item.name),['weekly','broken']);
  assert.equal(flows[1].problems.length,1);
});

test('malformed lists are failures, not an empty screen',async()=>{
  for(const value of [null,{},{flows:null},{flows:[flow({scope:'team'})]},{flows:[flow({enabled:'yes'})]}]){
    const h=setup(body=>reply(body,value));
    await assert.rejects(h.flowsApi.list(),{statusText:'INVALID_FLOWS_RESPONSE'});
  }
});

test('enable and disable must answer for the same flow; confirmation is sent only when asked',async()=>{
  const ref={name:'weekly',scope:'user'};
  const sent=[];
  const h=setup(body=>{sent.push(body);return reply(body,{flow:flow({enabled:body.method==='flows.enable'})});});
  assert.equal((await h.flowsApi.enable(ref)).enabled,true);
  assert.equal((await h.flowsApi.enable(ref,true)).enabled,true);
  assert.equal((await h.flowsApi.disable(ref)).enabled,false);
  assert.deepEqual(plain(sent.map(body=>body.params)),[ref,{...ref,permissions_confirmed:true},ref]);
  const other=setup(body=>reply(body,{flow:flow({name:'other'})}));
  await assert.rejects(other.flowsApi.enable(ref),{statusText:'INVALID_FLOWS_RESPONSE'});
});

test('a permissions_unconfirmed refusal exposes what the flow still needs',async()=>{
  const h=setup(body=>failure(body,-32005,'not confirmed',{type:'permissions_unconfirmed',
    permissions_missing:{methods:['fs.read'],folders:[],scopes:['exec']}}));
  const error=await h.flowsApi.enable({name:'weekly',scope:'user'}).catch(reason=>reason);
  assert.deepEqual(plain(h.missingPermissions(error)),{methods:['fs.read'],scopes:['exec']});
  const other=setup(body=>failure(body,-32004,'no flow',{type:'flow_not_found'}));
  assert.equal(other.missingPermissions(await other.flowsApi.enable({name:'x',scope:'user'}).catch(reason=>reason)),null);
});

test('run returns the run id; runs and run_get validate records',async()=>{
  const h=setup(body=>{
    if(body.method==='flows.run')return reply(body,{task:{task_id:'t',method:'flows.run',status:'working'},run_id:'run_1',status:'running'});
    if(body.method==='flows.runs')return reply(body,{runs:[runRecord()],next:null});
    assert.deepEqual(plain(body.params),{run_id:'run_1'});
    return reply(body,{run:runRecord(),steps:[{id:'closed',kind:'tool',status:'succeeded',attempts:[{ms:12,error:null}]}]});
  });
  assert.equal(await h.flowsApi.run({name:'weekly',scope:'user'}),'run_1');
  assert.equal((await h.flowsApi.runs())[0].run_id,'run_1');
  assert.equal((await h.flowsApi.runGet('run_1')).steps[0].id,'closed');
  const wrong=setup(body=>reply(body,{run:runRecord({run_id:'run_2'}),steps:[]}));
  await assert.rejects(wrong.flowsApi.runGet('run_1'),{statusText:'INVALID_FLOWS_RESPONSE'});
  const bad=setup(body=>reply(body,{runs:[runRecord({status:'done'})]}));
  await assert.rejects(bad.flowsApi.runs(),{statusText:'INVALID_FLOWS_RESPONSE'});
});

test('get, validate, save, remove and rerun_from send the documented params and check the answer',async()=>{
  const ref={name:'weekly',scope:'user'};const sent={};
  const h=setup(body=>{
    sent[body.method]=plain(body.params);
    switch(body.method){
      case 'flows.get':return reply(body,{flow:flow(),format:'yaml',text:'flow: cluaiz.flow/1\n'});
      case 'flows.schema':return reply(body,{version:'cluaiz.flow/1',formats:['json','yaml']});
      case 'flows.validate':return reply(body,{valid:false,problems:[{severity:'error',code:'x',path:'/steps',message:'bad'}]});
      case 'flows.save':return reply(body,{flow:flow()});
      case 'flows.remove':return reply(body,{removed:'weekly',scope:'user',runs_removed:1,runs_cancelled:0});
      case 'flows.rerun_from':return reply(body,{run_id:'run_2',status:'running'});
    }
  });
  assert.equal((await h.flowsApi.get(ref)).text,'flow: cluaiz.flow/1\n');
  assert.deepEqual(sent['flows.get'],{...ref,as:'text'});
  assert.equal(await h.flowsApi.schemaVersion(),'cluaiz.flow/1');
  assert.equal((await h.flowsApi.validate({text:'x',format:'yaml'})).problems.length,1);
  assert.equal((await h.flowsApi.save({text:'x',format:'yaml',scope:'user',overwrite:true})).name,'weekly');
  assert.deepEqual(sent['flows.save'],{text:'x',format:'yaml',scope:'user',overwrite:true});
  await h.flowsApi.remove(ref);
  assert.equal(await h.flowsApi.rerunFrom('run_1','report'),'run_2');
  assert.deepEqual(sent['flows.rerun_from'],{run_id:'run_1',from:'report'});
  const wrongRemove=setup(body=>reply(body,{removed:'other',scope:'user'}));
  await assert.rejects(wrongRemove.flowsApi.remove(ref),{statusText:'INVALID_FLOWS_RESPONSE'});
  const wrongGet=setup(body=>reply(body,{flow:flow(),format:'toml',text:''}));
  await assert.rejects(wrongGet.flowsApi.get(ref),{statusText:'INVALID_FLOWS_RESPONSE'});
});
