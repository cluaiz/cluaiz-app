const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,load}=require('./cepHarness.cjs');
const result=(request,value)=>({jsonrpc:'2.0',id:request.id,result:value});

function settingsHarness(handler){
    const h=harness(handler);
    const base={'../config/config.api':h,'../../client/cep':h,'../../client/errors':h.errors};
    const system=load('src/api/engine/system/system.api.ts',{
        '../../client':{client:h.client},'./system.endpoints':{SYSTEM_ENDPOINTS:{}},
        '../permission/permission.api':h,'./systemData':h,...base,
    });
    const inference=load('src/api/engine/inference/inference.api.ts',base);
    const optimization=load('src/api/engine/llm-optimization/optimization.api.ts',base);
    const storage=load('src/api/engine/storage/storage.api.ts',base);
    const memory=load('src/api/engine/chat-memory/chatMemory.api.ts',base);
    return {...h,...system,...inference,...optimization,...storage,...memory};
}

const hardware=()=>({architecture:'x86_64',os_name:'fixture',os_version:'fixture',
    cpu:{brand:'fixture CPU',physical_cores:12,logical_threads:24,frequency_mhz:3000},
    memory:{total_gb:48,available_gb:30},
    gpus:[{index:0,name:'GPU one',vendor:'fixture',vram_total_bytes:3*1024**3,vram_free_bytes:2*1024**3},
        {index:1,name:'GPU two',vendor:'fixture',vram_total_bytes:6*1024**3,vram_free_bytes:4*1024**3}]});

test('hardware inventory and model alias share real system.info without guessed capacity',async()=>{
    const profile=hardware();
    const info={engine:'Engine',version:'test',cep_version:1,hardware:profile,network:{lan_ip:null}};
    const h=settingsHarness((url,body)=>result(body,info));
    const summary=await h.modelsApi.getHardware();
    assert.equal(summary.hardware.ram_gb,48);assert.equal(summary.hardware.vram_gb,9);
    assert.equal(summary.hardware.cpu_cores,12);assert.equal(summary.hardware.has_gpu,true);
    assert.equal((await h.systemApi.getHardwareInfo()).hardware,profile);
    assert.ok(h.requests.every(request=>request.body.method==='system.info'));
    profile.gpus=[];
    const cpu=await h.modelsApi.getHardware();assert.equal(cpu.hardware.has_gpu,false);assert.equal(cpu.hardware.vram_gb,0);
});

test('live telemetry remains the Engine shape, without fabricated CPU load or process RSS',async()=>{
    const profile=hardware();const value={process_id:42,cpu:profile.cpu,memory:{...profile.memory,used_gb:18},gpus:profile.gpus};
    const h=settingsHarness((url,body)=>result(body,value));
    const live=await h.systemApi.getLiveTelemetry();assert.equal(live,value);
    assert.equal(live.cpu.utilization_pct,undefined);assert.equal(live.engine_process,undefined);
    const bad=settingsHarness((url,body)=>result(body,{hardware:{}}));
    await assert.rejects(bad.modelsApi.getHardware(),error=>error.statusText==='INVALID_SYSTEM_RESPONSE');
});

test('system processes and plan retain native fields and per-request planning options',async()=>{
    const plan={model_info:{model_id:'installed',inputs:[{type:'image',available:true}]},
        execution_plan:{context_window:512},active_user_settings:{n_gpu_layers:null},hardware_info:{}};
    const processes={active_processes:[],hardware_snapshot:hardware()};
    const h=settingsHarness((url,body)=>result(body,body.method==='system.plan'?plan:processes));
    const payload={model:'installed',n_ctx:512,batch_tokens:64,vram_buffer_gb:0,ram_buffer_gb:0};
    assert.equal(await h.systemApi.planExecution(payload),plan);
    assert.equal(h.requests[0].body.params,payload);
    assert.equal(await h.systemApi.compareLatency(payload),plan);
    assert.equal(await h.systemApi.getProcesses(),processes);
    assert.equal(h.requests[2].body.method,'system.ps');
});

test('unsupported Brain Mode and calibration refuse without dispatch or fake success',async()=>{
    const h=settingsHarness(()=>{throw Error('Unsupported operation dispatched');});
    for(const call of [()=>h.systemApi.getSystemControl(),()=>h.systemApi.updateSystemControl({brain_mode:true}),
        ()=>h.inferenceApi.calibrateHardware()]){
        await assert.rejects(call(),error=>error.status===501&&error.statusText==='UNSUPPORTED_OPERATION');
    }
    assert.equal(h.requests.length,0);
});

