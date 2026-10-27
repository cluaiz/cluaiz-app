const {test}=require('node:test');const assert=require('node:assert/strict');
const {harness,load}=require('./cepHarness.cjs');
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});
const record=(id='ap_owned',status='pending')=>({id,principal:'agent',method:'mcp:owned',target:'{}',
    created_at:'2026-10-27T10:00:00Z',expires_at:'2026-10-27T10:05:00Z',status});
const normalize=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:value=>resolve(value)};};
function storeFor(h,active='session-secret'){
    let token=active,subscriber;
    const http={getToken:()=>token,setToken:value=>{token=value;},setAuthTokenSyncHandler:()=>{}};
    const connection={subscribe:fn=>{subscriber=fn;}};
    const store=load('src/api/engine/permission/permission.store.ts',{
        zustand:require('zustand'),'../../client':{http,errorMessage:h.errors.errorMessage},'./permission.api':h,
        '../../app/native/native.api':{nativeApi:{isDesktop:()=>false}},'../../client/errors':h.errors,
        '../../../store/engine/useConnectionStore':{useConnectionStore:connection},
    }).usePermissionStore;
    store.setState({permissions:{lazy_load_model:true,api_auth:{required:true,tokens:['key-a','key-b']}}});
    return {store,http,switchConnection:()=>subscriber({host:'new',port:8000,protocol:'http'},{host:'old',port:8000,protocol:'http'})};
}

test('token facade uses only CEP and retains real authentication state',async()=>{
    const h=harness((url,body)=>reply(body,body.method==='tokens.list'?{tokens:[],api_auth_required:false}:
        body.method==='tokens.create'?{tokens:['key-new'],token:'key-new',api_auth_required:false}:
        {tokens:[],revoked_token:'key-new',api_auth_required:false}));
    const signal=new AbortController().signal;
    assert.deepEqual(normalize(await h.permissionApi.listAuthTokens(signal)),{tokens:[],api_auth_required:false});
    assert.equal(h.requests[0].options.signal,signal);
    assert.equal((await h.permissionApi.generateAuthToken()).token,'key-new');
    assert.equal((await h.permissionApi.revokeAuthToken('key-new')).api_auth_required,false);
    assert.ok(h.requests.every(r=>r.url==='/v1/cep'));
    assert.deepEqual(normalize(h.requests.map(r=>[r.body.method,r.body.params])),[
        ['tokens.list',{}],['tokens.create',{}],['tokens.revoke',{token:'key-new'}]]);
});

test('token responses cannot invent a created/revoked key, auth flag or fallback list',async()=>{
    for(const value of [null,{}, {tokens:['key-a','key-a'],api_auth_required:true},
        {tokens:['key-a'],token:'other',api_auth_required:true}]){
        const h=harness((url,body)=>reply(body,value));
        await assert.rejects(h.permissionApi.generateAuthToken(),e=>e.statusText==='INVALID_TOKENS_RESPONSE');
    }
    for(const value of [{tokens:[],revoked_token:'other',api_auth_required:false},
        {tokens:['key-a'],revoked_token:'key-a',api_auth_required:true},
        {tokens:[],revoked_token:'key-a',api_auth_required:true}]){
        const h=harness((url,body)=>reply(body,value));
        await assert.rejects(h.permissionApi.revokeAuthToken('key-a'),e=>e.statusText==='INVALID_TOKENS_RESPONSE');
    }
    const h=harness(()=>{throw Error('Must not dispatch');});
    await assert.rejects(h.permissionApi.revokeAuthToken('  '));assert.equal(h.requests.length,0);
});

test('CEP token limit and save failures keep real error identity without a success value',async()=>{
    const h=harness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code:-32005,message:'At most 5 API keys',data:{type:'token_limit'}}}));
    const {store,http}=storeFor(h);
    await assert.rejects(store.getState().generateAuthToken(),e=>e.code===-32005&&e.data.type==='token_limit');
    assert.equal(http.getToken(),'session-secret');assert.equal(store.getState().permissions.api_auth.tokens.length,2);
    assert.equal(store.getState().error,'At most 5 API keys');
});

