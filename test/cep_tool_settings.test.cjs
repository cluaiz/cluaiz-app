const {test}=require('node:test');const assert=require('node:assert/strict');
const {toolHarness,load}=require('./cepHarness.cjs');
const wire=value=>JSON.parse(JSON.stringify(value));
const reply=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const defaults=()=>({enabled:true,execution_mode:'auto',security_mode:'inherit',trust_annotations:false});
const settings=values=>({schema:{},values:values||defaults()});
const cache=(kind='skill',name='owned')=>({kind,name,temp_bytes:0,all_bytes:0,entries:[]});

test('component settings send strict CEP target/patch and return acknowledged false values',async()=>{
    let values=defaults();const h=toolHarness((url,body)=>{
        assert.equal(url,'/v1/cep');assert.equal(body.params.kind,'skill');assert.equal(body.params.name,'owned');
        if(body.method==='tools.set_settings')values={...values,...body.params.patch};
        else assert.equal(body.method,'tools.get_settings');return reply(body,settings(values));
    });
    assert.equal((await h.componentsApi.getSettings('skill','owned')).values.enabled,true);
    const patch={enabled:false,execution_mode:'confirm_destructive',security_mode:'require_approval',trust_annotations:true};
    const saved=await h.componentsApi.updateSettings({component_type:'skill',component_id:'owned',settings:patch});
    assert.deepEqual(wire(saved.values),patch);assert.deepEqual(wire(h.requests[1].body.params),{kind:'skill',name:'owned',patch});
    const {useComponentsStore:store}=load('src/api/engine/tools/components/components.store.ts',{
        'zustand':require('zustand'),'./components.api':h,'../../../client':h.errors});
    assert.equal(await store.getState().updateSettings('owned',{enabled:true},'skill'),true);
    assert.equal(h.requests.at(-1).body.params.kind,'skill');
});

test('unknown setting fields, invalid enums, missing target and unsaved replies fail explicitly',async()=>{
    const h=toolHarness(()=>{throw Error('Unexpected dispatch');});
    for(const patch of [{default_turns:5},{enabled:'false'},{security_mode:'owner'},{execution_mode:'other'},[],null]){
        await assert.rejects(h.componentsApi.updateSettings({component_type:'skill',component_id:'owned',settings:patch}),e=>e.statusText==='INVALID_TOOL_SETTINGS_PATCH');
    }
    await assert.rejects(h.componentsApi.getSettings('model','owned'),e=>e.statusText==='INVALID_TOOL_TARGET');
    await assert.rejects(h.componentsApi.getSettings(),e=>e.statusText==='INVALID_TOOL_TARGET');
    assert.equal(h.requests.length,0);
    for(const value of [{},{values:{}},{schema:{},values:{...defaults(),enabled:null}},settings({...defaults(),security_mode:'bad'})]){
        const malformed=toolHarness((url,body)=>reply(body,value));
        await assert.rejects(malformed.componentsApi.getSettings('skill','owned'),e=>e.statusText==='INVALID_TOOL_SETTINGS');
    }
    const ignored=toolHarness((url,body)=>reply(body,settings()));
    await assert.rejects(ignored.componentsApi.updateSettings({component_type:'skill',component_id:'owned',settings:{enabled:false}}),e=>e.statusText==='TOOL_SETTINGS_NOT_SAVED');
});

test('category cache facades retain real reports/counts; omitted versus literal all stays distinct',async()=>{
    const h=toolHarness((url,body)=>reply(body,body.method==='tools.cache'?[cache(body.params.kind,body.params.name||'owned')]:{removed:0,freed_bytes:0}));
    for(const [api,kind]of [[h.skillsApi,'skill'],[h.pluginsApi,'plugin'],[h.mcpApi,'mcp']]){
        assert.equal((await api.listCache()).message[0].kind,kind);assert.equal((await api.clearCache()).status,'success');
    }
    assert.deepEqual(h.requests.map(r=>r.body.method),Array(3).fill(['tools.cache','tools.clear_cache']).flat());
    assert.ok(h.requests.every(r=>r.body.params.name===undefined));
    await h.mcpApi.clearCache('all');assert.equal(h.requests.at(-1).body.params.name,'all');
    const cleared=await h.componentsApi.clearCache({component_type:'skill',component_id:'owned',all:true});
    assert.equal(cleared.freed_bytes,0);assert.equal(cleared.removed,0);
    assert.deepEqual(wire(h.requests.at(-1).body.params),{kind:'skill',name:'owned'});
    assert.equal((await h.componentsApi.getCache('skill','owned')).all_bytes,0);
});

