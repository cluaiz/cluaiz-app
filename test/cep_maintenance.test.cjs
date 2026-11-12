const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,harness}=require('./cepHarness.cjs');
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});
function setup(handler){
  const h=harness((url,body)=>{assert.equal(url,'/v1/cep');return handler(body);});
  return {...h,...load('src/api/engine/system/maintenance.ts',{'../../client/cep':h,'../../client/errors':h.errors})};
}

test('audit log sends the limit and rejects malformed lines',async()=>{
  const h=setup(body=>{assert.equal(body.params.limit,50);
    return reply(body,{path:'/home/.cluaiz/cep-audit.jsonl',lines:[{ts:'2026-10-25T10:30:00Z',method:'fs.write',principal:'owner',code:null,ms:3}]});});
  assert.equal((await h.readAuditLog(50)).lines[0].method,'fs.write');
  const bad=setup(body=>reply(body,{path:'x',lines:[{ts:'t',principal:'owner'}]}));
  await assert.rejects(bad.readAuditLog(),{statusText:'INVALID_SYSTEM_RESPONSE'});
});

test('update check needs a release when it says one is available',async()=>{
  const latest={version:'0.2.0',tag:'v0.2.0',url:'https://example.invalid/r',prerelease:true};
  assert.equal((await setup(body=>reply(body,{current:'0.1.0',update_available:true,latest})).checkForUpdate()).latest.version,'0.2.0');
  assert.equal((await setup(body=>reply(body,{current:'0.1.0',update_available:false,latest:null})).checkForUpdate()).update_available,false);
  await assert.rejects(setup(body=>reply(body,{current:'0.1.0',update_available:true,latest:null})).checkForUpdate(),{statusText:'INVALID_SYSTEM_RESPONSE'});
});

test('tasks.list validates every task with its own method',async()=>{
  const h=harness((url,body)=>reply(body,{tasks:[{task_id:'t1',method:'audio.run',status:'working'},{task_id:'t2',method:'flows.run',status:'completed'}]}));
  assert.deepEqual((await h.listCepTasks()).map(task=>task.method),['audio.run','flows.run']);
  const bad=harness((url,body)=>reply(body,{tasks:[{task_id:'t1',method:'audio.run',status:'busy'}]}));
  await assert.rejects(bad.listCepTasks(),{statusText:'INVALID_CEP_TASK'});
});

test('embedding room accepts no chat model and rejects malformed candidates',async()=>{
  const h=harness((url,body)=>reply(body,{candidates:[{id:'e',installed:true,runs_on:'cpu',recommended:true}],gpu_left_gb:1}));
  const room=load('src/api/engine/models/embeddingRoom.ts',{'../../client/cep':h,'../../client/errors':h.errors});
  const value=await room.readEmbeddingRoom();
  assert.equal(value.chat_model,null);assert.equal(value.candidates[0].runs_on,'cpu');
  const bad=harness((url,body)=>reply(body,{candidates:[{id:'e'}]}));
  const badRoom=load('src/api/engine/models/embeddingRoom.ts',{'../../client/cep':bad,'../../client/errors':bad.errors});
  await assert.rejects(badRoom.readEmbeddingRoom(),{statusText:'INVALID_MODELS_RESPONSE'});
});

test('App chat import runs as a task and returns its rows',async()=>{
  const h=harness((url,body)=>{
    if(body.method==='chat.import_app'){assert.equal(body.params.dry_run,true);assert.equal(body.params.all,true);
      return reply(body,{task:{task_id:'t1',method:'chat.import_app',status:'working'}});}
    return reply(body,{roots:['/r'],chats:[{chat_id:'c1',status:'dry run',messages:3}]});
  });
  const imp=load('src/api/engine/chat/importApp.ts',{'../../client/cepTask':h,'../../client/errors':h.errors});
  assert.equal((await imp.importAppChats(true)).chats[0].messages,3);
});