test('configuration sections keep saved null/zero/false values and reject missing sections',async()=>{
    const saved={n_gpu_layers:null,batch_size:0,use_mmap:false};
    const h=settingsHarness((url,body)=>result(body,{[body.params.section]:saved}));
    assert.equal(await h.getConfig('optimization'),saved);
    assert.equal((await h.optimizationApi.getStatus()).optimization,saved);
    assert.equal((await h.optimizationApi.update({n_gpu_layers:null})).optimization,saved);
    assert.equal(h.requests[2].body.method,'config.set');
    assert.equal(h.requests[2].body.params.patch.n_gpu_layers,null);
    const bad=settingsHarness((url,body)=>result(body,{wrong_section:{}}));
    await assert.rejects(bad.getConfig('gguf'),error=>error.statusText==='INVALID_CONFIG_RESPONSE');
});

test('partial GGUF sampler changes retain other samplers and return acknowledged sections',async()=>{
    const gguf={hardware_and_execution:{n_ctx:0,n_gpu_layers:-1},samplers:{temp:null,top_k:31,seed:0},user_moved_flags:{think_mode:'Auto'}};
    const onnx={n_gpu_layers:0,intra_op_num_threads:2};
    const h=settingsHarness((url,body)=>{
        const section=body.params.section;
        if(body.method==='config.set'){
            if(section==='gguf')Object.assign(gguf,body.params.patch);else Object.assign(onnx,body.params.patch);
        }
        return result(body,{[section]:section==='gguf'?gguf:onnx});
    });
    const saved=await h.inferenceApi.saveGguf({samplers:{temp:0.2}});
    assert.equal(saved.gguf.samplers.temp,0.2);assert.equal(saved.gguf.samplers.top_k,31);assert.equal(saved.gguf.samplers.seed,0);
    assert.equal(h.requests[0].body.method,'config.get');assert.equal(h.requests[1].body.method,'config.set');
    assert.equal((await h.inferenceApi.saveOnnx({n_gpu_layers:-1})).onnx.n_gpu_layers,-1);
});

const toast={promise:async promise=>typeof promise==='function'?promise():promise};

test('optimization store uses saved values and rolls back only its failed draft',async()=>{
    let fail=false;
    const h=settingsHarness((url,body)=>{
        if(fail)throw Error('Save refused');
        return result(body,{optimization:{n_gpu_layers:7,custom_ram_buffer_gb:null}});
    });
    const store=load('src/api/engine/llm-optimization/optimization.store.ts',{
        zustand:require('zustand'),'./optimization.api':h,'../../client/errors':h.errors,
    }).useOptimizationStore;
    await store.getState().load();await store.getState().updateField('n_gpu_layers',99);
    assert.equal(store.getState().optimization.n_gpu_layers,7);
    fail=true;await store.getState().updateField('n_gpu_layers',12);
    assert.equal(store.getState().optimization.n_gpu_layers,7);assert.equal(store.getState().status,'error');
});

test('inference store accepts saved defaults and a late save does not overwrite a newer draft',async()=>{
    let resolveSave;
    const saved={hardware_and_execution:{n_ctx:2048},samplers:{temp:null},user_moved_flags:{think_mode:'Auto'}};
    const h=settingsHarness((url,body)=>body.method==='config.get'?result(body,{[body.params.section]:saved}):
        new Promise(resolve=>{resolveSave=()=>resolve(result(body,{gguf:saved}));}));
    const store=load('src/api/engine/inference/inference.store.ts',{
        zustand:require('zustand'),'./inference.api':h,'../../client/errors':h.errors,
        '../../../components/ui/toast':{toast},
    }).useInferenceStore;
    await store.getState().load();
    const next={...saved,hardware_and_execution:{n_ctx:1024}};
    const saving=store.getState().saveGguf(next);
    await new Promise(resolve=>setImmediate(resolve));resolveSave();await saving;
    assert.equal(store.getState().gguf.hardware_and_execution.n_ctx,2048);
    const second=store.getState().saveGguf(next);
    await new Promise(resolve=>setImmediate(resolve));
    const later={...saved,hardware_and_execution:{n_ctx:4096}};store.setState({gguf:later});
    resolveSave();await second;assert.equal(store.getState().gguf,later);
});

