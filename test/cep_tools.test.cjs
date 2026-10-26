const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,load}=require('./cepHarness.cjs');
const result=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const entries=()=>['skill','plugin','mcp'].map(category=>({id:category+'-id',name:category+' display',description:'Installed tool',
    category,enabled:true,version:'2.0',functions:[{name:'real_function',inputSchema:{type:'object'}}]}));
function toolHarness(handler){
    const h=harness(handler);const catalog=load('src/api/engine/tools/catalog.ts',{'../../client/cep':h,'../../client/errors':h.errors});
    const tasks=load('src/api/client/cepTask.ts',{'./cep':h,'./errors':h.errors});
    const lifecycle=load('src/api/engine/tools/lifecycle.ts',{'../../client/cep':h,'../../client/cepTask':tasks,'../../client/errors':h.errors});
    const base={'../../../client':{client:h.client},'../catalog':catalog,'../lifecycle':lifecycle};
    const components=load('src/api/engine/tools/components/components.api.ts',{...base,'./components.endpoints':{COMPONENTS_ENDPOINTS:{}}});
    const api={...h,...tasks,...catalog,...lifecycle,...components};
    for(const [kind,name,key]of [['skills','skills','SKILLS_ENDPOINTS'],['plugins','plugins','PLUGINS_ENDPOINTS'],['mcp','mcp','MCP_ENDPOINTS']]){
        Object.assign(api,load(`src/api/engine/tools/${kind}/${name}.api.ts`,{...base,['./'+name+'.endpoints']:{[key]:{}}}));
    }
    return api;
}

test('components, skills, plugins and MCP discovery reuse one tools.list owner and retain actual metadata',async()=>{
    const all=entries();const h=toolHarness((url,body)=>{assert.equal(url,'/v1/cep');assert.equal(body.method,'tools.list');
        return result(body,body.params.kind?all.filter(item=>item.category===body.params.kind):all);});
    const catalog=await h.componentsApi.listComponents();
    assert.equal(catalog.rich.plugin[0].version,'2.0');assert.equal(catalog.rich.mcp[0].functions[0].name,'real_function');
    assert.equal(catalog.skill[0],'skill-id');assert.equal(catalog.rich.skill[0].name,'skill display');
    assert.equal((await h.skillsApi.listSkills()).skills[0].id,'skill-id');
    assert.equal((await h.pluginsApi.listPlugins()).plugins[0].id,'plugin-id');
    assert.equal((await h.mcpApi.listMcp()).mcp_servers[0].id,'mcp-id');
    assert.equal(h.requests.length,4);
});

test('valid empty catalogues remain empty; wrong kinds/malformed records and failures are not empty success',async()=>{
    const empty=toolHarness((url,body)=>result(body,[]));assert.equal((await empty.listTools()).length,0);
    for(const value of [{},[{}],[{...entries()[0],category:'model'}],[{...entries()[0],functions:[{}]}]]){
        const h=toolHarness((url,body)=>result(body,value));await assert.rejects(h.listTools(),e=>e.statusText==='INVALID_TOOLS_RESPONSE');
    }
    const wrong=toolHarness((url,body)=>result(body,entries()));
    await assert.rejects(wrong.listTools('model'),e=>e.statusText==='INVALID_TOOL_KIND');assert.equal(wrong.requests.length,0);
    await assert.rejects(wrong.listTools('mcp'),e=>e.statusText==='INVALID_TOOLS_RESPONSE');
    const data={type:'forbidden'};const refused=toolHarness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code:-32002,message:'Denied',data}}));
    await assert.rejects(refused.componentsApi.listComponents(),e=>e.data===data);
});

test('catalog cancellation stays on the shared transport and count refresh makes one request without swallowing failures',async()=>{
    let fail=false;const failure=new Error('Offline');const h=toolHarness((url,body)=>{if(fail)throw failure;return result(body,entries());});
    const controller=new AbortController();await h.componentsApi.listComponents(undefined,controller.signal);
    assert.equal(h.requests[0].options.signal,controller.signal);
    const {useToolsStore:store}=load('src/api/engine/tools/tools.store.ts',{'zustand':require('zustand'),'../../client':h.errors,'./catalog':h});
    const start=h.requests.length;await store.getState().refreshAll();assert.equal(h.requests.length,start+1);
    assert.equal(store.getState().skillsCount,1);assert.equal(store.getState().mcpCount,1);
    assert.equal(store.getState().toolsCount,3);assert.equal(store.getState().status,'success');
    fail=true;await store.getState().refreshAll();assert.equal(store.getState().status,'error');
    assert.equal(store.getState().error,'Offline');assert.equal(store.getState().skillsCount,1);
});

