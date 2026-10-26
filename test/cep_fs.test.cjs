const {test}=require('node:test');
const assert=require('node:assert/strict');
const {filesystemHarness:fsHarness,load}=require('./cepHarness.cjs');
const result=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const wire=value=>JSON.parse(JSON.stringify(value));

test('filesystem translates UTF-8, binary and zero-length files using the shared CEP caller',async()=>{
    const h=fsHarness((url,body)=>{
        assert.equal(url,'/v1/cep');
        if(body.method==='fs.read')return result(body,{path:'/work/file',size:0,binary:body.params.binary,
            ...(body.params.binary?{data_base64:''}:{text:''})});
        assert.equal(body.method,'fs.write');return result(body,{path:'/work/file',bytes:0});
    });
    assert.equal((await h.fsApi.readFile({path:'file'})).content,'');
    assert.equal((await h.fsApi.readFile({path:'file',is_binary:true})).is_binary,true);
    assert.equal((await h.fsApi.writeFile({path:'file',content:''})).bytes,0);
    await h.fsApi.writeFile({path:'file',content:'',is_binary:true});
    assert.deepEqual(wire(h.requests.map(r=>r.body.params)),[
        {path:'file',binary:false},{path:'file',binary:true},{path:'file',text:''},{path:'file',data_base64:''},
    ]);
});

test('partial directory listings retain skipped entries, zero sizes and readable modification timestamps',async()=>{
    const h=fsHarness((url,body)=>result(body,{items:[{path:'folder/empty',name:'empty',is_folder:false,
        size:0,modified:'2026-10-26T00:00:00.000Z'}],truncated:true,skipped:2}));
    const r=await h.fsApi.listDir({dir_path:'folder',root_path:'.',recursive:true});
    assert.deepEqual(wire(h.requests[0].body.params),{path:'folder',root:'.',recursive:true});
    assert.equal(r.items[0].isFolder,false);assert.equal(r.items[0].length,0);
    assert.equal(r.items[0].modified,'2026-10-26T00:00:00.000Z');
    assert.equal(r.truncated,true);assert.equal(r.skipped,2);
});

test('rename, copy, mkdir and delete return success only from matching CEP acknowledgements',async()=>{
    const h=fsHarness((url,body)=>result(body,
        ['fs.rename','fs.copy'].includes(body.method)?{from:'/work/a',to:'/work/b'}:{path:'/work/a'}));
    for(const r of [await h.fsApi.renamePath({old_path:'a',new_path:'b'}),
        await h.fsApi.copyPath({src_path:'a',dest_path:'b'}),await h.fsApi.createDir({path:'a'}),
        await h.fsApi.deletePath({path:'a'})])assert.equal(r.status,'success');
    assert.deepEqual(wire(h.requests.map(r=>[r.body.method,r.body.params])),[
        ['fs.rename',{from:'a',to:'b'}],['fs.copy',{from:'a',to:'b'}],['fs.mkdir',{path:'a'}],['fs.delete',{path:'a'}],
    ]);
});

test('workspace params and picker cancellation keep the existing App facade without a second write',async()=>{
    const h=fsHarness((url,body)=>result(body,{path:body.method==='fs.pick_folder'?null:'/work'}));
    assert.equal((await h.fsApi.getWorkspace()).workspace,'/work');
    assert.equal((await h.fsApi.setWorkspace({workspace:'/work'})).workspace,'/work');
    assert.equal((await h.fsApi.pickFolder()).path,null);
    assert.deepEqual(wire(h.requests[1].body.params),{path:'/work'});
    assert.equal(h.requests[2].options.timeoutMs,0);
});

test('malformed file, list, workspace and mutation results never become success or empty listings',async()=>{
    const cases=[['readFile',{path:'a'},{}],['readFile',{path:'a',is_binary:true},{path:'/a',size:1,binary:false,text:'a'}],
        ['writeFile',{path:'a',content:''},{path:'/a',bytes:-1}],['listDir',{},{}],
        ['listDir',{}, {items:[{}],truncated:false,skipped:0}],['getWorkspace',undefined,{path:null}],
        ['pickFolder',undefined,{}],['deletePath',{path:'a'},{}],['renamePath',{old_path:'a',new_path:'b'},{from:'/a'}]];
    for(const [method,input,value]of cases){
        const h=fsHarness((url,body)=>result(body,value));
        await assert.rejects(h.fsApi[method](input),e=>e.statusText==='INVALID_FS_RESPONSE');
    }
});

test('CEP permission/approval errors and HTTP failures retain their original details',async()=>{
    const data={type:'pending_approval',approval_id:'own-approval'};
    const h=fsHarness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code:-32002,message:'Permission required',data}}));
    await assert.rejects(h.fsApi.deletePath({path:'a'}),e=>e.code===-32002&&e.data===data);
    const failure=new Error('transport unavailable');
    const offline=fsHarness(()=>{throw failure;});
    await assert.rejects(offline.fsApi.listDir({}),e=>e===failure);
});

test('legacy caller and approval payload flags are refused before transport',async()=>{
    const h=fsHarness(()=>assert.fail('Legacy authority dispatched'));
    for(const field of ['caller','approval_id']){
        await assert.rejects(h.fsApi.readFile({path:'a',[field]:'user'}),e=>e.statusText==='INVALID_FS_REQUEST');
        await assert.rejects(h.fsApi.deletePath({path:'a',[field]:'user'}),e=>e.statusText==='INVALID_FS_REQUEST');
    }
    assert.equal(h.requests.length,0);
});

test('filesystem store keeps partial metadata and does not select the picker workspace twice',async()=>{
    const h=fsHarness((url,body)=>{
        if(body.method==='fs.pick_folder')return result(body,{path:'/picked'});
        assert.equal(body.method,'fs.list');return result(body,{items:[],truncated:true,skipped:1});
    });
    const {useFsStore}=load('src/api/engine/fs/fs.store.ts',{'zustand':require('zustand'),
        '../../client':h.errors,'./fs.api':h});
    assert.equal(await useFsStore.getState().pickFolder(),'/picked');
    const s=useFsStore.getState();assert.equal(s.workspace,'/picked');
    assert.equal(s.listingTruncated,true);assert.equal(s.listingSkipped,1);
    assert.equal(h.requests.filter(r=>r.body.method==='workspace.set').length,0);
    s.reset();assert.equal(useFsStore.getState().listingSkipped,0);
});
