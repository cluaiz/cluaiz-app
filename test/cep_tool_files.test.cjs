const {test}=require('node:test');const assert=require('node:assert/strict');
const {toolHarness,load}=require('./cepHarness.cjs');const wire=v=>JSON.parse(JSON.stringify(v));
const reply=(body,value)=>({jsonrpc:'2.0',id:body.id,result:value});
const listing=()=>({files:[{name:'SKILL.md',path:'SKILL.md',is_dir:false},{name:'docs',path:'docs',is_dir:true}],
    cache:{all_bytes:0,temp_bytes:0,entries:[]},truncated:true,skipped:2});

test('tool files keep partial listing/cache and UTF-8/empty content through shared CEP',async()=>{
    const text='नमस्ते';const signal=new AbortController().signal;let empty=false;
    const h=toolHarness((url,body)=>{
        assert.equal(url,'/v1/cep');assert.equal(body.params.kind,'skill');assert.equal(body.params.name,'owned');
        return reply(body,body.method==='tools.files'?listing():{path:'/owned/SKILL.md',text:empty?'':text});
    });
    const files=await h.componentsApi.getFiles('skill','owned',signal);
    assert.equal(files.skipped,2);assert.equal(files.truncated,true);assert.equal(files.cache.all_bytes,0);
    assert.equal(files.files[1].is_dir,true);
    assert.equal((await h.componentsApi.getFile('skill','owned','SKILL.md',signal)).content,text);
    empty=true;assert.equal((await h.componentsApi.getFile('skill','owned','SKILL.md',signal)).content,'');
    assert.ok(h.requests.every(r=>r.options.signal===signal));
    assert.deepEqual(wire(h.requests[1].body.params),{kind:'skill',name:'owned',path:'SKILL.md'});
});

test('main-file writes preserve actual UTF-8 bytes and reject arbitrary path fields',async()=>{
    const h=toolHarness((url,body)=>reply(body,{path:'/owned/SKILL.md',bytes:Buffer.byteLength(body.params.text)}));
    for(const content of ['','हिंदी — content']){
        const result=await h.componentsApi.updateFile({component_type:'skill',component_id:'owned',content});
        assert.equal(result.bytes,Buffer.byteLength(content));assert.equal(h.requests.at(-1).body.method,'tools.write_file');
        assert.deepEqual(wire(h.requests.at(-1).body.params),{kind:'skill',name:'owned',text:content});
    }
    const count=h.requests.length;
    for(const extra of [{file_path:'other.txt'},{path:'../elsewhere'},{content:null}]){
        await assert.rejects(h.componentsApi.updateFile({component_type:'skill',component_id:'owned',content:'new',...extra}),
            e=>e.statusText==='INVALID_TOOL_FILE_WRITE');
    }
    assert.equal(h.requests.length,count);
    const {useComponentsStore:store}=load('src/api/engine/tools/components/components.store.ts',{
        'zustand':require('zustand'),'./components.api':h,'../../../client':h.errors});
    assert.equal(await store.getState().updateFile({component_type:'skill',component_id:'owned',content:''}),true);
});

test('malformed listings/read/write results never become an empty tree or saved file',async()=>{
    for(const value of [{}, {...listing(),truncated:undefined}, {...listing(),skipped:-1}, {...listing(),cache:{}},
        {...listing(),files:[{name:'escape',path:'../outside',is_dir:false}]}]){
        const h=toolHarness((url,body)=>reply(body,value));
        await assert.rejects(h.componentsApi.getFiles('skill','owned'),e=>e.statusText==='INVALID_TOOL_FILE');
    }
    for(const value of [{},{path:'',text:''},{path:'/owned',text:null}]){
        const h=toolHarness((url,body)=>reply(body,value));
        await assert.rejects(h.componentsApi.getFile('skill','owned','SKILL.md'),e=>e.statusText==='INVALID_TOOL_FILE');
    }
    for(const value of [{},{path:'/owned/SKILL.md',bytes:1},{path:'/owned/SKILL.md',bytes:'0'}]){
        const h=toolHarness((url,body)=>reply(body,value));
        await assert.rejects(h.componentsApi.updateFile({component_type:'skill',component_id:'owned',content:''}),e=>e.statusText==='INVALID_TOOL_FILE');
    }
    const empty=toolHarness((url,body)=>reply(body,{...listing(),files:[],truncated:false,skipped:0}));
    assert.equal((await empty.componentsApi.getFiles('skill','owned')).files.length,0);
});

test('wrong tool kinds, escaping relative paths and permission failures retain explicit errors',async()=>{
    const h=toolHarness(()=>{throw Error('Unexpected dispatch');});
    await assert.rejects(h.componentsApi.getFile('model','owned','model_manifest.json'),e=>e.statusText==='INVALID_TOOL_TARGET');
    for(const path of ['../secret','docs/../secret','/absolute','C:\\outside','\\\\server\\file','bad\0name']){
        await assert.rejects(h.componentsApi.getFile('skill','owned',path),e=>e.statusText==='INVALID_TOOL_FILE_PATH');
    }
    assert.equal(h.requests.length,0);
    for(const code of [-32002,-32003,-32004]){
        const refused=toolHarness((url,body)=>({jsonrpc:'2.0',id:body.id,error:{code,message:'Denied',data:{type:'scope_or_file_error',approval_id:'owned'}}}));
        for(const action of [()=>refused.componentsApi.getFiles('skill','owned'),()=>refused.componentsApi.getFile('skill','owned','SKILL.md'),
            ()=>refused.componentsApi.updateFile({component_type:'skill',component_id:'owned',content:'new'})]){
            await assert.rejects(action(),e=>e.code===code&&e.data.approval_id==='owned');
        }
    }
});
