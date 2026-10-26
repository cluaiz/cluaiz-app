const {test}=require('node:test');const assert=require('node:assert/strict');
const {harness,load}=require('./cepHarness.cjs');const reply=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const storeFor=h=>load('src/api/engine/models/models.store.ts',{
    zustand:require('zustand'),'./models.api':h,'../../client/errors':h.errors,
    '../../../components/ui/toast':{toast:{promise:promise=>promise}},
}).useModelsStore;

test('metadata reads resolve current registry paths and share authorized UTF-8 fs.read including empty files',async()=>{
    for(const base of ['/owned/model','C:\\owned\\model','\\\\server\\models\\owned']){
        const h=harness((url,body)=>{
            if(body.method==='models.list')return reply(body,[{id:'owned',local_dir:base}]);
            assert.equal(body.method,'fs.read');assert.equal(body.params.binary,false);
            assert.equal(body.params.path,base+'/structural_dna.json');
            return reply(body,{path:body.params.path,size:0,binary:false,text:''});
        });const signal=new AbortController().signal;
        assert.equal((await h.modelsApi.readMetadata('owned','dna',signal)).content,'');
        assert.ok(h.requests.every(request=>request.options.signal===signal));
    }
});

test('metadata rejects arbitrary paths, missing registry roots, binary data and stale aborted discovery',async()=>{
    const noCall=harness(()=>{throw Error('Unexpected call');});
    await assert.rejects(noCall.modelsApi.readMetadata('owned','../../outside'),e=>e.statusText==='INVALID_MODEL_METADATA');
    assert.equal(noCall.requests.length,0);
    for(const entries of [[],[{id:'owned'}],[{id:'owned',local_dir:'relative/model'}]]){
        const h=harness((url,body)=>reply(body,entries));
        await assert.rejects(h.modelsApi.readMetadata('owned','manifest'),e=>['MODEL_NOT_INSTALLED','INVALID_MODEL_METADATA'].includes(e.statusText));
        assert.equal(h.requests.length,1);
    }
    const binary=harness((url,body)=>reply(body,body.method==='models.list'?[{id:'owned',local_dir:'/owned'}]:
        {path:'/owned/model_manifest.json',size:1,binary:true,data_base64:'AA=='}));
    await assert.rejects(binary.modelsApi.readMetadata('owned','manifest'),e=>e.statusText==='INVALID_MODEL_METADATA');
    let release;const late=harness((url,body)=>new Promise(resolve=>release=()=>resolve(reply(body,[{id:'owned',local_dir:'/owned'}]))));
    const controller=new AbortController(),pending=late.modelsApi.readMetadata('owned','manifest',controller.signal);
    controller.abort();release();await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(late.requests.length,1);
});

test('metadata read failures retain filesystem/approval details instead of becoming empty JSON',async()=>{
    const h=harness((url,body)=>body.method==='models.list'?reply(body,[{id:'owned',local_dir:'/owned'}]):
        {jsonrpc:'2.0',id:body.id,error:{code:-32003,message:'Approval',data:{type:'approval_required',approval_id:'owned'}}});
    await assert.rejects(h.modelsApi.readMetadata('owned','manifest'),e=>e.code===-32003&&e.data.approval_id==='owned');
});

test('model store retains refused deletion/load and refreshes only after actual completed download',async()=>{
    let installed=[{id:'owned'}],fail=false,finish;const done=new Promise(resolve=>finish=resolve);
    const h=harness(async(url,body)=>{
        if(body.method==='models.list')return reply(body,installed);
        if(body.method==='system.info')throw Error('Optional hardware unavailable');
        if(fail)return {jsonrpc:'2.0',id:body.id,error:{code:-32002,message:'Denied',data:{type:'forbidden'}}};
        if(body.method==='models.download')return reply(body,{task:{task_id:'owned-task',method:'models.download',status:'working'}});
        if(body.method==='tasks.result'){await done;installed=[...installed,{id:'downloaded'}];return reply(body,{status:'success',model:'downloaded',path:'/downloaded',downloaded:true});}
        installed=[];return reply(body,{model:'owned',dir:'/owned'});
    });const store=storeFor(h);await store.getState().load();fail=true;
    assert.equal(await store.getState().deleteModel('owned'),false);assert.equal(store.getState().installed[0].id,'owned');
    assert.equal(await store.getState().loadModel('owned'),false);assert.equal(store.getState().error,'Denied');fail=false;
    const start=h.requests.filter(r=>r.body.method==='models.list').length;
    const pending=store.getState().downloadModel({model_id:'owner/repo'});await new Promise(r=>setImmediate(r));
    assert.equal(h.requests.filter(r=>r.body.method==='models.list').length,start,'inventory refreshed before download ended');
    finish();assert.equal(await pending,true);assert.equal(store.getState().installed.length,2);
    assert.equal(await store.getState().deleteModel('owned'),true);assert.equal(store.getState().installed.some(m=>m.id==='owned'),false);
});

test('older inventory/header replies cannot restore a deleted model or replace a newer inspection',async()=>{
    let releaseList,releaseHeader,hold=false;const header=model=>({model,file:'/owned',metadata:{},int_arrays:{},speech_languages:[],tensors:[]});
    const h=harness((url,body)=>{
        if(body.method==='system.info')throw Error('Optional hardware unavailable');
        if(body.method==='models.list')return hold?new Promise(resolve=>releaseList=()=>resolve(reply(body,[{id:'owned'}]))):reply(body,[{id:'owned'}]);
        if(body.method==='models.inspect')return body.params.model==='old'?new Promise(resolve=>releaseHeader=()=>resolve(reply(body,header('old')))):reply(body,header(body.params.model));
        return reply(body,{model:body.params.model,dir:'/owned'});
    });const store=storeFor(h);await store.getState().load();hold=true;
    const reading=store.getState().load();await new Promise(r=>setImmediate(r));await store.getState().deleteModel('owned');releaseList();await reading;
    assert.equal(store.getState().installed.length,0);assert.equal(store.getState().status,'success');
    const old=store.getState().inspect('old');await new Promise(r=>setImmediate(r));await store.getState().inspect('new');releaseHeader();await old;
    assert.equal(store.getState().inspectedHeader.model,'new');
    const deleted=store.getState().inspect('old');await new Promise(r=>setImmediate(r));await store.getState().deleteModel('old');
    assert.equal(store.getState().isInspecting,false);releaseHeader();await deleted;
    assert.equal(store.getState().inspectedHeader,null,'late deleted-model inspection restored stale header');
});
