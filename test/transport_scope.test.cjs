const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./cepHarness.cjs');
const deferred=()=>{let resolve,reject;return {promise:new Promise((yes,no)=>{resolve=yes;reject=no;}),resolve:value=>resolve(value),reject:error=>reject(error)};};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(fetcher,nativeInvoke=async()=>{throw Error('Unexpected native invocation');}){
 const {create}=require('zustand');
 const connection=create((set,get)=>({protocol:'http',host:'engine-a.invalid',port:1234,getBaseUrl:()=>`http://${get().host}:${get().port}`}));
 const errors=load('src/api/client/errors.ts',{});const calls=[];
 const web={URL,URLSearchParams,Request,Headers,Response,DOMException,ReadableStream,TextEncoder,TextDecoder};
 const native=load('src/api/client/nativeFetch.ts',{},web);
 const transport=load('src/api/client/transport.ts',{
  './ipc':{ipc:{invoke:nativeInvoke},isTauri:()=>true},'./nativeFetch':native,
  '../../store/engine/useConnectionStore':{useConnectionStore:connection},
 },{fetch:(url,init)=>fetcher(url,init,calls.length)});
 const {http}=load('src/api/client/http.ts',{'./errors':errors,
  './transport':{engineFetch:async(url,init)=>{calls.push({url,init});return transport.engineFetch(url,init);}},
  '../../store/engine/useConnectionStore':{useConnectionStore:connection},
 },web);
 return {http,connection,errors,calls};
}

test('401 from an obsolete connection cannot replay a mutation against the newly selected Engine',async()=>{
 const first=deferred();const h=harness((url,init,n)=>n===1?first.promise:json({unexpected:'replayed'}));
 h.http.setToken('owned-a');h.http.setAuthTokenSyncHandler(async()=> 'owned-refreshed');
 const request=h.http.post('/v1/cep',{method:'kv.clear'});const outcome=request.then(value=>({value}),error=>({error}));
 await tick();h.connection.setState({host:'engine-b.invalid'});h.http.setToken('owned-b');first.resolve(json({error:'old unauthorized'},401));
 const result=await outcome;
 assert.equal(h.calls.length,1,'old mutation was sent again');assert.equal(result.error?.statusText,'STALE_CONNECTION');
 assert.equal(h.http.getToken(),'owned-b');
});

test('delayed auth synchronization cannot overwrite a manually selected credential',async()=>{
 const entered=deferred(),auth=deferred();const h=harness((url,init,n)=>json(n===1?{error:'unauthorized'}:{ok:true},n===1?401:200));
 h.http.setToken('owned-first');h.http.setAuthTokenSyncHandler(()=>{entered.resolve();return auth.promise;});
 const request=h.http.get('/v1/cep');await entered.promise;h.http.setToken('owned-manual');auth.resolve('owned-obsolete');await request;
 assert.equal(h.http.getToken(),'owned-manual');
 assert.equal(new Headers(h.calls[1].init.headers).get('authorization'),'Bearer owned-manual');
});

test('per-request timeout remains effective when the caller also supplies a live AbortSignal',async()=>{
 const h=harness(async()=>{await new Promise(resolve=>setTimeout(resolve,30));return json({tooLate:true});});
 const caller=new AbortController();
 await assert.rejects(h.http.get('/v1/cep',{signal:caller.signal,timeoutMs:5}),error=>error.statusText==='TIMEOUT');
 assert.equal(caller.signal.aborted,false);
});