test('cache malformed/mismatched replies and temp-only requests never imply cleanup success',async()=>{
    const h=toolHarness(()=>{throw Error('Unexpected dispatch');});
    for(const payload of [{component_type:'skill',component_id:'owned'}, {component_type:'skill',component_id:'owned',all:false},
        {component_type:'skill',component_id:'owned',component_name:'other',all:true}]){
        await assert.rejects(h.componentsApi.clearCache(payload),e=>e.statusText==='INVALID_TOOL_CACHE_REQUEST');
    }
    await assert.rejects(h.componentsApi.clearCache({component_type:'skill',all:true}),e=>e.statusText==='INVALID_TOOL_TARGET');
    assert.equal(h.requests.length,0);
    for(const value of [{},[],[cache('mcp')],[cache('skill','other')],[{...cache(),all_bytes:-1}],
        [{...cache(),temp_bytes:1}],[{...cache(),entries:[{path:'bad',size:'0'}]}]]){
        const bad=toolHarness((url,body)=>reply(body,value));
        await assert.rejects(bad.componentsApi.getCache('skill','owned'),e=>e.statusText==='INVALID_TOOL_CACHE');
    }
    for(const value of [{},{removed:-1,freed_bytes:2},{removed:1,freed_bytes:null}]){
        const bad=toolHarness((url,body)=>reply(body,value));
        await assert.rejects(bad.skillsApi.clearCache(),e=>e.statusText==='INVALID_TOOL_CACHE');
    }
    const empty=toolHarness((url,body)=>reply(body,[]));assert.deepEqual(wire((await empty.mcpApi.listCache()).message),[]);
});

test('settings/cache permission and approval failures preserve domain details',async()=>{
    for(const [code,type]of [[-32002,'forbidden'],[-32003,'approval_required']]){
        const h=toolHarness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code,message:type,data:{type,approval_id:'owned'}}}));
        for(const action of [()=>h.componentsApi.getSettings('skill','owned'),
            ()=>h.componentsApi.updateSettings({component_type:'skill',component_id:'owned',settings:{enabled:false}}),
            ()=>h.componentsApi.getCache('skill','owned'),()=>h.skillsApi.clearCache()]){
            await assert.rejects(action(),e=>e.code===code&&e.data.approval_id==='owned');
        }
    }
});

test('permissions and the values a tool reads come from the Engine; choices must be acknowledged',async()=>{
    const permission=on=>({kind:'network',title:'Internet',info:'Reads pages',sensitive:false,default:true,on,chosen:true,options:{access:'strict',hosts:['api.github.com']}});
    let net=true,key=false;
    const answer=()=>({...settings(),permissions:[permission(net),{kind:'bad'}],
        user_settings:[{name:'GH_TOKEN',info:'A token',required:false,secret:true,set:key,in_system:false},{name:'lower',set:true}]});
    const h=toolHarness((url,body)=>{
        const patch=body.params.patch||{};
        if(patch.permissions)net=patch.permissions.network;
        if(patch.user_settings)key=patch.user_settings.GH_TOKEN!=='';
        return reply(body,answer());
    });
    const read=await h.getToolSettings('skill','github');
    assert.equal(read.permissions.length,1);assert.deepEqual(wire(read.permissions[0].options),{access:'strict',hosts:['api.github.com']});
    assert.deepEqual(wire(read.user_settings),[{name:'GH_TOKEN',info:'A token',required:false,set:false,in_system:false}]);
    const off=await h.setToolPermission('skill','github','network',false);
    assert.equal(off.permissions[0].on,false);assert.deepEqual(wire(h.requests.at(-1).body.params.patch),{permissions:{network:false}});
    const saved=await h.setToolUserSetting('skill','github','GH_TOKEN','secret-value');
    assert.equal(saved.user_settings[0].set,true);assert.ok(!JSON.stringify(saved).includes('secret-value'));
    await h.setToolUserSetting('skill','github','GH_TOKEN','');assert.equal(key,false);
    const older=toolHarness((url,body)=>reply(body,settings()));
    const plain=await older.getToolSettings('skill','owned');assert.deepEqual(wire(plain.permissions),[]);assert.deepEqual(wire(plain.user_settings),[]);
    const ignoring=toolHarness((url,body)=>reply(body,{...settings(),permissions:[permission(true)]}));
    await assert.rejects(ignoring.setToolPermission('skill','github','network',false),e=>e.statusText==='TOOL_SETTINGS_NOT_SAVED');
    await assert.rejects(ignoring.setToolUserSetting('skill','github','lower-case','x'),e=>e.statusText==='INVALID_TOOL_SETTINGS_PATCH');
});
