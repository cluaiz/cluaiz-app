const {test}=require('node:test');
const assert=require('node:assert/strict');
const {filesystemHarness,load}=require('./cepHarness.cjs');

function historyHarness(handler){
    const files=new Map();
    const h=filesystemHarness((url,body)=>{
        assert.equal(url,'/v1/cep');
        const {method,params:p}=body;
        const result=value=>({jsonrpc:'2.0',id:body.id,result:value});
        if(handler){const override=handler(body);if(override!==undefined)return override;}
        if(method==='fs.read'){
            if(!files.has(p.path))return {jsonrpc:'2.0',id:body.id,error:{code:-32004,message:'Not found',data:{type:'file_not_found'}}};
            const file=files.get(p.path),bytes=typeof file==='string'?Buffer.from(file):file;
            return result({path:'/work/'+p.path,size:bytes.length,binary:p.binary,
                ...(p.binary?{data_base64:bytes.toString('base64')}:{text:bytes.toString()})});
        }
        if(method==='fs.write'){
            const file=p.data_base64!==undefined?Buffer.from(p.data_base64,'base64'):p.text;
            files.set(p.path,file);return result({path:'/work/'+p.path,bytes:Buffer.byteLength(file)});
        }
        if(method==='fs.delete'){
            for(const key of files.keys())if(key===p.path||key.startsWith(p.path+'/'))files.delete(key);
            return result({path:'/work/'+p.path});
        }
        assert.fail('Unexpected operation '+method);
    });
    const mime=load('src/utils/mimeSniffer.ts',{});
    const {EngineFsChatStorageDriver}=load('src/services/storage/EngineFsChatStorageDriver.ts',{
        '../../api/engine/fs/fs.api':h,'../../api/client/cep':h,'../../utils/mimeSniffer':mime,
    });
    return {...h,files,driver:new EngineFsChatStorageDriver()};
}

test('existing JSON catalog, ownership metadata and JSONL history retain the same paths and format',async()=>{
    const h=historyHarness();
    const catalog={version:1,lastActiveSessionId:'old-chat',sessions:[{id:'old-chat',extensionId:'owned.extension'}]};
    const meta={id:'old-chat',title:'Saved chat',extensionId:'owned.extension'};
    h.files.set('data/chats/sessions_index.json',JSON.stringify(catalog));
    h.files.set('data/chats/old-chat/meta.json',JSON.stringify(meta));
    h.files.set('data/chats/old-chat/messages.jsonl','{"id":"u1","content":"नमस्ते"}\n');
    assert.equal((await h.driver.loadSessionsIndex()).sessions[0].extensionId,'owned.extension');
    assert.equal((await h.driver.loadSessionMetadata('old-chat')).extensionId,'owned.extension');
    await h.driver.appendMessage('old-chat',{id:'a1',content:'Hello'});
    const messages=await h.driver.loadSessionMessages('old-chat');
    assert.equal(messages.length,2);assert.equal(messages[0].content,'नमस्ते');
    await h.driver.appendMessage('old-chat',{id:'a1',content:'Updated'});
    assert.equal((await h.driver.loadSessionMessages('old-chat')).length,2);
    assert.equal((await h.driver.loadSessionMessages('old-chat',1))[0].content,'Updated');
    await h.driver.saveSessionsIndex(catalog);await h.driver.saveSessionMetadata('old-chat',meta);
    assert.equal(h.files.get('data/chats/old-chat/meta.json'),JSON.stringify(meta,null,2));
    assert.ok(h.requests.every(r=>!['workspace.set','fs.pick_folder'].includes(r.body.method)));
});

test('only missing files are empty; permission, transport and malformed responses prevent append writes',async()=>{
    const missing=historyHarness();
    assert.equal(await missing.driver.loadSessionsIndex(),null);
    assert.equal(await missing.driver.loadSessionMetadata('new'),null);
    assert.equal((await missing.driver.loadSessionMessages('new')).length,0);
    await missing.driver.appendMessage('new',{id:'first',content:'First'});
    assert.ok(missing.files.has('data/chats/new/messages.jsonl'));
    const failure=new Error('Disconnected');
    for(const mode of ['permission','transport','invalid','binary']){
        const h=historyHarness(body=>{
            if(mode==='transport')throw failure;
            return mode==='permission'?{jsonrpc:'2.0',id:body.id,error:{code:-32002,message:'Denied',data:{type:'os_permission_denied'}}}
                :{jsonrpc:'2.0',id:body.id,result:mode==='binary'?{path:'/saved',size:1,binary:true,data_base64:'/w=='}:{}};
        });
        await assert.rejects(h.driver.appendMessage('saved',{id:'next'}));
        assert.equal(h.requests.filter(r=>r.body.method==='fs.write').length,0);
    }
});

test('malformed catalogs, wrong-session metadata and unreadable history do not become empty success',async()=>{
    const h=historyHarness();
    for(const content of ['{','{}','null']){
        h.files.set('data/chats/sessions_index.json',content);await assert.rejects(h.driver.loadSessionsIndex());
    }
    h.files.set('data/chats/saved/meta.json','{"id":"another"}');
    await assert.rejects(h.driver.loadSessionMetadata('saved'),/does not match/);
    for(const content of ['{"id":','null\n','bad\n{"id":"m1"}\n']){
        h.files.set('data/chats/saved/messages.jsonl',content);
        await assert.rejects(h.driver.appendMessage('saved',{id:'m2'}),/invalid/);
        assert.equal(h.files.get('data/chats/saved/messages.jsonl'),content);
    }
    h.files.set('data/chats/saved/messages.jsonl','{"id":"m1","content":"kept"}\n{"id":');
    assert.equal((await h.driver.loadSessionMessages('saved'))[0].content,'kept');
});

test('saved assets use authenticated CEP binary reads and the existing MIME resolver instead of retired URLs',async()=>{
    const h=historyHarness();
    const png=Buffer.from('89504e470d0a1a0a','hex');
    const reference=await h.driver.saveAsset('saved','image.png',new Uint8Array(png));
    const uri=await h.driver.resolveAssetUrl('saved',reference);
    assert.equal(uri,'data:image/png;base64,'+png.toString('base64'));
    const last=h.requests.at(-1).body;assert.equal(last.method,'fs.read');assert.equal(last.params.binary,true);
    const pdf=Buffer.from('%PDF-1.7\n');
    const pdfRef=await h.driver.saveAsset('saved','paper.pdf',new Blob([pdf]));
    assert.equal(await h.driver.resolveAssetUrl('saved','/'+pdfRef),'data:application/pdf;base64,'+pdf.toString('base64'));
});

test('history and asset paths refuse traversal or cross-session access before a request',async()=>{
    const h=historyHarness();
    for(const id of ['..','a/b','a\\b','C:relative'])await assert.rejects(h.driver.loadSessionMessages(id),/Invalid chat storage path/);
    for(const ref of ['assets/../meta.json','assets/../../other/file','assets\\file','http://host/file','meta.json']){
        await assert.rejects(h.driver.resolveAssetUrl('saved',ref),/Invalid chat/);
    }
    assert.equal(h.requests.length,0);
});

test('session deletion uses its existing folder, preserving other sessions',async()=>{
    const h=historyHarness();h.files.set('data/chats/one/messages.jsonl','');h.files.set('data/chats/two/messages.jsonl','');
    await h.driver.deleteSession('one');assert.equal(h.files.has('data/chats/one/messages.jsonl'),false);
    assert.equal(h.files.has('data/chats/two/messages.jsonl'),true);
    assert.equal(h.requests[0].body.params.path,'data/chats/one');
});