test('revoking another API key preserves the desktop session secret and applies last-key auth-off',async()=>{
    const h=harness((url,body)=>reply(body,{tokens:[],api_auth_required:false,revoked_token:'key-a'}));
    const {store,http}=storeFor(h);await store.getState().revokeAuthToken('key-a');
    assert.equal(http.getToken(),'session-secret');
    assert.deepEqual(normalize(store.getState().permissions.api_auth),{required:false,tokens:[]});
});

test('revoking the active key switches only after matching acknowledgment; refusal leaves state untouched',async()=>{
    let denied=true;const h=harness((url,body)=>denied?Promise.reject(Error('Write refused')):
        reply(body,{tokens:['key-b'],api_auth_required:true,revoked_token:'key-a'}));
    const {store,http}=storeFor(h,'key-a');
    await assert.rejects(store.getState().revokeAuthToken('key-a'),/Write refused/);
    assert.equal(http.getToken(),'key-a');assert.equal(store.getState().permissions.api_auth.tokens.length,2);
    denied=false;await store.getState().revokeAuthToken('key-a');assert.equal(http.getToken(),'key-b');
});

test('creation preserves an existing session and serializes local token mutations',async()=>{
    const hold=deferred();const h=harness(async(url,body)=>{await hold.promise;return reply(body,{token:'new-key',tokens:['new-key'],api_auth_required:false});});
    const {store,http}=storeFor(h);const pending=store.getState().generateAuthToken();
    await assert.rejects(store.getState().revokeAuthToken('key-a'),e=>e.statusText==='TOKEN_ACTION_PENDING');
    assert.equal(h.requests.length,1);hold.resolve();assert.equal(await pending,'new-key');
    assert.equal(http.getToken(),'session-secret');assert.equal(store.getState().permissions.api_auth.required,false);
});

test('token completions after connection change cannot overwrite keys or session',async()=>{
    const hold=deferred();const h=harness(async(url,body)=>{await hold.promise;return reply(body,{token:'new-key',tokens:['new-key'],api_auth_required:true});});
    const {store,http,switchConnection}=storeFor(h);const pending=store.getState().generateAuthToken();switchConnection();hold.resolve();
    await assert.rejects(pending,e=>e.statusText==='STALE_PERMISSION_REQUEST');
    assert.equal(store.getState().permissions,null);assert.equal(store.getState().error,null);assert.equal(http.getToken(),'session-secret');
});

test('older permission reads cannot restore a key already revoked',async()=>{
    const hold=deferred();const h=harness(async(url,body)=>{
        if(body.method==='config.get'){await hold.promise;return reply(body,{engine:{lazy_load_model:true,api_auth:{required:true,tokens:['key-a']}}});}
        return reply(body,{tokens:[],api_auth_required:false,revoked_token:'key-a'});
    });const {store}=storeFor(h);const reading=store.getState().fetchPermission();
    await store.getState().revokeAuthToken('key-a');hold.resolve();await reading;
    assert.equal(store.getState().permissions.api_auth.required,false);assert.equal(store.getState().status,'success');
});

test('approval facade sends approval_id, preserves feedback and validates actual identity/status/times',async()=>{
    const h=harness((url,body)=>reply(body,body.method==='approvals.list'?{pending:[record()]}:
        {approval:record(body.params.approval_id,body.method==='approvals.approve'?'approved':'rejected')}));
    assert.equal((await h.permissionApi.getPendingPermissions()).pending[0].created_at,'2026-10-27T10:00:00Z');
    assert.equal((await h.permissionApi.approvePermission('ap_owned')).approval.status,'approved');
    assert.equal((await h.permissionApi.rejectPermission({request_id:'ap_owned',feedback:'Keep this file'})).approval.status,'rejected');
    assert.deepEqual(normalize(h.requests[2].body.params),{approval_id:'ap_owned',feedback:'Keep this file'});
    assert.ok(h.requests.every(r=>r.url==='/v1/cep'));
    const invalid=harness((url,body)=>reply(body,{approval:record('wrong','approved')}));
    await assert.rejects(invalid.permissionApi.approvePermission('ap_owned'),e=>e.statusText==='INVALID_APPROVAL_RESPONSE');
    const wrongStatus=harness((url,body)=>reply(body,{approval:record('ap_owned','pending')}));
    await assert.rejects(wrongStatus.permissionApi.rejectPermission('ap_owned'),e=>e.statusText==='INVALID_APPROVAL_RESPONSE');
});