test('same-Engine 401 retries once with identical serialized payload and frozen request options',async()=>{
 const auth=deferred(),entered=deferred();
 const h=harness((url,init,n)=>json(n===1?{error:'unauthorized'}:{ok:true},n===1?401:200));
 h.http.setToken('owned-initial');h.http.setAuthTokenSyncHandler(()=>{entered.resolve();return auth.promise;});
 const payload={method:'kv.clear',params:{marker:'original'}};
 const options={params:{query:'a & b'},headers:{'x-owned':'original'},method:'POST',body:payload};
 const request=h.http.request('/v1/cep',options);await entered.promise;
 payload.params.marker='changed';options.headers['x-owned']='changed';options.params.query='changed';options.method='DELETE';
 auth.resolve('owned-fresh');assert.deepEqual(await request,{ok:true});assert.equal(h.calls.length,2);
 assert.equal(h.calls[0].url,h.calls[1].url);assert.ok(h.calls[1].url.includes('query=a+%26+b'));
 assert.equal(h.calls[0].init.body,h.calls[1].init.body);assert.equal(h.calls[1].init.method,'POST');
 assert.equal(new Headers(h.calls[1].init.headers).get('x-owned'),'original');
 assert.equal(new Headers(h.calls[1].init.headers).get('authorization'),'Bearer owned-fresh');
});

test('a second 401, skipAuth, network failure and 5xx are never extra mutation retries',async()=>{
 const h=harness(()=>json({message:'Still unauthorized'},401));let syncs=0;
 h.http.setAuthTokenSyncHandler(async()=>{syncs++;return 'owned-key';});
 await assert.rejects(h.http.post('/v1/cep',{method:'kv.clear'}),error=>error.status===401&&error.message==='Still unauthorized');
 assert.equal(h.calls.length,2);assert.equal(syncs,1);
 await assert.rejects(h.http.get('/v1/cep',{skipAuth:true}),error=>error.status===401);assert.equal(syncs,1);assert.equal(h.calls.length,3);
 for(const fetcher of [()=>Promise.reject(Error('Network unavailable')),()=>json({error:'Service unavailable'},503)]){
  const other=harness(fetcher);other.http.setAuthTokenSyncHandler(async()=>{throw Error('Must not synchronize');});
  await assert.rejects(other.http.post('/v1/cep',{}));assert.equal(other.calls.length,1);
 }
});

test('already-cancelled and later-cancelled observations do not retry and late bodies are released',async()=>{
 const first=deferred();let cancelledBody=0;
 const h=harness(()=>first.promise);const controller=new AbortController();controller.abort();
 await assert.rejects(h.http.get('/v1/cep',{signal:controller.signal}),error=>error.statusText==='CANCELLED');assert.equal(h.calls.length,0);
 const live=new AbortController();const request=h.http.get('/v1/cep',{signal:live.signal});const outcome=request.catch(error=>error);
 live.abort();assert.equal((await outcome).statusText,'CANCELLED');assert.equal(h.calls.length,1);
 first.resolve(new Response(new ReadableStream({cancel(){cancelledBody++;}}),{headers:{'content-type':'application/json'}}));
 await tick();assert.equal(cancelledBody,1);
});

test('timeout covers response-body consumption rather than ending at response headers',async()=>{
 const h=harness((url,init)=>new Response(new ReadableStream({start(controller){
  controller.enqueue(new TextEncoder().encode('{"unfinished":'));
  init.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});
 }}),{headers:{'content-type':'application/json'}}));
 const caller=new AbortController();await assert.rejects(h.http.get('/v1/cep',{timeoutMs:15,signal:caller.signal}),error=>error.statusText==='TIMEOUT');
 assert.equal(caller.signal.aborted,false);assert.equal(h.calls.length,1);
});

test('protocol/port and A-B-A changes invalidate an old request even when its final URL matches',async()=>{
 for(const mutate of [h=>h.connection.setState({protocol:'ffi'}),h=>h.connection.setState({port:5678}),
  h=>{h.connection.setState({host:'engine-b.invalid'});h.connection.setState({host:'engine-a.invalid'});}]){
  const first=deferred();const h=harness(()=>first.promise);const request=h.http.get('/v1/cep').catch(error=>error);
  mutate(h);assert.equal((await request).statusText,'STALE_CONNECTION');first.resolve(json({stale:true}));await tick();assert.equal(h.calls.length,1);
 }
});

