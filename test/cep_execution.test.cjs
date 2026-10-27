const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load}=require('./cepHarness.cjs');
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});
const result=(exit_code=0,stdout='',stderr='')=>({exit_code,stdout,stderr});
const normalized=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:value=>resolve(value)};};
function systemFor(h){
    return load('src/api/engine/system/system.api.ts',{
        '../../client':{client:h.client},'./system.endpoints':{SYSTEM_ENDPOINTS:{}},'../permission/permission.api':h,
        '../../client/cep':h,'../../client/errors':h.errors,'./systemData':h,'./execution':h,
    }).systemApi;
}
function storeFor(h){
    let changed;const connection={subscribe:fn=>{changed=fn;}};
    const store=load('src/api/engine/system/system.store.ts',{
        zustand:require('zustand'),'../../client':{errorMessage:h.errors.errorMessage},'./system.api':{systemApi:systemFor(h)},
        './execution':h,'../../client/errors':h.errors,'../../../store/engine/useConnectionStore':{useConnectionStore:connection},
    }).useSystemStore;
    return {store,switchConnection:()=>changed({host:'new'},{host:'old'})};
}
const pathsFor=h=>load('src/features/workspace/hooks/terminalPaths.ts',{
    '../../../api/engine/fs/fs.api':h,'../../../api/client/errors':h.errors,
});

test('command facade sends current CEP shell/program payloads and retains actual output/exit fields',async()=>{
    const h=harness((url,body)=>reply(body,result(0,'out','warning')));const api=systemFor(h),signal=new AbortController().signal;
    const value=await api.executeCommand('echo own',250,{signal,approvalId:'ap_owned'});
    assert.deepEqual(normalized(value),{...result(0,'out','warning'),status:'success',output:'out\nwarning'});
    assert.equal(h.requests[0].url,'/v1/cep');assert.equal(h.requests[0].body.method,'system.exec');
    assert.deepEqual(normalized(h.requests[0].body.params),{command:'echo own',_meta:{approval:'ap_owned'}});
    assert.equal(h.requests[0].options.timeoutMs,250);assert.equal(h.requests[0].options.signal,signal);
    await api.executeProgram('owned-program',['literal & arg']);
    assert.deepEqual(normalized(h.requests[1].body.params),{program:'owned-program',args:['literal & arg']});
});

test('nonzero/signal exits stay failures including empty output, without throwing away stderr',async()=>{
    for(const code of [2,-1,null]){
        const h=harness((url,body)=>reply(body,result(code,'','')));const value=await h.executeSystem({program:'owned',args:[]});
        assert.equal(value.status,'error');assert.equal(value.exit_code,code);assert.equal(value.output,'');
    }
    const h=harness((url,body)=>reply(body,result(7,'before\n','after')));
    assert.equal((await h.executeSystem({command:'owned'})).output,'before\nafter');
});

test('malformed command requests/results refuse without fabricated success or fallback exit code',async()=>{
    const h=harness(()=>{throw Error('Invalid input dispatched');});
    for(const input of [{command:''},{command:'x',program:'y'},{command:'x',args:[]},{program:'x',args:[1]},{command:'x',cwd:'/ignored'}]){
        await assert.rejects(h.executeSystem(input),e=>e.statusText==='INVALID_COMMAND');
    }
    await assert.rejects(h.executeSystem({command:'x'},{timeoutMs:-1}),e=>e.statusText==='INVALID_COMMAND');assert.equal(h.requests.length,0);
    for(const value of [null,{}, {stdout:'',stderr:''},{...result(),exit_code:1.5},{...result(),stdout:42}]){
        const bad=harness((url,body)=>reply(body,value));await assert.rejects(bad.executeSystem({command:'x'}),e=>e.statusText==='INVALID_COMMAND_RESPONSE');
    }
});

test('real approval-required identity is preserved; a scope/network error is never auto-retried',async()=>{
    const data={type:'approval_required',approval_id:'ap_owned',action:'system.exec',target:'echo owned',expires_at:'2026-10-27T12:00:00Z'};
    const h=harness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code:-32003,message:'Approval required',data}}));
    const {store}=storeFor(h);await assert.rejects(store.getState().executeCommand('echo owned'),e=>{
        assert.deepEqual(normalized(h.commandApproval(e)),{id:'ap_owned',target:'echo owned',expiresAt:data.expires_at});return e.code===-32003;
    });assert.equal(h.requests.length,1);assert.equal(store.getState().commandHistory.length,0);assert.equal(store.getState().isExecutingCmd,false);
    assert.equal(h.commandApproval(new h.CepError(-32003,'wrong',{...data,action:'fs.delete'})),null);
    const offline=harness(()=>{throw Error('Connection lost');});const other=storeFor(offline).store;
    await assert.rejects(other.getState().executeCommand('echo owned'),/Connection lost/);
    assert.equal(offline.requests.length,1);assert.equal(other.getState().commandHistory[0].status,'error');
});