test('empty pending lists are valid; malformed entries are errors, not an empty success',async()=>{
    const empty=harness((url,body)=>reply(body,{pending:[]}));assert.equal((await empty.permissionApi.getPendingPermissions()).pending.length,0);
    for(const value of [{}, {pending:[{...record(),created_at:'SystemTime { intervals: 1 }'}]}, {pending:[record(),record()]}, {pending:[record('x','used')]}]){
        const h=harness((url,body)=>reply(body,value));await assert.rejects(h.permissionApi.getPendingPermissions(),e=>e.statusText==='INVALID_APPROVAL_RESPONSE');
    }
});

test('approval failure leaves request pending; success removes only its own acknowledged request',async()=>{
    let fail=true;const hold=deferred();const h=harness(async(url,body)=>{
        if(body.method==='approvals.list')return reply(body,{pending:[record('a'),record('b')]});
        await hold.promise;if(fail)throw Error('Owner required');return reply(body,{approval:record(body.params.approval_id,'approved')});
    });const {store}=storeFor(h);await store.getState().fetchPendingPermissions();
    const pending=store.getState().approvePermission('a');assert.equal(store.getState().pendingRequests.length,2);
    await assert.rejects(store.getState().rejectPermission('a'),e=>e.statusText==='APPROVAL_ACTION_PENDING');
    hold.resolve();await assert.rejects(pending,/Owner required/);assert.equal(store.getState().pendingRequests.length,2);
    fail=false;await store.getState().approvePermission('a');assert.deepEqual(store.getState().pendingRequests.map(r=>r.id),['b']);
});

test('stale polls and concurrent decision failures cannot resurrect an approved request',async()=>{
    const holdPoll=deferred(),holdReject=deferred();let polling=false;
    const h=harness(async(url,body)=>{
        if(body.method==='approvals.list'){if(polling)await holdPoll.promise;return reply(body,{pending:[record('a'),record('b')]});}
        if(body.method==='approvals.reject'){await holdReject.promise;throw Error('Reject failed');}
        return reply(body,{approval:record(body.params.approval_id,'approved')});
    });const {store}=storeFor(h);await store.getState().fetchPendingPermissions();polling=true;
    const poll=store.getState().fetchPendingPermissions(),reject=store.getState().rejectPermission('b');
    await store.getState().approvePermission('a');holdReject.resolve();await assert.rejects(reject,/Reject failed/);holdPoll.resolve();await poll;
    assert.deepEqual(store.getState().pendingRequests.map(r=>r.id),['b']);
});

test('pending reads and decisions after reset cannot repopulate a different connection',async()=>{
    const hold=deferred();const h=harness(async(url,body)=>{await hold.promise;return reply(body,body.method==='approvals.list'?{pending:[record()]}:{approval:record('ap_owned','approved')});});
    const {store,switchConnection}=storeFor(h);const poll=store.getState().fetchPendingPermissions(),decision=store.getState().approvePermission('ap_owned');
    switchConnection();hold.resolve();await poll;await assert.rejects(decision,e=>e.statusText==='STALE_PERMISSION_REQUEST');
    assert.equal(store.getState().pendingRequests.length,0);assert.equal(store.getState().error,null);
});

test('settings token actions reuse permission store and propagate errors rather than toast false success',async()=>{
    const {create}=require('zustand');const calls=[];
    const permission={generateAuthToken:async()=>{calls.push('create');return 'created';},revokeAuthToken:async()=>{calls.push('revoke');throw Error('Not saved');}};
    const engine=load('src/store/engine/useEngineStore.ts',{
        zustand:{create},'../../core/tauri-api':{isTauri:()=>false},'@tauri-apps/api/event':{},
        './useConnectionStore':{useConnectionStore:{}},'../../api':{usePermissionStore:{getState:()=>permission}},
        '../../components/ui/toast':{toast:{promise:fn=>fn()}},
    }).useEngineStore;
    engine.setState({initEngineSettings:async()=>{calls.push('refresh');}});
    assert.equal(await engine.getState().generateApiKey(),'created');
    await assert.rejects(engine.getState().revokeApiKey('key-a'),/Not saved/);
    assert.deepEqual(calls,['create','refresh','revoke']);assert.equal(engine.getState().pendingKeys.generate_token,false);
});