test('a cleared credential or replaced auth handler wins over an obsolete synchronization result',async()=>{
 for(const mutate of [h=>h.http.setToken(null),h=>h.http.setAuthTokenSyncHandler(async()=> 'owned-new-handler')]){
  const auth=deferred(),entered=deferred();const h=harness(()=>json({error:'Unauthorized'},401));
  h.http.setToken('owned-old');h.http.setAuthTokenSyncHandler(()=>{entered.resolve();return auth.promise;});
  const request=h.http.get('/v1/cep').catch(error=>error);await entered.promise;mutate(h);auth.resolve('owned-obsolete');
  assert.equal((await request).status,401);assert.notEqual(h.http.getToken(),'owned-obsolete');assert.equal(h.calls.length,1);
 }
});

test('cancelling or timing out auth wait does not apply its eventual key or retry',async()=>{
 for(const timeout of [false,true]){
  const auth=deferred(),entered=deferred();const h=harness(()=>json({error:'Unauthorized'},401));
  h.http.setToken('owned-old');h.http.setAuthTokenSyncHandler(()=>{entered.resolve();return auth.promise;});
  const caller=new AbortController();const request=h.http.get('/v1/cep',{signal:caller.signal,timeoutMs:timeout?20:0}).catch(error=>error);
  await entered.promise;if(!timeout)caller.abort();assert.equal((await request).statusText,timeout?'TIMEOUT':'CANCELLED');
  auth.resolve('owned-obsolete');await tick();assert.equal(h.http.getToken(),'owned-old');assert.equal(h.calls.length,1);
 }
});

test('concurrent same-connection 401 responses share auth and retry each request only once',async()=>{
 const auth=deferred(),entered=deferred();let synchronized=0;
 const h=harness((url,init)=>new Headers(init.headers).get('authorization')==='Bearer owned-fresh'?json({ok:true}):json({error:'Unauthorized'},401));
 h.http.setToken('owned-old');h.http.setAuthTokenSyncHandler(()=>{synchronized++;entered.resolve();return auth.promise;});
 const first=h.http.post('/v1/cep',{id:1}),second=h.http.post('/v1/cep',{id:2});await entered.promise;await tick();
 assert.equal(synchronized,1);auth.resolve('owned-fresh');await Promise.all([first,second]);assert.equal(h.calls.length,4);assert.equal(synchronized,1);
});

test('obsolete auth sync neither blocks a new connection nor clears its pending synchronization',async()=>{
 const old=deferred(),fresh=deferred(),entered=deferred();let synchronized=0;
 const h=harness((url,init)=>new Headers(init.headers).get('authorization')==='Bearer owned-b-fresh'?json({ok:true}):json({error:'Unauthorized'},401));
 h.http.setToken('owned-a');h.http.setAuthTokenSyncHandler(()=>{synchronized++;if(synchronized===1){entered.resolve();return old.promise;}return fresh.promise;});
 const first=h.http.get('/v1/cep').catch(error=>error);await entered.promise;h.connection.setState({host:'engine-b.invalid'});h.http.setToken('owned-b');
 assert.equal((await first).statusText,'STALE_CONNECTION');const second=h.http.get('/v1/cep');await tick();assert.equal(synchronized,2);
 old.resolve('owned-a-obsolete');await tick();const third=h.http.get('/v1/cep');await tick();assert.equal(synchronized,2);
 fresh.resolve('owned-b-fresh');await Promise.all([second,third]);assert.equal(h.http.getToken(),'owned-b-fresh');
 assert.ok(h.calls.slice(1).every(call=>call.url.startsWith('http://engine-b.invalid:')));
});

test('native pending headers are cancelled once and a protocol change never falls back or retries over HTTP',async()=>{
 const head=deferred(),entered=deferred();const native=[];let network=0;
 const h=harness(()=>{network++;return json({wrong:true});},async(command,args)=>{
  native.push({command,args});if(command==='engine_native_start')return 'owned-native-id';
  if(command==='engine_native_head'){entered.resolve();return head.promise;}
  if(command==='engine_native_cancel')return true;
  throw Error('Unexpected IPC read');
 });h.connection.setState({protocol:'ffi'});const request=h.http.post('/v1/cep',{method:'kv.clear'}).catch(error=>error);
 await entered.promise;h.connection.setState({protocol:'http'});assert.equal((await request).statusText,'STALE_CONNECTION');
 head.resolve({status:401,headers:[['content-type','application/json']]});await tick();
 assert.equal(network,0);assert.equal(native.filter(call=>call.command==='engine_native_start').length,1);
 assert.equal(native.filter(call=>call.command==='engine_native_cancel').length,1);assert.equal(h.calls.length,1);
});

