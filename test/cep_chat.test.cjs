const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,load}=require('./cepHarness.cjs');
const result=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const wire=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

function chatHarness(handler,streamSse=()=>assert.fail('Unexpected stream')){
    const h=harness(handler);
    const endpoints=load('src/api/engine/chat/chat.endpoints.ts',{});
    return {...h,...load('src/api/engine/chat/chat.api.ts',{'../../client':{http:h.client,streamSse},
        '../../client/cep':h,'../../client/errors':h.errors,'./chat.endpoints':endpoints})};
}
function context(model='default',chat='c1'){
    const breakdown=Object.fromEntries(['total_context_limit','model_native_context','total_active_tokens','messages_tokens',
        'system_prompt_tokens','skills_tokens','plugins_tokens','mcp_tools_tokens','free_space_tokens',
        'active_percentage','messages_percentage','system_prompt_percentage','skills_percentage',
        'plugins_percentage','mcp_tools_percentage','free_space_percentage'].map(key=>[key,0]));
    for(const key of ['skills','plugins','mcp_tools'])breakdown[key]={count:0,tokens:0,percent:0,items:[]};
    return {model,chat_id:chat,telemetry:{active_session_id:chat,kv_cache_vram_bytes_allocated:0,context_breakdown:breakdown}};
}

test('chat controls use shared CEP, actual stream ids and explicit acknowledged statuses',async()=>{
    const h=chatHarness((url,body)=>{
        assert.equal(url,'/v1/cep');return result(body,{stream_id:body.params.stream_id,
            status:body.method==='chat.cancel'?'cancelled':'skip_requested'});
    });
    assert.equal((await h.chatApi.cancelStream({stream_id:'engine-1',reason:'User stopped'})).status,'cancelled');
    assert.equal((await h.chatApi.skipReasoning({stream_id:'engine-2'})).status,'skip_requested');
    assert.deepEqual(wire(h.requests.map(r=>[r.body.method,r.body.params])),[
        ['chat.cancel',{stream_id:'engine-1',reason:'User stopped'}],['chat.skip_reasoning',{stream_id:'engine-2'}],
    ]);
});

test('missing/refused control failures retain CEP data; malformed replies never become success',async()=>{
    for(const type of ['stream_not_found','reasoning_unavailable']){
        const data={type};const h=chatHarness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code:-32004,message:'Refused',data}}));
        await assert.rejects(h.chatApi.skipReasoning({stream_id:'actual'}),e=>e.code===-32004&&e.data===data);
    }
    for(const reply of [{stream_id:'another',status:'cancelled'},{stream_id:'actual',status:'success'},null]){
        const h=chatHarness((url,body)=>result(body,reply));
        await assert.rejects(h.chatApi.cancelStream({stream_id:'actual'}),e=>e.statusText==='INVALID_CHAT_RESPONSE');
    }
    const h=chatHarness(()=>assert.fail('Missing stream dispatched'));
    await assert.rejects(h.chatApi.cancelStream({stream_id:''}),e=>e.statusText==='INVALID_CHAT_REQUEST');
    assert.equal(h.requests.length,0);
});

test('chat context translates session id once, preserves zeros and normalizes item identity in its API owner',async()=>{
    const value=context('model','c1');value.telemetry.context_breakdown.skills.items.push({name:'tool',status:'active',tokens:0});
    const h=chatHarness((url,body)=>result(body,value));const controller=new AbortController();
    const response=await h.chatApi.getContextTelemetry({model:'model',session_id:'c1'},controller.signal);
    assert.deepEqual(wire(h.requests[0].body.params),{model:'model',chat_id:'c1'});
    assert.equal(h.requests[0].options.signal,controller.signal);
    assert.equal(response.telemetry.context_breakdown.total_context_limit,0);
    assert.equal(response.telemetry.context_breakdown.system_prompt_tokens,0);
    assert.equal(response.telemetry.context_breakdown.skills.items[0].id,'tool');
    await h.chatApi.getContextTelemetry();assert.deepEqual(wire(h.requests[1].body.params),{});
});

