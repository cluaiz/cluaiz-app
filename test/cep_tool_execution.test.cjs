const {test}=require('node:test');const assert=require('node:assert/strict');
const {toolHarness,load}=require('./cepHarness.cjs');const wire=v=>JSON.parse(JSON.stringify(v));

test('execution and its store use one explicit CEP target and preserve every tool result',async()=>{
    for(const value of [null,false,0,'',[],{result:'tool-owned nested field'}, {status:'error',detail:'Tool domain data'}]){
        const h=toolHarness((url,body)=>{assert.equal(url,'/v1/cep');assert.equal(body.method,'tools.call');
            assert.deepEqual(wire(body.params),{kind:'plugin',name:'owned',fn:'run',input:{value:0}});
            return {jsonrpc:'2.0',id:body.id,result:value};});
        const {useComponentsStore:store}=load('src/api/engine/tools/components/components.store.ts',{
            'zustand':require('zustand'),'./components.api':h,'../../../client':h.errors});
        assert.deepEqual(wire(await store.getState().executeDynamic('owned','run',{value:0},'plugin')),value);
        assert.equal(h.requests.length,1);
    }
    const empty=toolHarness((url,body)=>{assert.deepEqual(wire(body.params.input),{});return {jsonrpc:'2.0',id:body.id,result:null};});
    assert.equal((await empty.componentsApi.executeDynamic('owned','run',undefined,'mcp')).result,null);
});

test('missing kind, non-object arguments and path-like functions fail before execution',async()=>{
    const h=toolHarness(()=>{throw Error('Must not execute');});
    for(const kind of [undefined,'model','terminal'])await assert.rejects(h.componentsApi.executeDynamic('owned','run',{},kind),e=>e.statusText==='INVALID_TOOL_TARGET');
    for(const fn of ['', '../run','folder/run','folder\\run','bad\0fn']){
        await assert.rejects(h.componentsApi.executeDynamic('owned',fn,{},'plugin'),e=>e.statusText==='INVALID_TOOL_CALL');
    }
    for(const input of [null,[],false,'args'])await assert.rejects(h.componentsApi.executeDynamic('owned','run',input,'plugin'),e=>e.statusText==='INVALID_TOOL_CALL');
    assert.equal(h.requests.length,0);
});

test('execution refusals, approval details and transport failures stay failures in the store',async()=>{
    for(const [code,type]of [[-32002,'forbidden'],[-32003,'approval_required'],[-32010,'tool_operation_failed']]){
        const h=toolHarness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code,message:type,data:{type,approval_id:'owned'}}}));
        const {useComponentsStore:store}=load('src/api/engine/tools/components/components.store.ts',{
            'zustand':require('zustand'),'./components.api':h,'../../../client':h.errors});
        await assert.rejects(store.getState().executeDynamic('owned','run',{},'skill'),e=>e.code===code&&e.data.approval_id==='owned');
        assert.equal(store.getState().error,type);
    }
    const offline=new Error('Offline');const h=toolHarness(()=>{throw offline;});
    await assert.rejects(h.componentsApi.executeDynamic('owned','run',{},'plugin'),e=>e===offline);
});
