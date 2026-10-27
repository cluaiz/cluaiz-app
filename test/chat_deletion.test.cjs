const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,harness}=require('./cepHarness.cjs');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const normalize=value=>JSON.parse(JSON.stringify(value));
const types=load('src/services/storage/types.ts',{});
function connection(){return require('zustand').create(()=>({protocol:'http',host:'a',port:8000}));}
function manager(primary={},fallback={},scope=connection()){
 const defaults={loadSessionsIndex:async()=>null,deleteSession:async()=>{},saveSessionsIndex:async()=>{}};
 primary={...defaults,...primary};fallback={...defaults,...fallback};
 const driver=value=>class {constructor(){return value;}};
 return load('src/services/storage/ChatStorageManager.ts',{
  '../../core/tauri-api':{isTauri:()=>false},'./TauriFsChatStorageDriver':{TauriFsChatStorageDriver:driver(primary)},
  './EngineFsChatStorageDriver':{EngineFsChatStorageDriver:driver(primary)},
  './IndexedDbChatStorageDriver':{IndexedDbChatStorageDriver:driver(fallback)},
  './types':types,
  '../../store/engine/useConnectionStore':{useConnectionStore:scope},
 }).chatStorageManager;
}
test('failed primary chat deletion rejects instead of reporting a fallback-only success',async()=>{
 const m=manager({deleteSession:async()=>{throw Error('disk denied');}});
 await assert.rejects(m.deleteSession('chat-a'),/disk denied/);
});
test('chat deletion waits for fallback acknowledgment',async()=>{
 const pending=deferred();let finished=false;
 const m=manager({}, {deleteSession:()=>pending.promise});
 const operation=m.deleteSession('chat-a').then(()=>{finished=true;});
 await new Promise(r=>setTimeout(r,5));assert.equal(finished,false);
 pending.resolve();await operation;assert.equal(finished,true);
});
test('IndexedDB delete propagates failed transactions',async()=>{
 const {IndexedDbChatStorageDriver}=load('src/services/storage/IndexedDbChatStorageDriver.ts',{'./types':types},{window:{indexedDB:{}}});
 const driver=new IndexedDbChatStorageDriver();driver.getDb=async()=>{throw Error('database unavailable');};
 await assert.rejects(driver.deleteSession('chat-a'),/database unavailable/);
});

