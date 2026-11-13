const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./cepHarness.cjs');
const normalize=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function client(handler,cache=new Map(),globals={}){
 const requests=[];let now=Date.now();
 const clock=class extends Date {static now(){return now;}};
 const api=load('src/api/catalogue/public.ts',{}, {URL,Response,TextDecoder,Date:clock,
  localStorage:{getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value)},...globals,
  fetch:async(url,options)=>{requests.push({url,options});return handler(url,options);},
 });
 return {...api,requests,cache,advance:ms=>{now+=ms;}};
}
const parse=value=>{if(!Array.isArray(value))throw Error('invalid fixture catalogue');return value;};
const url='https://cluaiz.com/api/v1/registry/models';
test('public catalogue coalesces reads, caches locally and never carries Engine credentials',async()=>{
 const pending=deferred(),h=client(()=>pending.promise);
 const a=h.readPublicCatalogue(url,parse),b=h.readPublicCatalogue(url,parse);
 pending.resolve(new Response('["item"]',{headers:{'Content-Type':'application/json'}}));
 assert.deepEqual(normalize((await a).data),['item']);await b;await h.readPublicCatalogue(url,parse,true);
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].options.credentials,'omit');
 assert.equal(h.requests[0].options.headers,undefined);assert.equal(h.requests[0].options.redirect,'error');
 assert.equal(h.requests[0].options.referrerPolicy,'no-referrer');assert.equal(h.cache.size,1);
});
test('stale catalogue survives a network failure; no automatic retries or writes to registry',async()=>{
 let fail=false;const h=client(()=>{if(fail)throw Error('offline');return new Response('["saved"]');});
 await h.readPublicCatalogue(url,parse);h.advance(25*60*60*1000);fail=true;
 const result=await h.readPublicCatalogue(url,parse);assert.deepEqual(normalize(result.data),['saved']);assert.match(result.warning,/saved catalogue/);
 await h.readPublicCatalogue(url,parse,true);assert.equal(h.requests.length,2);
 assert.ok(h.requests.every(r=>!r.options.method||r.options.method==='GET'));
});
test('429 Retry-After and failed first request persist a cooldown across client reload',async()=>{
 const h=client(()=>new Response('',{status:429,headers:{'retry-after':'3600'}}));
 await assert.rejects(h.readPublicCatalogue(url,parse),/429/);
 await assert.rejects(h.readPublicCatalogue(url,parse,true),/limited/);assert.equal(h.requests.length,1);
 h.advance(61*1000);await assert.rejects(h.readPublicCatalogue(url,parse,true),/limited/);assert.equal(h.requests.length,1);
 const reloaded=client(()=>assert.fail('cooldown must survive reload'),h.cache);
 await assert.rejects(reloaded.readPublicCatalogue(url,parse,true),/limited/);assert.equal(reloaded.requests.length,0);
});
test('non-approved, insecure, credential-bearing and query URLs are refused before dispatch',async()=>{
 const h=client(()=>assert.fail('no request'));
 for(const value of ['http://cluaiz.com/x','https://evil.invalid/x','https://name:secret@cluaiz.com/x','https://cluaiz.com/x?bypass=1','https://cluaiz.com:444/x']){
  await assert.rejects(h.readPublicCatalogue(value,parse),/Unsupported/);
 }
 assert.equal(h.requests.length,0);
});
test('oversized or malformed metadata cannot replace the last validated cache',async()=>{
 let response=new Response('["saved"]');const h=client(()=>response);
 await h.readPublicCatalogue(url,parse);h.advance(61000);
 response=new Response('bad',{headers:{'content-length':String(17*1024*1024)}});
 const result=await h.readPublicCatalogue(url,parse,true);assert.deepEqual(normalize(result.data),['saved']);assert.match(result.warning,/too large/);
 h.advance(61000);response=new Response('{}');assert.match((await h.readPublicCatalogue(url,parse,true)).warning,/invalid fixture/);
});
const models=load('src/api/catalogue/models.ts',{'./public':{}});
const variant=(id='v',quant='Q4_K_M')=>({id,quantTag:quant,format:'gguf',sizeBytes:123,primaryFile:'model.gguf',packageStatus:'declared_files_present'});
function catalogue(variants=[variant()]){return [{name:'Family',provider:'Provider',models:[{id:'catalog-model',name:'Example',hf_repo:'owner/repo',task:['text-generation'],package_selector:{allowed_quants:[...new Set(variants.map(v=>v.quantTag))]},package_variants:variants}]}];}
test('model metadata preserves actual variant bytes/status and installs by the Hugging Face repository',()=>{
 const [m]=models.parseModels(catalogue());assert.equal(m.variants[0].bytes,123);
 assert.equal(models.modelInstallReference(m,m.variants[0]),'owner/repo:Q4_K_M');
 assert.equal(m.repo,'owner/repo');assert.equal(m.support,'unknown');
});

