const {test}=require('node:test');const assert=require('node:assert/strict');
const {harness}=require('./cepHarness.cjs');const wire=v=>JSON.parse(JSON.stringify(v));
const reply=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const header=()=>({model:'owned',file:'/owned/weights.gguf',metadata:{'general.name':'Actual model'},int_arrays:{sections:[1,0]},speech_languages:[],
    tensors:[{name:'actual.weight',dims:[4,0],ggml_type:0,offset:0,size_bytes:0}]});

test('installed load/remove/inspect use CEP and retain actual header/timing data',async()=>{
    const signal=new AbortController().signal;const h=harness((url,body)=>{
        assert.equal(url,'/v1/cep');assert.equal(body.params.model,'owned');
        return reply(body,body.method==='models.load'?{model:'owned',loaded_ms:0}:
            body.method==='models.remove'?{model:'owned',dir:'/owned'}:header());
    });
    assert.equal((await h.modelsApi.loadModel('owned',signal)).loaded_ms,0);
    assert.equal((await h.modelsApi.deleteModel('owned',signal)).dir,'/owned');
    const got=await h.modelsApi.inspectHeader('owned','weights.gguf',signal);
    assert.deepEqual(wire(got),header());assert.equal(h.requests[2].body.params.file,'weights.gguf');
    assert.ok(h.requests.every(r=>r.options.signal===signal));assert.equal(h.requests[0].options.timeoutMs,0);
    await assert.rejects(h.modelsApi.getAvailable(),e=>e.statusText==='MODEL_RECOMMENDATIONS_UNAVAILABLE');assert.equal(h.requests.length,3);
});

test('pull/download start once and await the same final task including canonical and cached ids',async()=>{
    for(const cached of [false,true]){
        let finish;const completed=new Promise(r=>finish=r);let settled=false;
        const h=harness(async(url,body)=>{
            if(body.method==='models.download')return reply(body,{task:{task_id:'owned-task',method:'models.download',status:'working'}});
            assert.equal(body.method,'tasks.result');await completed;
            return reply(body,{status:'success',model:'canonical-installed-id',path:cached?null:'/owned',downloaded:!cached});
        });
        const pending=(cached?h.modelsApi.pullModel('owner/repo:Q4'):h.modelsApi.downloadModel({model_id:'owner/repo:Q4'})).then(v=>{settled=true;return v;});
        await new Promise(r=>setImmediate(r));assert.equal(settled,false);finish();const value=await pending;
        assert.equal(value.model,'canonical-installed-id');assert.equal(value.downloaded,!cached);assert.equal(value.path,cached?null:'/owned');
        assert.deepEqual(h.requests.map(r=>r.body.method),['models.download','tasks.result']);
        assert.deepEqual(wire(h.requests[0].body.params),{model:'owner/repo:Q4'});
    }
});

test('wrong identities/malformed acknowledgments and download results never become success',async()=>{
    for(const value of [{model:'other',loaded_ms:1},{model:'owned',loaded_ms:-1},{}]){
        const h=harness((url,body)=>reply(body,value));await assert.rejects(h.modelsApi.loadModel('owned'),e=>e.statusText==='INVALID_MODEL_ACTION');
    }
    for(const value of [{model:'other',dir:'/other'},{model:'owned',dir:''}]){
        const h=harness((url,body)=>reply(body,value));await assert.rejects(h.modelsApi.deleteModel('owned'),e=>e.statusText==='INVALID_MODEL_ACTION');
    }
    for(const value of [{...header(),model:'other'},{...header(),int_arrays:{bad:'not-array'}},{...header(),tensors:[{}]}]){
        const h=harness((url,body)=>reply(body,value));await assert.rejects(h.modelsApi.inspectHeader('owned'),e=>e.statusText==='INVALID_MODEL_ACTION');
    }
    for(const value of [{status:'working'},{status:'success',model:'owned',downloaded:true,path:null},
        {status:'success',model:'owned',downloaded:false,path:undefined}]){
        const h=harness((url,body)=>reply(body,body.method==='models.download'?{task:{task_id:'owned-task',method:'models.download',status:'working'}}:value));
        await assert.rejects(h.modelsApi.downloadModel({model_id:'owned'}),e=>e.statusText==='INVALID_MODEL_ACTION');
    }
});

test('invalid installed paths, escaping files and unsupported download fields refuse before dispatch',async()=>{
    const h=harness(()=>{throw Error('Unexpected dispatch');});
    for(const model of ['', '../outside','owner/repo',undefined])await assert.rejects(h.modelsApi.loadModel(model),e=>e.statusText==='INVALID_INSTALLED_MODEL');
    for(const file of ['../outside','/absolute','C:\\outside'])await assert.rejects(h.modelsApi.inspectHeader('owned',file),e=>e.statusText==='INVALID_MODEL_FILE');
    for(const payload of [{},{model_id:' '},{model_id:'owned',quantization:'Q4'}, {model_id:'a'.repeat(513)},{model_id:'bad\0id'}]){
        await assert.rejects(h.modelsApi.downloadModel(payload),e=>e.statusText==='INVALID_MODEL_DOWNLOAD');
    }
    assert.equal(h.requests.length,0);
});

test('ONNX/permission/approval/load/download task errors remain actual domain failures',async()=>{
    for(const [code,type]of [[-32007,'not_implemented'],[-32002,'forbidden'],[-32003,'approval_required'],[-32010,'model_load_failed']]){
        const h=harness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code,message:type,data:{type,approval_id:'owned'}}}));
        for(const action of [()=>h.modelsApi.loadModel('owned'),()=>h.modelsApi.deleteModel('owned'),()=>h.modelsApi.inspectHeader('owned')]){
            await assert.rejects(action(),e=>e.code===code&&e.data.approval_id==='owned');
        }
    }
    for(const [code,type]of [[-32005,'pull_running'],[-32008,'cancelled'],[-32010,'download_failed']]){
        const h=harness((url,body)=>body.method==='models.download'?reply(body,{task:{task_id:'owned-task',method:'models.download',status:'working'}}):
            {jsonrpc:'2.0',id:body.id,error:{code,message:type,data:{type}}});
        await assert.rejects(h.modelsApi.pullModel('owned'),e=>e.code===code&&e.data.type===type);
    }
});