test('storage cleanup reports actual counts and refreshes remaining usage instead of assuming zero',async()=>{
    const remaining={file_count:3,total_size_bytes:96,total_size_mb:'0.00 MB'};
    const h=settingsHarness((url,body)=>result(body,body.method==='storage.clean'?{removed_files:2,freed_bytes:64}:
        body.method==='storage.status'?remaining:{storage:{cleanup_policy:'Never'}}));
    const clean=await h.storageApi.cleanTempMedia();assert.equal(clean.removed_files,2);assert.equal(clean.freed_bytes,64);
    const store=load('src/api/engine/storage/storage.store.ts',{
        zustand:require('zustand'),'./storage.api':h,'../../client/errors':h.errors,
    }).useStorageStore;
    await store.getState().load();await store.getState().cleanMedia();
    assert.equal(store.getState().mediaStatus.file_count,3);
    await store.getState().updateSettings({cleanup_policy:'Hourly'});
    assert.equal(store.getState().settings.cleanup_policy,'Never');
});

test('saved KV settings and usage are joined; deletion uses CEP chat ids without URL rewriting',async()=>{
    const settings={enabled:true,max_disk_gb:4,max_age_days:30};
    const usage={directory:'fixture-cache',bytes:15,chats:[]};
    const h=settingsHarness((url,body)=>result(body,body.method==='kv.status'?usage:
        body.method==='kv.delete'?{chat_id:body.params.chat_id,deleted:true}:
        body.method==='kv.clear'?{deleted:2}:{kv:settings}));
    const status=await h.chatMemoryApi.getStatus();assert.equal(status.settings,settings);assert.equal(status.bytes,15);
    assert.equal((await h.chatMemoryApi.updateSettings({enabled:false})).bytes,15);
    const id='chat with/slash & text';assert.equal((await h.chatMemoryApi.deleteChat(id)).chat_id,id);
    assert.equal((await h.chatMemoryApi.clear()).deleted,2);
    assert.ok(h.requests.every(request=>request.url==='/v1/cep'));
    const bad=settingsHarness((url,body)=>result(body,body.method==='kv.status'?{}:{kv:settings}));
    await assert.rejects(bad.chatMemoryApi.getStatus(),error=>error.statusText==='INVALID_KV_RESPONSE');
});

test('the existing Engine settings screen marks unsupported Brain Mode disabled',()=>{
    const React=require('react'),captured=[];
    const state={fetchStatus:'success',permissions:{active_slots:{}},booster:{},brainMode:false,
        hardware:null,installedModelsMap:{},pendingKeys:{},activeChatModel:null,activeVectorModel:null};
    const useEngineStore=selector=>selector?selector(state):state;
    const empty=()=>null;
    const screen=load('src/features/settings/EngineSettings.tsx',{
        react:React,'react/jsx-runtime':require('react/jsx-runtime'),
        '../../store/engine/useEngineStore':{useEngineStore},
        './SharedComponents':{SettingSection:({children})=>React.createElement('section',null,children),
            SettingItem:props=>{captured.push(props);return null;}},
        './SettingsHealthValidator':{validateSettings:()=>[],getOverallHealth:()=> 'green'},
        './ModelInfoCard':{ModelInfoCard:empty},'./ModelInspectorModal':{ModelInspectorModal:empty},
        './TtsVoiceSelector':{TtsVoiceSelector:empty},'./SttLanguageSelector':{SttLanguageSelector:empty},
        '../../components/ui/dropdown/CustomDropdown':{CustomDropdown:empty},'lucide-react':require('lucide-react'),
    });
    require('react-dom/server').renderToStaticMarkup(React.createElement(screen.EngineSettings));
    const control=captured.find(props=>props.label==='Pure Brain Mode (LLM OFF)');
    assert.ok(control);assert.equal(control.disabled,true);
    assert.match(control.description,/Unavailable/);
});

test('a failed debounced settings save restores the last acknowledged value',async()=>{
    const onnx={n_gpu_layers:0,intra_op_num_threads:2};
    const h=settingsHarness((url,body)=>{
        if(body.method==='config.set')throw Error('Save refused');
        return result(body,{[body.params.section]:body.params.section==='onnx'?onnx:{samplers:{}}});
    });
    const store=load('src/api/engine/inference/inference.store.ts',{
        zustand:require('zustand'),'./inference.api':h,'../../client/errors':h.errors,
        '../../../components/ui/toast':{toast},
    }).useInferenceStore;
    await store.getState().load();store.getState().updateOnnxField('intra_op_num_threads',3);
    const deadline=Date.now()+2000;
    while(store.getState().status!=='error'&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(store.getState().status,'error');
    assert.equal(store.getState().onnx.intra_op_num_threads,2);
});