test('the Hugging Face reference keeps the package checks and never needs the registry resolver',()=>{
 const [m]=models.parseModels(catalogue());
 assert.equal(models.modelInstallReference(m,m.variants[0]),'owner/repo:Q4_K_M');
 for(const repo of ['../private','owner/..','https://evil.invalid/model','owner/repo?bypass=1']){
  assert.throws(()=>models.modelInstallReference({...m,repo},m.variants[0]),/repository reference/);
 }
 const [ambiguous]=models.parseModels(catalogue([variant('a'),variant('b')]));
 assert.throws(()=>models.modelInstallReference(ambiguous,ambiguous.variants[0]),/Multiple/);
 const [incomplete]=models.parseModels(catalogue([{...variant(),packageStatus:'incomplete'}]));
 assert.throws(()=>models.modelInstallReference(incomplete,incomplete.variants[0]),/missing/);
});
test('ambiguous, incomplete, forged or unknown quant variants never get a guessed install target',()=>{
 const [m]=models.parseModels(catalogue([variant('a'),{...variant('b'),format:'onnx'}]));
 assert.throws(()=>models.modelInstallReference(m,m.variants[0]),/Multiple/);
 assert.throws(()=>models.modelInstallReference(m,{...m.variants[0]}),/unambiguous/);
 for(const item of [{...variant(),packageStatus:'incomplete'},variant('a','UNKNOWN')]){
  const [m]=models.parseModels(catalogue([item]));assert.throws(()=>models.modelInstallReference(m,m.variants[0]));
 }
 assert.throws(()=>models.parseModels(catalogue([variant(),variant()])),/Duplicate/);
});
test('bad model identity, excessive families and invalid byte counts fail validation',()=>{
 const data=catalogue();data[0].models[0].hf_repo='../../private';assert.throws(()=>models.parseModels(data),/identity/);
 assert.throws(()=>models.parseModels(new Array(257).fill({})),/families/);
 assert.throws(()=>models.parseModels(catalogue([{...variant(),sizeBytes:-1}])),/package/);
});
const tools=load('src/api/catalogue/tools.ts',{'./public':{readPublicCatalogue:async(url,parse)=>({data:parse({id:'other',hub_type:'skill'})})}});
test('official tool family local/remote pointers are parsed without executing package content',()=>{
 const values=tools.parseToolFamily({category:'skills',items:{example:{type:'local',path:'example/package.json'},remote:{type:'remote',repo:'owner/repo',branch:'main',manifest_path:'package.json'}}},'skills','skill');
 assert.equal(values[0].manifest,'https://raw.githubusercontent.com/cluaiz/cluaiz-tools/main/skills/example/package.json');
 assert.equal(values[1].manifest,'https://raw.githubusercontent.com/owner/repo/main/package.json');
});
test('tool pointer traversal, hostile sources and mismatched manifest identities are refused',async()=>{
 for(const item of [{type:'local',path:'../package.json'},{type:'local',path:'https://evil/manifest'},{type:'remote',repo:'../../bad',branch:'main',manifest_path:'package.json'}]){
  assert.throws(()=>tools.parseToolFamily({category:'skills',items:{example:item}},'skills','skill'));
 }
 await assert.rejects(tools.toolCatalogue.details({id:'expected',kind:'skill',manifest:'https://raw.githubusercontent.com/owner/repo/main/package.json'}),/identity/);
});
test('published legacy string pointers remain data and traversal remains refused',()=>{
 const values=tools.parseToolFamily({category:'skills',items:{example:'example/package.json'}},'skills','skill');
 assert.equal(values[0].manifest,'https://raw.githubusercontent.com/cluaiz/cluaiz-tools/main/skills/example/package.json');
 assert.throws(()=>tools.parseToolFamily({category:'skills',items:{example:'../../private.json'}},'skills','skill'));
});
test('legacy souls routing and a missing family preserve other published tools with an explicit warning',async()=>{
 const source=load('src/api/catalogue/tools.ts',{'./public':{readPublicCatalogue:async(url,parse)=>{
  let value;
  if(url.endsWith('/registry.json'))value={routing:{skills:'skills/family.json',souls:'souls/family.json'}};
  else if(url.endsWith('/skills/family.json'))value={category:'skills',items:{example:'example/package.json'}};
  else throw Error('HTTP 404');
  return {data:parse(value),saved:1};
 }}});
 const result=await source.toolCatalogue.list();assert.equal(result.data.length,1);assert.equal(result.data[0].kind,'skill');
 assert.match(result.warning,/souls catalogue unavailable.*404/);
});
test('corrupted persisted metadata is validated and replaced rather than trapping future reads',async()=>{
 const h=client(()=>new Response('["fresh"]'));
 h.cache.set('cluaiz_public_catalogue_v1:'+url,JSON.stringify({data:{bad:true},saved:Date.now()-1,retryAt:0}));
 const result=await h.readPublicCatalogue(url,parse);assert.deepEqual(normalize(result.data),['fresh']);assert.equal(h.requests.length,1);
});