test('context refuses wrong chat/model identities and invalid measurements or nested groups',async()=>{
    for(const mutate of [v=>{v.chat_id='other';},v=>{v.model='other';},
        v=>{v.telemetry.active_session_id='other';},v=>{v.telemetry.context_breakdown.messages_tokens=-1;},
        v=>{v.telemetry.context_breakdown.messages_tokens=0.5;},v=>{v.telemetry.context_breakdown.active_percentage=101;},
        v=>{v.telemetry.context_breakdown.skills.items=[{}];},v=>{v.telemetry.context_breakdown={};}]){
        const value=context('model');mutate(value);const h=chatHarness((url,body)=>result(body,value));
        await assert.rejects(h.chatApi.getContextTelemetry({model:'model',session_id:'c1'}),e=>e.statusText==='INVALID_CHAT_RESPONSE');
    }
});

test('generation keeps its dedicated endpoint and stream identity is decoded once for all consumers',async()=>{
    let seenOptions;const identities=[],events=[];
    const h=chatHarness((url,body)=>{assert.equal(url,'/v1/chat/completions');assert.equal(body.stream,false);return {choices:[]};},
        async(url,body,options)=>{assert.equal(url,'/v1/chat/completions');assert.equal(body.stream,true);seenOptions=options;
            for(const event of [{processing:{}},{id:'engine-first'},{stream_id:'engine-alias'}])options.onEvent(event);});
    await h.chatApi.createCompletion({messages:[]});
    await h.chatApi.streamCompletion({messages:[]},{onStreamId:id=>identities.push(id),onEvent:event=>events.push(event)});
    assert.deepEqual(identities,['engine-first','engine-alias']);assert.equal(events.length,3);
    assert.equal(typeof seenOptions.onEvent,'function');
});

test('domain chat store uses server ids; superseded callbacks/finalizers cannot replace a newer stream',async()=>{
    const streams=[];const h=chatHarness((url,body)=>result(body,{stream_id:body.params.stream_id,
        status:body.method==='chat.cancel'?'cancelled':'skip_requested'}),async(url,body,options)=>{
            const wait=deferred();streams.push({options,wait});await wait.promise;
        });
    const {useChatStore:store}=load('src/api/engine/chat/chat.store.ts',{'zustand':require('zustand'),
        '../../client':h.errors,'./chat.api':h});
    const first=store.getState().streamChat({messages:[]});assert.equal(store.getState().activeStreamId,null);
    streams[0].options.onEvent({id:'engine-one'});
    await store.getState().skipThinking();assert.equal(h.requests[0].body.params.stream_id,'engine-one');
    const second=store.getState().streamChat({messages:[]});assert.equal(streams[0].options.signal.aborted,true);
    streams[1].options.onEvent({id:'engine-two'});streams[1].options.onToken('Current');
    streams[0].options.onEvent({id:'stale-id'});streams[0].options.onToken('Stale');
    streams[0].wait.resolve();await first;
    assert.equal(store.getState().activeStreamId,'engine-two');assert.equal(store.getState().streamingContent,'Current');
    assert.equal(store.getState().isStreaming,true);
    await store.getState().cancelActiveStream();assert.equal(h.requests.at(-1).body.params.stream_id,'engine-two');
    assert.equal(store.getState().status,'idle');assert.equal(streams[1].options.signal.aborted,true);
    streams[1].wait.resolve();await second;assert.equal(store.getState().status,'idle');
});

test('cancelling before a server id exists only aborts its owned stream; no fabricated control request',async()=>{
    let options;const wait=deferred();const h=chatHarness(()=>assert.fail('Invented stream dispatched'),
        async(url,body,value)=>{options=value;await wait.promise;});
    const {useChatStore:store}=load('src/api/engine/chat/chat.store.ts',{'zustand':require('zustand'),
        '../../client':h.errors,'./chat.api':h});
    const pending=store.getState().streamChat({messages:[]});await store.getState().cancelActiveStream();
    assert.equal(options.signal.aborted,true);assert.equal(h.requests.length,0);wait.resolve();await pending;
});

test('a refused Engine cancellation remains visible while local abort still stops its owned stream',async()=>{
    let options;const wait=deferred();const h=chatHarness((url,body)=>({jsonrpc:'2.0',id:body.id,
        error:{code:-32002,message:'Cancel not permitted',data:{type:'forbidden'}}}),
    async(url,body,value)=>{options=value;await wait.promise;});
    const {useChatStore:store}=load('src/api/engine/chat/chat.store.ts',{'zustand':require('zustand'),
        '../../client':h.errors,'./chat.api':h});
    const pending=store.getState().streamChat({messages:[]});options.onEvent({id:'owned-stream'});
    await store.getState().cancelActiveStream();assert.equal(options.signal.aborted,true);
    assert.equal(store.getState().error,'Cancel not permitted');wait.resolve();await pending;
});
