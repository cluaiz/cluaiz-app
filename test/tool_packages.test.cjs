const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./cepHarness.cjs');

test('a section lists its published packages, each with its manifest details; an unreadable manifest leaves the package listed',async()=>{
  const reads=[];
  const tools=load('src/api/catalogue/tools.ts',{'./public':{readPublicCatalogue:async(url,parse)=>{
    reads.push(url);
    if(url.endsWith('registry.json'))return{data:parse({routing:{mcp:'mcp/family.json',skills:'skills/family.json'}}),saved:1};
    if(url.endsWith('mcp/family.json'))return{data:parse({category:'mcp',items:{git:'git/package.json',fetch:'fetch/package.json'}}),saved:1};
    if(url.endsWith('skills/family.json'))return{data:parse({category:'skills',items:{notes:'notes/package.json'}}),saved:1};
    if(url.endsWith('git/package.json'))return{data:parse({id:'git',hub_type:'mcp',name:'Git',author:{name:'Cluaiz'},latest_version:'1.0.0',tags:['Code']}),saved:1};
    throw Error('offline');
  }}});
  const result=await tools.toolCatalogue.packages('mcp');
  assert.deepEqual(JSON.parse(JSON.stringify(result.data.map(item=>[item.tool.id,item.details?.name??null,item.details?.author??null]))),[['git','Git','Cluaiz'],['fetch',null,null]]);
  assert.equal(reads.some(url=>url.includes('notes/package.json')),false);
});

test('packages are searched by name, id, author, description and tags; tool sections map to Engine kinds',()=>{
  const view=load('src/features/extensions/toolPackages.ts',{react:{},zustand:{create:()=>()=>({})},
    '../../api/catalogue/tools':{},'../../api/engine/tools/catalog':{},'../../store/engine/useConnectionStore':{},
    './useCatalogue':{},'./toolkitNavigation':{},'./useToolkitUrl':{}});
  const items=[{id:'git',name:'Git',details:{author:'Cluaiz',description:'Reads repositories',tags:['Code']}},
    {id:'fetch',name:'Fetch',details:{author:'Anthropic',description:'Reads web pages',tags:['Web']}},
    {id:'local-only',name:'Local only',installed:{description:'Installed by hand'}}];
  assert.deepEqual([...view.searchPackages(items,'web').map(item=>item.id)],['fetch']);
  assert.deepEqual([...view.searchPackages(items,'cluaiz').map(item=>item.id)],['git']);
  assert.deepEqual([...view.searchPackages(items,'by hand').map(item=>item.id)],['local-only']);
  assert.equal(view.searchPackages(items,'  ').length,3);
  assert.equal(view.SECTION_KIND.skills,'skill');
  assert.equal(view.isToolSection('mcp'),true);
  assert.equal(view.isToolSection('models'),false);
  assert.equal(view.isToolSection('constructor'),false);
});

test('a package page reads what its package.json declares and its README beside the manifest',async()=>{
  const reads=[];
  const tools=load('src/api/catalogue/tools.ts',{'./public':{readPublicCatalogue:async(url,parse)=>{
    reads.push(url);
    if(url.endsWith('README.md'))return{data:parse('# Context7\nLooks up docs'),saved:1};
    return{data:parse({id:'context7',hub_type:'mcp',name:'Context7 Docs',license:'MIT',triggers:['library docs'],
      execution:{command:'npx',args:['-y','@upstash/context7-mcp@4.5.1']},
      permissions:{network:{info:'Sends library names',allow:true,hosts:['context7.com']}},
      env:{CONTEXT7_API_KEY:{info:'A free key',need:'optional'}},functions:[{name:'resolve'},{bad:1}]}),saved:1};
  }}},{URL});
  const tool={id:'context7',kind:'mcp',manifest:'https://raw.githubusercontent.com/cluaiz/cluaiz-tools/main/mcp/context7/package.json'};
  const details=JSON.parse(JSON.stringify((await tools.toolCatalogue.details(tool)).data));
  assert.equal(details.license,'MIT');
  assert.equal(details.command,'npx -y @upstash/context7-mcp@4.5.1');
  assert.deepEqual(details.network,{info:'Sends library names',hosts:['context7.com']});
  assert.deepEqual(details.env,[{name:'CONTEXT7_API_KEY',need:'optional',info:'A free key'}]);
  assert.deepEqual(details.functions,['resolve']);
  assert.match(details.manifest,/"license": "MIT"/);
  assert.equal((await tools.toolCatalogue.readme(tool)).data,'# Context7\nLooks up docs');
  assert.equal(reads.at(-1),'https://raw.githubusercontent.com/cluaiz/cluaiz-tools/main/mcp/context7/README.md');
});

