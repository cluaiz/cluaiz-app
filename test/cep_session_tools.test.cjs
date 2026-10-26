const {test}=require('node:test');const assert=require('node:assert/strict');
const {toolHarness,load}=require('./cepHarness.cjs');const wire=v=>JSON.parse(JSON.stringify(v));
const reply=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const bound=(id='owned',turns=-1)=>({id,turns});
const response=(active_tools=[],chat_id='chat-owned')=>({chat_id,active_tools});
const storeFor=h=>load('src/api/engine/tools/session/session-tools.store.ts',{
    'zustand':require('zustand'),'./session-tools.api':h,'../../../client':h.errors}).useSessionToolsStore;

test('session reads keep binding identity/turns/metadata; available tools reuse the package catalog',async()=>{
    const tools=[bound(),{...bound('ephemeral',0),inline:true,pinned:false,idle:0}];
    const entry={id:'owned',name:'Actual package',category:'skill',description:'Installed',enabled:true,functions:[{name:'real_function'}]};
    const h=toolHarness((url,body)=>{
        assert.equal(url,'/v1/cep');return reply(body,body.method==='tools.list'?[entry]:response(tools));
    });
    const got=await h.sessionToolsApi.getSessionTools('chat-owned');assert.equal(got.session_id,'chat-owned');
    assert.deepEqual(wire(got.tools),tools);assert.deepEqual(wire(h.requests[0].body.params),{chat_id:'chat-owned'});
    assert.equal((await h.sessionToolsApi.getAllTools()).tools[0].functions[0].name,'real_function');
    assert.deepEqual(h.requests.map(r=>r.body.method),['chat.tools','tools.list']);
});

test('session updates merge explicitly, preserve other bindings and detach only requested ids',async()=>{
    let active=[bound('keep',4),bound('remove',3)];const h=toolHarness((url,body)=>{
        assert.equal(body.method,'chat.set_tools');const p=body.params;
        active=active.filter(b=>!p.detach.includes(b.id));
        for(const value of p.tools){const next=typeof value==='string'?bound(value):value;const index=active.findIndex(b=>b.id===next.id);
            if(index<0)active.push(next);else active[index]=next;}
        return reply(body,response(active));
    });
    const patch={tools:[{id:'zero',turns:0,pinned:true},'persistent'],detach:['remove']};
    const saved=await h.sessionToolsApi.updateSessionTools('chat-owned',patch);
    assert.deepEqual(wire(saved.tools),[bound('keep',4),{id:'zero',turns:0,pinned:true},bound('persistent')]);
    assert.deepEqual(wire(h.requests[0].body.params),{chat_id:'chat-owned',...patch});assert.equal(h.requests.length,1);
    assert.equal((await h.sessionToolsApi.updateSessionTools('chat-owned',{tools:[]})).tools.length,3,'empty tools must not detach everyone');
    const removed=await h.sessionToolsApi.updateSessionTools('chat-owned',{detach:['zero']});assert.equal(removed.tools.some(t=>t.id==='zero'),false);
});

test('unsupported binding fields/budgets and conflicting targets fail before any dispatch',async()=>{
    const h=toolHarness(()=>{throw Error('Unexpected dispatch');});
    for(const payload of [null,[],{unexpected:true},{tools:null},{detach:[false]},{tools:[{name:'old-function'}]},
        {tools:[{id:'owned',turns:-2}]},{tools:[{id:'owned',turns:2**31}]},{tools:[{id:'owned',turns:1.5}]},
        {tools:[{id:'owned',turns:1,inline:true}]},{tools:[{id:'owned',turns:1,idle:5}]},{tools:['owned','owned']},
        {tools:['owned'],detach:['owned']},{detach:['owned','owned']},{tools:[' ']}]){
        await assert.rejects(h.sessionToolsApi.updateSessionTools('chat-owned',payload),e=>e.statusText==='INVALID_CHAT_TOOLS_REQUEST');
    }
    await assert.rejects(h.sessionToolsApi.getSessionTools(' '),e=>e.statusText==='INVALID_CHAT_TOOLS_REQUEST');
    assert.equal(h.requests.length,0);
});

test('wrong chat, malformed metadata or ignored writes never become saved bindings',async()=>{
    for(const value of [{},response([], 'someone-else'),response([{}]),response([bound(),bound()]),
        response([{...bound(),turns:-2}]),response([{...bound(),pinned:'false'}]),response([{...bound(),idle:-1}])]){
        const h=toolHarness((url,body)=>reply(body,value));
        await assert.rejects(h.sessionToolsApi.getSessionTools('chat-owned'),e=>e.statusText==='INVALID_CHAT_TOOLS_RESPONSE');
    }
    for(const [value,patch]of [[response(),{tools:['owned']}],[response([bound('owned',4)]),{tools:[bound('owned',0)]}],
        [response([bound()]),{detach:['owned']}],[response([bound()]),{tools:[{...bound(),pinned:true}]}]]){
        const h=toolHarness((url,body)=>reply(body,value));
        await assert.rejects(h.sessionToolsApi.updateSessionTools('chat-owned',patch),e=>e.statusText==='CHAT_TOOLS_NOT_SAVED');
    }
});

test('failed writes retain existing bindings/error details; late reads do not replace newer acknowledged state',async()=>{
    let release,fail=false;const h=toolHarness((url,body)=>{
        if(body.method==='chat.tools')return new Promise(resolve=>release=()=>resolve(reply(body,response([bound('older',9)]))));
        if(fail)return {jsonrpc:'2.0',id:body.id,error:{code:-32003,message:'Approval required',data:{type:'approval_required',approval_id:'owned'}}};
        return reply(body,response([bound('newer',0)]));
    });const store=storeFor(h);const reading=store.getState().fetchSessionTools('chat-owned');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(await store.getState().updateSessionTools('chat-owned',[bound('newer',0)]),true);release();await reading;
    assert.deepEqual(wire(store.getState().sessionTools['chat-owned']),[bound('newer',0)]);
    fail=true;assert.equal(await store.getState().updateSessionTools('chat-owned',['refused']),false);
    assert.deepEqual(wire(store.getState().sessionTools['chat-owned']),[bound('newer',0)]);
    assert.equal(store.getState().error,'Approval required');assert.equal(store.getState().status,'error');
    await assert.rejects(h.sessionToolsApi.updateSessionTools('chat-owned',{tools:['refused']}),e=>e.code===-32003&&e.data.approval_id==='owned');
});

test('reset invalidates pending session and catalog reads without refilling cleared state',async()=>{
    const pending=[];const h=toolHarness((url,body)=>new Promise(resolve=>pending.push(()=>resolve(reply(body,
        body.method==='tools.list'?[]:response([bound()]))))));const store=storeFor(h);
    const session=store.getState().fetchSessionTools('chat-owned'),catalog=store.getState().fetchAllTools();
    await new Promise(resolve=>setImmediate(resolve));store.getState().reset();pending.forEach(done=>done());await Promise.all([session,catalog]);
    assert.deepEqual(wire(store.getState().sessionTools),{});assert.deepEqual(wire(store.getState().allTools),[]);assert.equal(store.getState().status,'idle');
});
