const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,load}=require('./cepHarness.cjs');
const result=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const entries=()=>['skill','plugin','mcp'].map(category=>({id:category+'-id',name:category+' display',description:'Installed tool',
    category,enabled:true,version:'2.0',functions:[{name:'real_function',inputSchema:{type:'object'}}]}));
function toolHarness(handler){
    const h=harness(handler);const catalog=load('src/api/engine/tools/catalog.ts',{'../../client/cep':h,'../../client/errors':h.errors});
    const base={'../../../client':{client:h.client},'../catalog':catalog};
    const components=load('src/api/engine/tools/components/components.api.ts',{...base,'./components.endpoints':{COMPONENTS_ENDPOINTS:{}}});
    const api={...h,...catalog,...components};
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