test('a published package lists the files in its repository folder and reads text files, never binaries',async()=>{
  const reads=[];
  const tools=load('src/api/catalogue/tools.ts',{'./public':{readPublicCatalogue:async(url,parse,refresh,keep)=>{
    reads.push(url);
    if(url.startsWith('https://api.github.com/'))return{data:parse(keep({tree:[{path:'mcp/fetch/package.json',type:'blob'},
      {path:'mcp/fetch/assets',type:'tree'},{path:'mcp/fetch/assets/icon.svg',type:'blob'},{path:'mcp/git/package.json',type:'blob'},{path:'README.md',type:'blob'}]})),saved:1};
    if(url.endsWith('package.json'))return{data:parse({id:'fetch'}),saved:1};
    return{data:parse('<svg/>'),saved:1};
  }}},{URL});
  const tool={id:'fetch',kind:'mcp',manifest:'https://raw.githubusercontent.com/cluaiz/cluaiz-tools/main/mcp/fetch/package.json'};
  const files=JSON.parse(JSON.stringify(await tools.toolCatalogue.files(tool)));
  assert.equal(reads[0],'https://api.github.com/repos/cluaiz/cluaiz-tools/git/trees/main?recursive=1');
  assert.deepEqual(files,[{path:'package.json',is_dir:false,name:'package.json'},{path:'assets',is_dir:true,name:'assets'},{path:'assets/icon.svg',is_dir:false,name:'icon.svg'}]);
  assert.equal(await tools.toolCatalogue.file(tool,'assets/icon.svg'),'<svg/>');
  assert.equal(reads.at(-1),'https://raw.githubusercontent.com/cluaiz/cluaiz-tools/main/mcp/fetch/assets/icon.svg');
  assert.match(await tools.toolCatalogue.file(tool,'package.json'),/"id": "fetch"/);
  await assert.rejects(tools.toolCatalogue.file(tool,'fetch.wasm'),/binary/);
  await assert.rejects(tools.toolCatalogue.file(tool,'../git/package.json'),/Invalid/);
});

test('an observed task reads only new events and reports the latest stage; install stages map to steps',async()=>{
  const calls=[];
  const errors=load('src/api/client/errors.ts',{});
  const replies=[
    {task_id:'t',method:'tools.install',status:'working',events:[{stage:'planned'}],next:1},
    {task_id:'t',method:'tools.install',status:'working',events:[{stage:'approval',approval_id:'a1'},{note:'x'}],next:3},
    {task_id:'t',method:'tools.install',status:'completed',events:[],next:3},
  ];
  const cep={callCep:async(name,params)=>{calls.push([name,params]);return name==='tasks.get'?replies.shift():{ok:true};},CepError:class extends Error{}};
  const tasks=load('src/api/client/cepTask.ts',{'./cep':cep,'./errors':errors},{setTimeout:(fn)=>{fn();return 0;},clearTimeout(){}});
  const seen=[];
  await tasks.resumeCepTask('tools.install','t',undefined,task=>seen.push([task.status,task.stage??null,task.stageEvent?.approval_id??null]));
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(([name])=>name==='tasks.get').map(([,params])=>params.after))),[0,1,3]);
  assert.deepEqual(JSON.parse(JSON.stringify(seen)),[['working','planned',null],['working','approval','a1'],['completed','approval','a1']]);
  const view=load('src/features/extensions/toolPackages.ts',{react:{},zustand:{create:()=>()=>({})},
    '../../api/catalogue/tools':{},'../../api/engine/tools/catalog':{},'../../store/engine/useConnectionStore':{},
    './useCatalogue':{},'./toolkitNavigation':{},'./useToolkitUrl':{}});
  assert.deepEqual({...view.installStep('installing')},{step:2,label:'Installing'});
  assert.deepEqual({...view.installStep('approval')},{step:1,label:'Waiting for approval'});
  assert.deepEqual({...view.installStep('constructor')},{step:0,label:'Starting'});
  assert.equal(view.INSTALL_STEPS,3);
});
