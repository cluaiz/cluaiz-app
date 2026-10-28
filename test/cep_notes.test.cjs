const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,harness}=require('./cepHarness.cjs');
const record=(patch={})=>({id:'n:1',text:'Remember the project language',scope:'workspace',owner:'/work',status:'confirmed',pinned:false,
  by:'user',sources:[],valid_from:'2026-10-28T06:00:00Z',updated_at:'2026-10-28T06:00:00Z',invalid_at:null,supersedes:null,...patch});
function setup(handler){
  const h=harness((url,body,options)=>{
    assert.equal(url,'/v1/cep');
    return handler(body,options);
  });
  return {...h,...load('src/api/engine/notes/notes.api.ts',{'../../client/cep':h,'../../client/errors':h.errors},{TextEncoder})};
}
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});

test('notes list uses the shared CEP client, preserves metadata and forwards cancellation',async()=>{
  const note=record({status:'proposed',by:'model',sources:['chat-a:m:4']}),signal=new AbortController().signal;
  const h=setup((body,options)=>{
    assert.deepEqual(body.params,{chat_id:'chat-a',scope:'workspace',status:'proposed'});
    assert.equal(options.signal,signal);return reply(body,{workspace:'/work',notes:[note]});
  });
  const list=await h.notesApi.list({chat_id:'chat-a',scope:'workspace',status:'proposed'},signal);
  assert.equal(list.notes[0],note);assert.equal(list.workspace,'/work');assert.equal(list.notes[0].sources[0],'chat-a:m:4');
  assert.equal(h.requests.length,1);
});

test('a real empty notes list is valid; malformed lists, duplicate ids and mismatched filters are failures',async()=>{
  const empty=setup(body=>reply(body,{workspace:'/work',notes:[]}));
  assert.equal((await empty.notesApi.list()).notes.length,0);
  for(const value of [null,{}, {workspace:'/work',notes:null},{workspace:'',notes:[]},
    {workspace:'/work',notes:[record(),record()]},{workspace:'/work',notes:[record({scope:['chat']})]},
    {workspace:'/work',notes:[record({updated_at:'invalid'})]}, {workspace:'/work',notes:[record({owner:undefined})]}]){
    const h=setup(body=>reply(body,value));await assert.rejects(h.notesApi.list(),{statusText:'INVALID_NOTES_RESPONSE'});
  }
  const mismatch=setup(body=>reply(body,{workspace:'/work',notes:[record()]}));
  await assert.rejects(mismatch.notesApi.list({scope:'chat'}),{statusText:'INVALID_NOTES_RESPONSE'});
});

test('creation trims text and only accepts a confirmed user note with matching scope/text/owner',async()=>{
  const h=setup(body=>{
    assert.equal(body.method,'notes.create');assert.equal(body.params.text,'Useful fact');
    return reply(body,{note:record({text:'Useful fact',scope:'chat',owner:'chat-a'}),superseded:null});
  });
  const result=await h.notesApi.create({text:'  Useful fact  ',scope:'chat',chat_id:'chat-a'});
  assert.equal(result.note.status,'confirmed');assert.equal(h.requests.length,1);
  for(const patch of [{text:'Wrong fact'},{status:'proposed'},{by:'model'},{scope:'global',owner:null},{owner:'other-chat'}]){
    const broken=setup(body=>reply(body,{note:record({text:'Useful fact',scope:'chat',owner:'chat-a',...patch}),superseded:null}));
    await assert.rejects(broken.notesApi.create({text:'Useful fact',scope:'chat',chat_id:'chat-a'}),{statusText:'INVALID_NOTES_RESPONSE'});
  }
});

test('UTF-8 bytes and chat ownership are checked before sending a mutation',async()=>{
  const h=setup(()=>assert.fail('invalid input must not reach transport'));
  for(const params of [{text:' ',scope:'global'},{text:'a'.repeat(2001),scope:'global'},
    {text:'अ'.repeat(667),scope:'workspace'},{text:'Fact',scope:'chat'},{text:'Fact',scope:'other'},
    {text:'Fact',scope:'global',pinned:'true'}])await assert.rejects(h.notesApi.create(params),{statusText:'INVALID_NOTE_INPUT'});
  assert.equal(h.noteTextBytes('अ'.repeat(666)),1998);assert.equal(h.requests.length,0);
});

test('confirm/pin/invalidate require exact saved id and acknowledged state; pin does not imply confirmation',async()=>{
  const h=setup(body=>reply(body,{note:record({id:body.params.id,
    ...(body.method==='notes.pin'?{pinned:body.params.pinned,status:'proposed'}:{}),
    ...(body.method==='notes.invalidate'?{status:'invalidated',invalid_at:'2026-10-28T06:01:00Z'}:{})}),superseded:null}));
  await h.notesApi.confirm('n:1');const pinned=await h.notesApi.pin('n:1',true);assert.equal(pinned.note.status,'proposed');
  await h.notesApi.pin('n:1',false);await h.notesApi.invalidate('n:1');
  for(const [method,args] of [['confirm',['n:2']],['pin',['n:2',true]],['invalidate',['n:2']]]){
    const wrong=setup(body=>reply(body,{note:record(),superseded:null}));
    await assert.rejects(wrong.notesApi[method](...args),{statusText:'INVALID_NOTES_RESPONSE'});
  }
});

test('superseded records use the actual nullable-object contract and retain history',async()=>{
  const replaced=record({status:'superseded',invalid_at:'2026-10-28T06:01:00Z'});
  const h=setup(body=>reply(body,{note:record({id:'n:2',supersedes:'n:1',pinned:true}),superseded:replaced}));
  const result=await h.notesApi.create({text:record().text,scope:'workspace',pinned:false});
  assert.equal(result.superseded.id,'n:1');assert.equal(result.note.pinned,true);
  const wrong=setup(body=>reply(body,{note:record(),superseded:[]}));
  await assert.rejects(wrong.notesApi.confirm('n:1'),{statusText:'INVALID_NOTES_RESPONSE'});
  const foreign=setup(body=>reply(body,{note:record({id:'n:2',supersedes:'n:1'}),superseded:{...replaced,owner:'/other'}}));
  await assert.rejects(foreign.notesApi.confirm('n:2'),{statusText:'INVALID_NOTES_RESPONSE'});
  const unpinned=setup(body=>reply(body,{note:record(),superseded:null}));
  await assert.rejects(unpinned.notesApi.create({text:record().text,scope:'workspace',pinned:true}),{statusText:'INVALID_NOTES_RESPONSE'});
});

test('RPC permission/not-found failures and unknown transport outcomes are preserved without mutation retries',async()=>{
  for(const code of [-32003,-32004,-32010]){
    const h=setup(body=>({jsonrpc:'2.0',id:body.id,error:{code,message:'Refused',data:{type:'notes_refused'}}}));
    await assert.rejects(h.notesApi.confirm('n:1'),error=>error.code===code&&error.data.type==='notes_refused');
    assert.equal(h.requests.length,1);
  }
  const failure=new Error('Network outcome unknown'),h=setup(()=>{throw failure;});
  await assert.rejects(h.notesApi.create({text:'A fact',scope:'global'}),error=>error===failure);
  assert.equal(h.requests.length,1);
});
