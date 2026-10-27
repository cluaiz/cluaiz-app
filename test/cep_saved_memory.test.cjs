const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load}=require('./cepHarness.cjs');
const reply=(body,result)=>({jsonrpc:'2.0',id:body.id,result});
const settings={enabled:true,max_disk_gb:4,max_age_days:30};
const record={chat_id:'owned',model:'owned-model',key:'owned-key',tokens:0,positions:0,bytes:0,saved_at:0,last_used:0};
const usage={directory:'owned-cache',bytes:0,chats:[record]};
function memoryFor(handler){
    const h=harness(handler);
    const api=load('src/api/engine/chat-memory/chatMemory.api.ts',{
        '../../client/cep':h,'../../client/errors':h.errors,'../config/config.api':h,
    }).chatMemoryApi;
    return {...h,chatMemoryApi:api};
}

test('saved memory retains real zero counts/flags/records and propagates one AbortSignal to shared calls',async()=>{
    const h=memoryFor((url,body)=>reply(body,body.method==='kv.status'?usage:{kv:settings}));
    const signal=new AbortController().signal,value=await h.chatMemoryApi.getStatus(signal);
    assert.equal(value.bytes,0);assert.equal(value.chats[0].tokens,0);assert.equal(value.settings,settings);
    assert.ok(h.requests.every(request=>request.url==='/v1/cep'&&request.options.signal===signal));
});

test('settings save returns its actual acknowledgment without a fallible usage request hiding success',async()=>{
    const saved={enabled:false,max_disk_gb:1,max_age_days:0};
    const h=memoryFor((url,body)=>{assert.equal(body.method,'config.set');return reply(body,{kv:saved});});
    assert.equal((await h.chatMemoryApi.updateSettings({enabled:false})).settings,saved);
    assert.equal(h.requests.length,1);assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0].body.params)),{section:'kv',patch:{enabled:false}});
});

test('malformed cache records/settings are errors rather than an empty or invented usage result',async()=>{
    for(const value of [{...usage,bytes:NaN},{...usage,chats:[{...record,tokens:-1}]},{...usage,chats:[{...record,saved_at:'now'}]},
        {...usage,chats:[record,record]},{...usage,chats:[{}]}]){
        const h=memoryFor((url,body)=>reply(body,body.method==='kv.status'?value:{kv:settings}));
        await assert.rejects(h.chatMemoryApi.getStatus(),error=>error.statusText==='INVALID_KV_RESPONSE');
    }
    for(const value of [{enabled:'true',max_disk_gb:4,max_age_days:30},{enabled:false,max_disk_gb:Infinity,max_age_days:0},{}]){
        const h=memoryFor((url,body)=>reply(body,body.method==='kv.status'?usage:{kv:value}));
        await assert.rejects(h.chatMemoryApi.getStatus(),error=>error.statusText==='INVALID_KV_RESPONSE');
    }
});

test('invalid settings patches do not dispatch writes',async()=>{
    const h=memoryFor(()=>{throw Error('Invalid patch dispatched');});
    for(const patch of [{},{enabled:1},{max_disk_gb:NaN},{max_age_days:-1},{max_age_days:1.5},{max_age_days:2**32},{unexpected:true}]){
        await assert.rejects(h.chatMemoryApi.updateSettings(patch),error=>error.statusText==='INVALID_KV_PATCH');
    }
    assert.equal(h.requests.length,0);
});

test('single-cache deletion validates identity and retains missing-cache false rather than inventing deletion',async()=>{
    const h=memoryFor((url,body)=>reply(body,{chat_id:body.params.chat_id,deleted:false}));
    const value=await h.chatMemoryApi.deleteChat('chat with/slash & text');assert.equal(value.deleted,false);
    assert.equal(h.requests[0].body.params.chat_id,'chat with/slash & text');
    for(const value of [{chat_id:'other',deleted:true},{chat_id:'owned'},null]){
        const bad=memoryFor((url,body)=>reply(body,value));await assert.rejects(bad.chatMemoryApi.deleteChat('owned'),error=>error.statusText==='INVALID_KV_RESPONSE');
    }
    await assert.rejects(h.chatMemoryApi.deleteChat(' '),error=>error.statusText==='INVALID_KV_CHAT');assert.equal(h.requests.length,1);
});

test('clear validates real deleted count including zero, and preserves actual CEP refusal',async()=>{
    const h=memoryFor((url,body)=>reply(body,{deleted:0}));assert.equal((await h.chatMemoryApi.clear()).deleted,0);
    for(const value of [{},{deleted:-1},{deleted:1.5},null]){
        const bad=memoryFor((url,body)=>reply(body,value));await assert.rejects(bad.chatMemoryApi.clear(),error=>error.statusText==='INVALID_KV_RESPONSE');
    }
    const denied=memoryFor((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code:-32002,message:'Owner policy refused cleanup',data:{type:'forbidden'}}}));
    await assert.rejects(denied.chatMemoryApi.clear(),error=>error.code===-32002&&error.data.type==='forbidden');assert.equal(denied.requests.length,1);
});