const task=(status='working',id='owned-task')=>({task_id:id,method:'tools.install',status});
const rpcError=(body,code,type)=>({jsonrpc:'2.0',id:body.id,error:{code,message:type,data:{type}}});
test('all three install facades wait for the final package and remove through one lifecycle owner',async()=>{
    for(const [kind,api,install,remove] of [['skill','skillsApi','installSkill','removeSkill'],
        ['plugin','pluginsApi','installPlugin','removePlugin'],['mcp','mcpApi','installMcp','removeMcp']]){
        let release;const completed=new Promise(resolve=>release=resolve);let settled=false;
        const h=toolHarness(async(url,body)=>{
            assert.equal(url,'/v1/cep');
            if(body.method==='tools.install')return result(body,{task:task()});
            if(body.method==='tasks.result'){await completed;return result(body,{id:'owned',category:kind,enabled:true});}
            assert.equal(body.method,'tools.remove');return result(body,{kind,name:'owned'});
        });
        const signal=new AbortController().signal;
        const pending=h[api][install]('owned',signal).then(value=>{settled=true;return value;});
        await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false,'task handle is not success');
        release();assert.equal((await pending).status,'success');
        assert.equal((await h[api][remove]('owned',signal)).status,'success');
        assert.deepEqual(h.requests.map(r=>r.body.method),['tools.install','tasks.result','tools.remove']);
        assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0].body.params)),{kind,name:'owned'});
        assert.equal(h.requests[1].body.params.task_id,'owned-task');
        assert.equal(h.requests[1].body.params.wait_ms,30000);assert.equal(h.requests[1].options.timeoutMs,35000);
        assert.ok(h.requests.every(r=>r.options.signal===signal));
    }
});

test('pending task timeouts observe the same task without installing twice',async()=>{
    let polls=0;const h=toolHarness((url,body)=>{
        if(body.method==='tools.install')return result(body,{task:task()});
        if(body.method==='tasks.get')return result(body,task());
        if(++polls===1)return rpcError(body,-32009,'timeout');
        return result(body,{id:'owned',category:'skill',enabled:true});
    });
    await h.skillsApi.installSkill('owned');
    assert.deepEqual(h.requests.map(r=>r.body.method),['tools.install','tasks.result','tasks.get','tasks.result']);
});

test('terminal failures, approval and transport errors never become install/remove success',async()=>{
    for(const [code,type]of [[-32008,'cancelled'],[-32010,'tool_operation_failed'],[-32002,'forbidden'],[-32003,'approval_required']]){
        const h=toolHarness((url,body)=>body.method==='tools.install'?result(body,{task:task()}):rpcError(body,code,type));
        await assert.rejects(h.skillsApi.installSkill('owned'),e=>e.code===code&&e.data.type===type);
        await assert.rejects(h.skillsApi.removeSkill('owned'),e=>e.code===code&&e.data.type===type);
    }
    const offline=new Error('Offline');const h=toolHarness(()=>{throw offline;});
    await assert.rejects(h.mcpApi.installMcp('owned'),e=>e===offline);assert.equal(h.requests.length,1);
    const terminal=toolHarness((url,body)=>{
        if(body.method==='tools.install')return result(body,{task:task()});
        if(body.method==='tasks.get')return result(body,task('failed'));
        return rpcError(body,-32009,'timeout');
    });
    await assert.rejects(terminal.pluginsApi.installPlugin('owned'),e=>e.code===-32009);
    assert.equal(terminal.requests.length,4);assert.equal(terminal.requests[3].body.params.wait_ms,0);
});

test('wrong task identity and malformed package results fail instead of reporting success',async()=>{
    for(const value of [{}, {task:task('unknown')}, {task:{...task(),method:'other'}}, {task:{...task(),task_id:''}}]){
        const h=toolHarness((url,body)=>result(body,value));
        await assert.rejects(h.skillsApi.installSkill('owned'),e=>e.statusText==='INVALID_CEP_TASK');assert.equal(h.requests.length,1);
    }
    const mismatch=toolHarness((url,body)=>body.method==='tools.install'?result(body,{task:task()}):
        body.method==='tasks.get'?result(body,task('working','someone-else')):rpcError(body,-32009,'timeout'));
    await assert.rejects(mismatch.skillsApi.installSkill('owned'),e=>e.statusText==='INVALID_CEP_TASK');
    for(const value of [{}, {id:'other',category:'skill',enabled:true}, {id:'owned',category:'mcp',enabled:true}]){
        const h=toolHarness((url,body)=>result(body,body.method==='tools.install'?{task:task()}:value));
        await assert.rejects(h.skillsApi.installSkill('owned'),e=>e.statusText==='INVALID_TOOL_RESULT');
        await assert.rejects(h.skillsApi.removeSkill('owned'),e=>e.statusText==='INVALID_TOOL_RESULT');
    }
});

test('aborted or invalid targets do not dispatch installs; cancelling observation does not resubmit',async()=>{
    const h=toolHarness(()=>{throw Error('Must not call transport');});const controller=new AbortController();controller.abort();
    await assert.rejects(h.skillsApi.installSkill('owned',controller.signal),e=>e.name==='AbortError');
    for(const name of ['', '../outside','MixedCase',undefined,42])await assert.rejects(h.skillsApi.installSkill(name),e=>e.statusText==='INVALID_TOOL_TARGET');
    assert.equal(h.requests.length,0);
    const waiting=new AbortController();const live=toolHarness((url,body,options)=>{
        if(body.method==='tools.install')return result(body,{task:task()});
        return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
    });
    const pending=live.skillsApi.installSkill('owned',waiting.signal);await new Promise(resolve=>setImmediate(resolve));waiting.abort();
    await assert.rejects(pending,e=>e.name==='AbortError');assert.deepEqual(live.requests.map(r=>r.body.method),['tools.install','tasks.result']);
});