test('pending mirror writes finish before deletion and a failed operation does not poison the queue',async()=>{
 const pending=deferred(),events=[];
 const m=manager({saveAllMessages:async()=>{events.push('write');await pending.promise;events.push('saved');},
  deleteSession:async()=>events.push('primary-delete')},
  {saveAllMessages:async()=>{events.push('mirror');},deleteSession:async()=>events.push('fallback-delete')});
 const saving=m.saveAllMessages('chat-a',[]);const removing=m.deleteSession('chat-a');
 await new Promise(r=>setTimeout(r,5));assert.deepEqual(events,['write','mirror']);
 pending.resolve();await saving;await removing;assert.deepEqual(events,['write','mirror','saved','primary-delete','fallback-delete']);
 await assert.rejects(m.deleteSession('chat-a',()=>{throw Error('scope changed');}),/scope changed/);
 await m.deleteSession('chat-b');assert.equal(events.at(-1),'fallback-delete');
});
test('queued writes cannot begin on a newly selected Engine including A-B-A',async()=>{
 const scope=connection(),pending=deferred();let writes=0;
 const m=manager({saveAllMessages:async()=>pending.promise,saveSessionMetadata:async()=>{writes++;}},
  {saveAllMessages:async()=>{}},scope);
 const first=m.saveAllMessages('a',[]);const second=m.saveSessionMetadata('a',{});
 const rejected=assert.rejects(second,/connection changed/);
 await Promise.resolve();scope.setState({host:'b'});scope.setState({host:'a'});pending.resolve();
 await first;await rejected;assert.equal(writes,0);
});
test('late catalog and message saves cannot resurrect an acknowledged deletion',async()=>{
 const pending=deferred(),saved=[];
 const m=manager({deleteSession:()=>pending.promise,saveSessionsIndex:async index=>saved.push(normalize(index)),saveAllMessages:async()=>assert.fail('stale save')},
  {saveSessionsIndex:async()=>{}});
 const removal=m.deleteSession('a');
 const catalog=m.saveSessionsIndex({version:1,lastActiveSessionId:'a',sessions:[{id:'a'},{id:'b'}]});
 const messages=m.saveAllMessages('a',[]),rejected=assert.rejects(messages,/deleted/);
 pending.resolve();await removal;await catalog;await rejected;
 assert.deepEqual(saved,[{version:1,lastActiveSessionId:null,sessions:[{id:'b'}]}]);
});
test('memory-only fallback removes catalog and owned assets without touching similar ids',async()=>{
 const {IndexedDbChatStorageDriver}=load('src/services/storage/IndexedDbChatStorageDriver.ts',{'./types':types});
 const d=new IndexedDbChatStorageDriver();
 d.memoryFallback={index:{version:1,lastActiveSessionId:'a',sessions:[{id:'a'},{id:'ab'}]},meta:{a:{},ab:{}},messages:{a:[],ab:[]},assets:{'a:pic':{},'ab:pic':{}}};
 await d.deleteSession('a');assert.deepEqual(normalize(d.memoryFallback.index.sessions),[{id:'ab'}]);
 assert.equal(d.memoryFallback.index.lastActiveSessionId,null);assert.deepEqual(Object.keys(d.memoryFallback.assets),['ab:pic']);
});
test('full history adapter validates matching ids and partial cleanup without substituting KV-only deletion',async()=>{
 let result={chat_id:'a',events:{files:0,bytes:0},ledger:true,saved_kv:false,folder_removed:true};
 const h=harness((url,body)=>({jsonrpc:'2.0',id:body.id,result}));
 const {chatHistoryApi}=load('src/api/engine/chat/history.ts',{'../../client/cep':h,'../../client/errors':h.errors});
 await chatHistoryApi.deleteChat('a');assert.equal(h.requests[0].body.method,'memory.delete');
 for(const patch of [{chat_id:'other'},{events:{files:-1,bytes:0}},{saved_kv:0},{ledger:false}]){
  const previous=result;result={...result,...patch};await assert.rejects(chatHistoryApi.deleteChat('a'),/invalid/);result=previous;
 }
 result.folder_removed=false;await assert.rejects(chatHistoryApi.deleteChat('a'),/incomplete/);
 await assert.rejects(chatHistoryApi.deleteChat(' '),/chat id/);
});
test('browser deletion pins directory and catalog to the original workspace and stops after stale read',async()=>{
 const calls=[];let root='/work-a',stale=false;
 const catalog={version:1,lastActiveSessionId:'a',sessions:[{id:'a'},{id:'b'}]};
 const fsApi={getWorkspace:async()=>({workspace:root}),readFile:async p=>{calls.push(['read',p.path]);root='/work-b';return {content:JSON.stringify(catalog)};},
  deletePath:async p=>calls.push(['delete',p.path]),writeFile:async p=>calls.push(['write',p.path,JSON.parse(p.content)])};
 const {EngineFsChatStorageDriver}=load('src/services/storage/EngineFsChatStorageDriver.ts',{
  './types':types,'../../api/engine/fs/fs.api':{fsApi},'../../api/client/cep':{CepError:class extends Error{}},'../../utils/mimeSniffer':{},
 });
 const d=new EngineFsChatStorageDriver();await d.deleteSession('a');
 assert.deepEqual(calls.map(c=>c[1]),['/work-a/data/chats/sessions_index.json','/work-a/data/chats/a','/work-a/data/chats/sessions_index.json']);
 assert.deepEqual(normalize(calls[2][2].sessions),[{id:'b'}]);calls.length=0;
 fsApi.readFile=async()=>{stale=true;return {content:JSON.stringify(catalog)};};
 await assert.rejects(d.deleteSession('a',()=>{if(stale)throw Error('scope changed');}),/scope changed/);assert.deepEqual(calls,[]);
});
test('desktop deletion preserves other catalog entries and propagates catalog save failures',async()=>{
 const calls=[],index={version:1,lastActiveSessionId:'a',sessions:[{id:'a'},{id:'b'}]};let fail=false;
 const {TauriFsChatStorageDriver}=load('src/services/storage/TauriFsChatStorageDriver.ts',{
  './types':types,'@tauri-apps/api/core':{invoke:async(command,params)=>{
   calls.push([command,params]);if(command==='storage_load_sessions_index')return JSON.stringify(index);
   if(command==='storage_save_sessions_index'&&fail)throw Error('catalog denied');
  }},
 });
 const d=new TauriFsChatStorageDriver();await d.deleteSession('a');
 assert.deepEqual(calls.map(c=>c[0]),['storage_load_sessions_index','storage_delete_session','storage_save_sessions_index']);
 assert.deepEqual(JSON.parse(calls[2][1].indexJson).sessions,[{id:'b'}]);
 fail=true;await assert.rejects(d.deleteSession('a'),/catalog denied/);
});
function deletionHarness({engine=async()=>{},storage=async()=>{}}={}){
 const scope=connection(),calls=[],failures=[];
 const sessions={a:{id:'a',messages:[]},b:{id:'b',messages:[]}};let streaming=null;
 const api=load('src/store/chat/deletion.ts',{
  '../../api/engine/chat/history':{chatHistoryApi:{deleteChat:async id=>{calls.push('engine:'+id);await engine(id);}}},
  '../../services/storage/ChatStorageManager':{chatStorageManager:{deleteSession:async(id,guard)=>{guard();calls.push('disk:'+id);await storage(id);guard();}}},
  '../engine/useConnectionStore':{useConnectionStore:scope},
 });
 const owner={session:id=>sessions[id],streaming:id=>streaming===id,beforeStorage:async()=>{},
  removed:id=>{calls.push('removed:'+id);delete sessions[id];},failed:(id,error)=>failures.push(error.message)};
 return {...api,scope,calls,failures,sessions,owner,remove:api.createSessionDeleter(owner),setStreaming:id=>{streaming=id;}};
}
test('deletion is deduplicated and visible state survives until both acknowledgments',async()=>{
 const pending=deferred();const h=deletionHarness({storage:()=>pending.promise});
 const first=h.remove('a');assert.equal(h.remove('a'),first);
 await new Promise(r=>setTimeout(r,5));assert.ok(h.sessions.a);assert.deepEqual(h.calls,['engine:a','disk:a']);
 pending.resolve();assert.equal(await first,true);assert.equal(h.sessions.a,undefined);assert.ok(h.sessions.b);
});
test('failed Engine or storage cleanup retains the entry, emits error and allows explicit retry',async()=>{
 let fail=true;const h=deletionHarness({engine:async()=>{if(fail)throw Error('denied');}});
 assert.equal(await h.remove('a'),false);assert.ok(h.sessions.a);assert.deepEqual(h.calls,['engine:a']);
 fail=false;assert.equal(await h.remove('a'),true);assert.equal(h.failures.length,1);
 const d=deletionHarness({storage:async()=>{throw Error('disk full');}});
 assert.equal(await d.remove('a'),false);assert.ok(d.sessions.a);assert.match(d.failures[0],/disk full/);
});
test('streaming deletion is refused; connection changes and changed chat prevent later storage steps',async()=>{
 const h=deletionHarness();h.setStreaming('a');assert.equal(await h.remove('a'),false);assert.deepEqual(h.calls,[]);
 for(const change of [h=>{h.scope.setState({host:'b'});h.scope.setState({host:'a'});},h=>{h.sessions.a={...h.sessions.a};}]){
  const pending=deferred(),h=deletionHarness({engine:()=>pending.promise});const operation=h.remove('a');
  await Promise.resolve();change(h);pending.resolve();assert.equal(await operation,false);assert.deepEqual(h.calls,['engine:a']);assert.ok(h.sessions.a);
 }
});
test('private chats clean Engine state without writing disk and batch stops on a connection change',async()=>{
 const h=deletionHarness();h.sessions.a.isIncognito=true;assert.equal(await h.remove('a'),true);
 assert.deepEqual(h.calls,['engine:a','removed:a']);
 const removed=await h.deleteSessionBatch(['b','other'],async id=>{h.scope.setState({port:8001});return true;});
 assert.deepEqual(normalize(removed),['b']);
});
test('cleanup eligibility is rechecked after waiting for the Engine',async()=>{
 const pending=deferred(),h=deletionHarness({engine:()=>pending.promise});let eligible=true;
 const task=h.remove('a',()=>eligible);await Promise.resolve();eligible=false;pending.resolve();
 assert.equal(await task,false);assert.ok(h.sessions.a);assert.deepEqual(h.calls,['engine:a']);
 assert.match(h.failures[0],/protected/);
});
test('actual store preserves selected chat and shows an error when deletion fails',async()=>{
 const h=deletionHarness({storage:async()=>{throw Error('disk full');}}),notices=[],routes=[];
 const {useChatStore}=load('src/store/chat/useChatStore.ts',{
  zustand:require('zustand'),'./useChatPrefsStore':{currentChatPrefs:()=>({})},
  '../../services/storage/ChatStorageManager':{chatStorageManager:{}},'../../utils/topicProber':{inferChatTopicAndEmoji:()=>({})},
  '../../core/router':{pushChatRoute:id=>routes.push(id)},'./deletion':h,
  '../../components/ui/toast':{toast:{error:message=>notices.push(message)}},'../../api/client/errors':{errorMessage:error=>error.message},
 });
 useChatStore.setState({sessions:{...h.sessions},activeSessionId:'a'});
 assert.equal(await useChatStore.getState().deleteSession('a'),false);
 assert.ok(useChatStore.getState().sessions.a);assert.equal(useChatStore.getState().activeSessionId,'a');
 assert.deepEqual(routes,[]);assert.match(notices[0],/incomplete.*disk full/);
});
test('retention awaits results, counts actual deletion and shares an overlapping sweep',async()=>{
 const pending=deferred(),h=deletionHarness();let attempts=0;
 const state={isHydrated:true,activeSessionId:null,streamingSessionId:null,sessions:h.sessions,updateSession:()=>{},
  deleteSession:async id=>{attempts++;await pending.promise;return id==='a';}};
 const prefs={saveHistory:true,archiveDeleteAfterDays:0,deleteInactiveAfterDays:1,maxChats:0,autoArchiveAfterDays:0,protectPinned:true};
 state.sessions.a.updatedAt=0;state.sessions.b.updatedAt=0;
 const planner=load('src/services/storage/chatRetention.ts',{});
 const {applyChatRetention}=load('src/services/storage/chatRetentionRunner.ts',{
  '../../store/chat/useChatStore':{useChatStore:{getState:()=>state}},
  '../../store/chat/useChatPrefsStore':{currentChatPrefs:()=>prefs,useChatPrefsStore:{subscribe:()=>{}}},
  './chatRetention':planner,'../../store/chat/deletion':h,
 });
 const first=applyChatRetention(10*86400000);assert.equal(applyChatRetention(),first);
 await Promise.resolve();assert.equal(attempts,1);pending.resolve();
 const result=await first;assert.deepEqual(normalize(result.remove),['a']);assert.equal(attempts,2);
});
