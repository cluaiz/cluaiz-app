const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(require.resolve('typescript',{paths:[path.join(__dirname,'../app')]}));

function load(file,imports){
    const exports={};
    const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
        jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    vm.runInNewContext(code,{exports,AbortController,Error,Blob,atob,btoa,console,setTimeout,clearTimeout,require:name=>{
        if(!(name in imports))throw Error('Unexpected import '+name);return imports[name];
    }});
    return exports;
}

/** Actual adapters; only the authenticated client transport boundary is injected. */
function harness(handler){
    const requests=[];
    const client={post:async(url,body,options)=>{
        requests.push({url,body,options});return handler(url,body,options);
    },get:async()=>{throw Error('Unexpected retired GET endpoint');}};
    const errors=load('src/api/client/errors.ts',{});
    const cep=load('src/api/client/cep.ts',{'./client':{client},'./errors':errors});
    const base={'../../client/cep':cep,'../../client/errors':errors};
    const config=load('src/api/engine/config/config.api.ts',base);
    const systemData=load('src/api/engine/system/systemData.ts',base);
    const permission=load('src/api/engine/permission/permission.api.ts',{
        '../../client':{client},'../config/config.api':config,'../../client/errors':errors,
        './permission.endpoints':{PERMISSION_ENDPOINTS:{}},
    });
    const models=load('src/api/engine/models/models.api.ts',{
        '../../client':{client},...base,'../permission/permission.api':permission,
        '../system/systemData':systemData,'./models.endpoints':{MODELS_ENDPOINTS:{}},
    });
    return {...cep,...config,...systemData,...permission,...models,errors,requests,client};
}
function filesystemHarness(handler){
    const h=harness(handler);
    return {...h,...load('src/api/engine/fs/fs.api.ts',{'../../client/cep':h,'../../client/errors':h.errors})};
}
function toolHarness(handler){
    const h=harness(handler);const shared={'../../client/cep':h,'../../client/errors':h.errors};
    const catalog=load('src/api/engine/tools/catalog.ts',shared);
    const tasks=load('src/api/client/cepTask.ts',{'./cep':h,'./errors':h.errors});
    const lifecycle=load('src/api/engine/tools/lifecycle.ts',{...shared,'../../client/cepTask':tasks,'./catalog':catalog});
    const cache=load('src/api/engine/tools/cache.ts',{...shared,'./catalog':catalog,'./lifecycle':lifecycle});
    const settings=load('src/api/engine/tools/settings.ts',{...shared,'./lifecycle':lifecycle});
    const files=load('src/api/engine/tools/files.ts',{...shared,'./lifecycle':lifecycle,'./cache':cache});
    const base={'../../../client':{client:h.client},'../../../client/errors':h.errors,
        '../catalog':catalog,'../lifecycle':lifecycle,'../cache':cache,'../settings':settings,'../files':files};
    const components=load('src/api/engine/tools/components/components.api.ts',{...base,'./components.endpoints':{COMPONENTS_ENDPOINTS:{}}});
    const api={...h,...tasks,...catalog,...lifecycle,...cache,...settings,...files,...components};
    for(const kind of ['skills','plugins','mcp'])Object.assign(api,load(`src/api/engine/tools/${kind}/${kind}.api.ts`,base));
    return api;
}
module.exports={load,harness,filesystemHarness,toolHarness};
