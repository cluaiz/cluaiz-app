const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(require.resolve('typescript',{paths:[path.join(__dirname,'../app')]}));

function load(file,imports){
    const exports={};
    const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
        jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    vm.runInNewContext(code,{exports,AbortController,Error,console,setTimeout,clearTimeout,require:name=>{
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
module.exports={load,harness};