test('command store serializes observations and logs actual exit status',async()=>{
    const hold=deferred();const h=harness(async(url,body)=>{await hold.promise;return reply(body,result(5,'','failed'));});const {store}=storeFor(h);
    const pending=store.getState().executeCommand('owned');await assert.rejects(store.getState().executeCommand('other'),e=>e.statusText==='COMMAND_BUSY');
    hold.resolve();const done=await pending;assert.equal(done.exit_code,5);assert.equal(store.getState().commandHistory[0].status,'error');
    assert.equal(store.getState().commandHistory[0].output,'failed');assert.equal(h.requests.length,1);
});

test('connection reset and observation abort do not append stale output/error to current history',async()=>{
    const hold=deferred();const h=harness(async(url,body)=>{await hold.promise;return reply(body,result(0,'old'));});const {store,switchConnection}=storeFor(h);
    const pending=store.getState().executeCommand('old');switchConnection();hold.resolve();
    await assert.rejects(pending,e=>e.statusText==='STALE_COMMAND');assert.equal(store.getState().commandHistory.length,0);assert.equal(store.getState().error,null);
    const controller=new AbortController();controller.abort();await assert.rejects(store.getState().executeCommand('aborted',undefined,{signal:controller.signal}));
    assert.equal(store.getState().commandHistory.length,0);assert.equal(store.getState().isExecutingCmd,false);assert.equal(h.requests.length,1);
});

test('terminal navigation preserves drive/UNC/POSIX roots and verifies directories through fs only',async()=>{
    const h=harness((url,body)=>reply(body,{items:[],truncated:false,skipped:0})),p=pathsFor(h);
    assert.equal(p.terminalPath('/one/two','../three'),'/one/three');
    assert.equal(p.terminalPath('C:\\one\\two','..\\three'),'C:/one/three');
    assert.equal(p.terminalPath('C:/one','\\three'),'C:/three');
    assert.equal(p.terminalPath('C:/one','/three'),'C:/three');
    assert.equal(p.terminalPath('C:/one','\\\\server\\share\\folder'),'//server/share/folder');
    assert.equal(p.terminalPath('//server/share/one','../../..'),'//server/share/');
    assert.equal(await p.changeTerminalDirectory('/owned','a & b'),'/owned/a & b');
    assert.equal(h.requests[0].body.method,'fs.list');assert.equal(h.requests[0].body.params.root,'/owned/a & b');
    assert.throws(()=>p.terminalPath('/owned','~'),e=>e.statusText==='UNSUPPORTED_HOME_PATH');
});

test('completion uses installed filesystem owner, retains partial-list metadata and Engine path case rules',async()=>{
    const h=harness((url,body)=>reply(body,{items:[{name:'Folder',path:'Folder',is_folder:true,size:0,modified:''},
        {name:'file.txt',path:'file.txt',is_folder:false,size:2,modified:''}],truncated:true,skipped:1})),p=pathsFor(h);
    const windows=await p.completeTerminalPath('C:/owned','f');assert.deepEqual(normalized(windows),{matches:['Folder\\','file.txt'],truncated:true,skipped:1});
    assert.deepEqual(normalized((await p.completeTerminalPath('/owned','f')).matches),['file.txt']);
    assert.ok(h.requests.every(r=>r.body.method==='fs.list'));
});

test('shell cwd construction quotes safe paths and refuses Windows expansion/UNC forms',()=>{
    const h=harness(()=>{throw Error('No request');}),p=pathsFor(h);
    assert.equal(p.terminalCommand('C:/a & b','echo owned',true),'cd /d "C:\\a & b" && echo owned');
    assert.equal(p.terminalCommand("/a'$(bad)",'echo owned',false),"cd '/a'\\''$(bad)' && echo owned");
    for(const path of ['C:/%TEMP%','C:/!name!','C:/a"b','//server/share'])assert.throws(()=>p.terminalCommand(path,'x',true),e=>e.statusText==='UNSUPPORTED_SHELL_PATH');
    assert.throws(()=>p.terminalCommand('relative','x',false),e=>e.statusText==='INVALID_TERMINAL_PATH');
});