test('actual native 401/JSON bodies release both request IDs and preserve byte-identical retry payloads',async()=>{
 const native=[],reads=new Set();let next=0;
 const h=harness(()=>{throw Error('Native must not use HTTP');},async(command,args)=>{
  native.push({command,args});if(command==='engine_native_start')return 'owned-'+(++next);
  if(command==='engine_native_head')return {status:args.id==='owned-1'?401:200,headers:[['content-type','application/json']]};
  if(command==='engine_native_read'){
   if(reads.has(args.id))return {data:[],done:true};reads.add(args.id);
   return {data:Array.from(new TextEncoder().encode(JSON.stringify(args.id==='owned-1'?{error:'Unauthorized'}:{ok:true}))),done:false};
  }
  if(command==='engine_native_cancel')return true;throw Error('Unknown native command');
 });h.connection.setState({protocol:'ffi'});h.http.setAuthTokenSyncHandler(async()=> 'owned-key');
 assert.deepEqual(await h.http.post('/v1/cep',{method:'owned-read',input:'हिंदी'}),{ok:true});
 const starts=native.filter(call=>call.command==='engine_native_start');assert.equal(starts.length,2);
 assert.deepEqual(starts[0].args.request.body,starts[1].args.request.body);
 assert.equal(native.filter(call=>call.command==='engine_native_cancel').length,2);
});

test('normal text/204/error bodies and timeout zero keep their shared-client behavior',async()=>{
 const h=harness((url,init,n)=>n===1?new Response('owned text'):
  n===2?new Response(null,{status:204}):json({error:'Actual refusal'},403));
 assert.equal(await h.http.get('/owned',{timeoutMs:0}),'owned text');assert.equal(await h.http.get('/owned'),undefined);
 await assert.rejects(h.http.get('/owned'),error=>error.status===403&&error.message==='Actual refusal');
 await assert.rejects(h.http.get('/owned',{timeoutMs:-1}),error=>error.statusText==='INVALID_TIMEOUT');assert.equal(h.calls.length,3);
});

test('completed requests remove caller/connection observers and their timeout timer',async()=>{
 const h=harness(()=>json({ok:true})),caller=new AbortController();
 await h.http.get('/v1/cep',{signal:caller.signal,timeoutMs:15});const signal=h.calls[0].init.signal;
 caller.abort();h.connection.setState({port:7890});await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(signal.aborted,false,'completed observation retained a listener or timer');assert.equal(h.calls.length,1);
});

test('fast concurrent auth shares fresh credentials and failed providers can recover on a later request',async()=>{
 let syncs=0;
 const h=harness((url,init)=>new Headers(init.headers).get('authorization')==='Bearer owned-fresh'?json({ok:true}):json({error:'Unauthorized'},401));
 h.http.setAuthTokenSyncHandler(async()=>{syncs++;return 'owned-fresh';});
 await Promise.all(Array.from({length:12},(_,id)=>h.http.post('/v1/cep',{id})));assert.equal(syncs,1);
 let available=false,attempts=0;const other=harness((url,init)=>new Headers(init.headers).get('authorization')==='Bearer recovered'?json({ok:true}):json({error:'Unauthorized'},401));
 other.http.setAuthTokenSyncHandler(async()=>{attempts++;if(!available)throw Error('Provider temporarily unavailable');return 'recovered';});
 await assert.rejects(other.http.get('/v1/cep'),/Provider temporarily unavailable/);available=true;
 assert.deepEqual(await other.http.get('/v1/cep'),{ok:true});assert.equal(attempts,2);
});