test('each package downloads by the tag that names only its file, as the Engine matches tags inside file names',()=>{
 const files=[['UD-Q4_K_XL','Q4_K'],['Q4_K_M','Q4_K_M'],['Q4_K_S','Q4_K_S'],['Q6_K','Q6_K'],['UD-Q6_K_XL','Q6_K'],['BF16','BF16']];
 const [m]=models.parseModels(catalogue(files.map(([file,quant],i)=>({...variant('v'+i,quant),primaryFile:`Qwen3.5-4B-${file}.gguf`}))));
 assert.deepEqual(m.variants.map(v=>models.modelInstallReference(m,v)),['owner/repo:UD-Q4_K_XL','owner/repo:Q4_K_M','owner/repo:Q4_K_S','owner/repo:Qwen3.5-4B-Q6_K','owner/repo:UD-Q6_K_XL','owner/repo:BF16']);
 const [onnx]=models.parseModels(catalogue([['onnx/model_q4f16.onnx','Q4F16'],['onnx/model_int8.onnx','INT8']].map(([file,quant],i)=>({...variant('o'+i,quant),format:'onnx',primaryFile:file}))));
 assert.deepEqual(onnx.variants.map(v=>models.variantTag(onnx,v)),['q4f16','int8']);
});

test('a companion file (mtp-…) is not a package; its main package still downloads by its quantization',()=>{
 const [m]=models.parseModels(catalogue([['mtp-gemma-4-12B-it-Q4_0','Q4_0'],['gemma-4-12B-it-Q4_0','Q4_0'],['gemma-4-12B-it-Q8_0','Q8_0']].map(([file,quant],i)=>({...variant('g'+i,quant),primaryFile:file+'.gguf'}))));
 assert.equal(models.isCompanion(m,m.variants[0]),true);
 assert.throws(()=>models.modelInstallReference(m,m.variants[0]),/accompanies/);
 assert.deepEqual(m.variants.slice(1).map(v=>models.modelInstallReference(m,v)),['owner/repo:Q4_0','owner/repo:Q8_0']);
});


test('model choices use only the saved exact selection even if the API sends extra HF inventory',()=>{
 const data=catalogue([variant('selected','Q4_K_M'),variant('extra','UD-Q6_K_XL')]);
 const row=data[0].models[0];row.package_selector={allowed_quants:['Q4_K_M']};
 assert.deepEqual(normalize(models.parseModels(data)[0].variants.map(v=>v.quant)),['Q4_K_M']);
 row.package_selector={allowed_quants:[]};assert.equal(models.parseModels(data)[0].variants.length,0);
 delete row.package_selector;assert.equal(models.parseModels(data)[0].variants.length,0);
 row.package_selector={primary_file:'model.gguf'};assert.equal(models.parseModels(data)[0].variants.length,2);
 row.package_selector={allowed_quants:'Q4_K_M'};assert.throws(()=>models.parseModels(data),/saved quant selection/);
});

test('curated model cache rechecks after one minute without clearing unrelated catalogues',async()=>{
 let version=1;const h=client(()=>new Response(JSON.stringify([version])));
 assert.deepEqual(normalize((await h.readPublicCatalogue(url,parse)).data),[1]);
 version=2;h.advance(61000);
 assert.deepEqual(normalize((await h.readPublicCatalogue(url,parse)).data),[2]);assert.equal(h.requests.length,2);
});

test('explicit dev origin permits only its model/readme endpoints and isolates cached production data',async()=>{
 const origin='http://localhost:3000',cache=new Map();
 const production=client(()=>new Response(JSON.stringify(['production'])),cache);
 await production.readPublicCatalogue(url,parse);
 const local=client(()=>new Response(JSON.stringify(['local'])),cache,{__CLUAIZ_MODEL_REGISTRY_ORIGIN__:origin});
 assert.deepEqual(normalize((await local.readPublicCatalogue(origin+'/api/v1/registry/models',parse)).data),['local']);
 assert.equal(local.requests[0].options.credentials,'omit');
 await local.readPublicCatalogue(origin+'/api/v1/registry/models/readme?family=f&model=m',parse);
 for(const bad of [origin+'/api/admin/models',origin+'/api/v1/registry/models?bypass=1','http://127.0.0.1:3000/api/v1/registry/models','http://localhost:3001/api/v1/registry/models']){
  await assert.rejects(local.readPublicCatalogue(bad,parse),/Unsupported/);
 }
 const ordinary=client(()=>new Response('[]'));
 await assert.rejects(ordinary.readPublicCatalogue(origin+'/api/v1/registry/models',parse),/Unsupported/);
});

test('model list and README share the configured registry origin',async()=>{
 const calls=[];const origin='http://localhost:3000';const adapter=load('src/api/catalogue/models.ts',{'./public':{
  MODEL_REGISTRY_ORIGIN:origin,readPublicCatalogue:(url)=>{calls.push(url);return Promise.resolve({data:[]});}}},{URLSearchParams});
 await adapter.modelCatalogue.list();await adapter.modelReadme({id:'saved',familyId:'family'});
 assert.equal(calls[0],origin+'/api/v1/registry/models');assert.match(calls[1],/^http:\/\/localhost:3000\/api\/v1\/registry\/models\/readme\?/);
});
