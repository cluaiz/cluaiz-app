const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load}=require('./cepHarness.cjs');
const payload=load('src/features/api/utils/requestPayload.ts',{});
const groups=load('src/features/api/utils/catalogGroups.ts',{'lucide-react':require('lucide-react')});
const architecture=load('src/features/api/utils/architectureGraph.ts',{'./catalogGroups':groups,'./requestPayload':payload},
    {fetch:()=>{throw Error('Architecture inspection must not fetch or execute');}});
const {buildArchitectureGraph:build,architectureEndpointKey:key,availableArchitectureScenarios:scenarios,
    architectureSearch:search,architectureTransport:transport}=architecture;
const endpoint=(method,p,desc='A documented operation')=>({method,path:p,desc,...(!p.startsWith('/')?{transport_path:'/v1/cep'}:{})});
const entries=graph=>graph.nodes.flatMap(node=>node.groups.flatMap(group=>group.endpoints));
const json=value=>JSON.parse(JSON.stringify(value));
const fixture=[
    {group:'Chat',category:'ai-inference',endpoints:[endpoint('POST','/v1/chat/completions'),endpoint('POST','chat.cancel')]},
    ...['memory','notes','context','kv'].map(group=>({group,category:'ai-inference',endpoints:[endpoint('POST',group+'.read')]})),
    {group:'fs',category:'filesystem',endpoints:[endpoint('POST','fs.read'),endpoint('POST','fs.write')]},
    {group:'models',category:'models',endpoints:[endpoint('GET','/v1/models')]},
    {group:'tools',category:'agents-tools',endpoints:[endpoint('POST','tools.list')]},
    {group:'config',category:'system',endpoints:[endpoint('POST','config.get')]},
];

test('the actual generated catalog is fully reachable once without changing payloads, docs or object identity',()=>{
    const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/data/api-catalog.json'),'utf8'));
    const before=JSON.stringify(catalog), graph=build(catalog), expected=catalog.flatMap(group=>group.endpoints);
    assert.equal(graph.count,new Set(expected.map(key)).size);
    assert.deepEqual(new Set(entries(graph).map(key)),new Set(expected.map(key)));
    assert.equal(entries(graph).length,graph.count);
    assert.ok(entries(graph).every(value=>expected.includes(value)));
    assert.equal(JSON.stringify(catalog),before);
});

test('memory domains are separate from model computation and retain every group',()=>{
    const graph=build(fixture), memory=graph.nodes.find(node=>node.id==='memory');
    assert.deepEqual(json(memory.groups.map(group=>group.title)),['memory','notes','context','kv']);
    assert.deepEqual(json(graph.nodes.find(node=>node.id==='inference').groups.map(group=>group.title)),['Chat']);
    assert.equal(graph.edges.some(edge=>edge.from==='files'&&edge.to==='runtime'),false);
    assert.ok(graph.edges.some(edge=>edge.from==='inference'&&edge.to==='memory'));
    assert.equal(graph.edges.some(edge=>edge.from==='memory'&&edge.to==='saved'),true);
});

test('unknown categories and uncategorized methods are visible rather than silently dropped',()=>{
    const extra=[{group:'future',category:'new-category',endpoints:[endpoint('POST','future.operation')]},
        {group:'Uncategorized',endpoints:[endpoint('GET','/future/read')]}];
    const graph=build([...fixture,...extra]);
    assert.equal(graph.count,entries(build(fixture)).length+2);
    assert.deepEqual(new Set(graph.nodes.find(node=>node.id==='other').groups.flatMap(group=>group.endpoints.map(key))),
        new Set(extra.flatMap(group=>group.endpoints.map(key))));
});

test('identity distinguishes HTTP verbs and logical CEP methods sharing one transport',()=>{
    const read=endpoint('POST','fs.read'), write=endpoint('POST','fs.write');
    const get=endpoint('GET','/same'), post=endpoint('POST','/same');
    const graph=build([{group:'fs',category:'filesystem',endpoints:[read,write,get,post,read]}]);
    assert.equal(graph.count,4);assert.equal(entries(graph).length,4);
    assert.notEqual(key(read),key(write));assert.notEqual(key(get),key(post));
    assert.equal(transport(read),'CEP · /v1/cep');assert.equal(transport(get),'REST · /same');
});

test('changing the catalog changes counts and endpoints, while an empty catalog invents none',()=>{
    const before=build(fixture), after=build(fixture.slice(1));
    assert.equal(after.count,before.count-2);
    const empty=build([]);assert.equal(empty.count,0);assert.deepEqual(json(entries(empty)),[]);
    assert.ok(scenarios(empty).every(scenario=>!scenario.available));
});

test('every edge and every example step refers to an actual architecture node',()=>{
    for(const catalog of [[],fixture,fixture.slice(1)]){
        const graph=build(catalog), ids=new Set(graph.nodes.map(node=>node.id));
        assert.equal(ids.size,graph.nodes.length);
        assert.ok(graph.edges.every(edge=>ids.has(edge.from)&&ids.has(edge.to)));
        for(const scenario of scenarios(graph).filter(value=>value.available)){
            assert.ok(scenario.steps.every(step=>ids.has(step.node)),scenario.id);
        }
    }
});

test('walkthrough availability follows required groups, not a model-looking name or a guessed capability',()=>{
    const graph=build(fixture);
    assert.equal(scenarios(graph).find(value=>value.id==='ai-note').available,true);
    assert.equal(scenarios(graph).find(value=>value.id==='speech').available,false);
    const noNotes=build(fixture.filter(group=>group.group!=='notes'));
    assert.equal(scenarios(noNotes).find(value=>value.id==='ai-note').available,false);
    assert.equal(scenarios(noNotes).find(value=>value.id==='cache').available,true);
});

test('search finds exact methods, descriptions and group names without modifying examples or dispatching',()=>{
    const operation={...endpoint('POST','notes.create','Store a preference'),request_payload:'preserve this body',
        payload_examples:[{id:'owned-example',title:'Owned sample',payload:'preserve example'}]};
    const graph=build([{group:'Notes',category:'ai-inference',endpoints:[operation]}]);
    const node=graph.nodes.find(node=>node.id==='memory');
    for(const query of ['notes.create',' PREFERENCE ','notes'])assert.equal(search(node,query)[0].endpoints[0],operation);
    assert.equal(search(node,'unknown').length,0);
    assert.equal(operation.request_payload,'preserve this body');assert.equal(operation.payload_examples[0].payload,'preserve example');
});

test('projection and scenario output is deterministic for the same catalog',()=>{
    assert.deepEqual(json(build(fixture)),json(build(fixture)));
    assert.deepEqual(json(scenarios(build(fixture))),json(scenarios(build(fixture))));
});

test('progressive graph reaches every real API and keeps original parameters, payloads and response examples',()=>{
    const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/data/api-catalog.json'),'utf8'));
    const graph=build(catalog), reached=new Set();
    for(const owner of graph.nodes)for(const group of owner.groups)for(const endpoint of group.endpoints){
        const view=architecture.architectureView(graph,[owner.id,group.id,key(endpoint)]);
        const method=view.items.find(item=>item.kind==='api'&&item.endpoint===endpoint);
        assert.equal(method.endpoint,endpoint);assert.equal(view.path.length,3);reached.add(key(method.endpoint));
        assert.deepEqual(json(view.items.filter(item=>item.kind==='detail').map(item=>item.detail)),['processing']);
        assert.ok(view.items.filter(item=>item.kind==='detail').every(item=>item.endpoint===endpoint));
        const ids=new Set(view.items.map(item=>item.id));assert.equal(ids.size,view.items.length);
        assert.ok(view.edges.every(edge=>ids.has(edge.from)&&ids.has(edge.to)));
        assert.ok(view.edges.some(edge=>edge.from===method.id&&edge.to===view.focusId));
    }
    assert.equal(reached.size,graph.count);
});

test('expansion is bounded, supports back paths and recovers when a catalog entry disappears',()=>{
    const graph=build(fixture), root=architecture.architectureView(graph,[]);
    assert.equal(root.items.length,graph.nodes.length);assert.equal(root.items.some(item=>item.kind==='api'),false);
    const domain=architecture.architectureView(graph,['memory']);
    assert.equal(domain.items.filter(item=>item.kind==='group').length,4);
    const group=graph.nodes.find(item=>item.id==='memory').groups[0];
    const methods=architecture.architectureView(graph,['memory',group.id]);
    assert.equal(methods.items.filter(item=>item.kind==='api').length,group.endpoints.length);
    assert.deepEqual(json(architecture.architectureView(graph,['memory',group.id,'removed']).path),['memory',group.id]);
    assert.deepEqual(json(architecture.architectureView(graph,['removed']).path),[]);
    assert.equal(architecture.architectureView(build([]),[]).items.some(item=>item.kind==='api'),false);
});

test('search highlights context and explicit reveal opens the original matching method',()=>{
    const graph=build(fixture), view=architecture.architectureView(graph,[],'fs.write');
    assert.equal(view.matches,1);assert.equal(view.items.length,graph.nodes.length);
    const match=view.matchPaths[0], revealed=architecture.architectureView(graph,match.path,'fs.write');
    assert.equal(revealed.items.find(item=>item.matched).endpoint,fixture[5].endpoints[1]);
    assert.equal(architecture.architectureView(graph,[],'no-such-owned-method').items.length,graph.nodes.length);
});

test('expanding keeps every original root and previously revealed branch',()=>{
    const graph=build(fixture), roots=architecture.architectureView(graph,[]);
    const memory=architecture.architectureView(graph,['memory']);
    for(const item of roots.items)assert.ok(memory.items.some(next=>next.id===item.id),'missing root '+item.title);
    const group=graph.nodes.find(node=>node.id==='memory').groups[1];
    const notes=architecture.architectureView(graph,['memory',group.id]);
    const switched=architecture.architectureView(graph,['files'],'',[{path:['memory']},{path:['memory',group.id]}]);
    for(const item of notes.items.filter(item=>item.kind!=='detail'))assert.ok(switched.items.some(next=>next.id===item.id),'lost revealed '+item.title);
});

test('query and no-match states retain graph context instead of replacing the scene',()=>{
    const graph=build(fixture), roots=architecture.architectureView(graph,[]);
    for(const query of ['fs.write','no-such-owned-method']){
        const result=architecture.architectureView(graph,[],query);
        for(const item of roots.items)assert.ok(result.items.some(next=>next.id===item.id));
    }
});

test('canonical reveal history is idempotent and preserves prior examples when focus changes',()=>{
    const graph=build(fixture), group=graph.nodes.find(node=>node.id==='memory').groups[1];
    const path=['memory',group.id,key(group.endpoints[0])];
    const first=architecture.appendArchitectureReveal([],path);
    assert.equal(architecture.appendArchitectureReveal(first,path),first);
    const example={id:'owned-step',title:'Owned explanation',detail:'No execution'};
    const annotated=architecture.appendArchitectureReveal(first,['memory'],example);
    const view=architecture.architectureView(graph,['files'],'',annotated);
    assert.ok(view.placementItems.find(item=>item.exampleId===example.id));
    assert.equal(view.items.some(item=>item.exampleId===example.id),false);
    const note=view.items.find(item=>item.kind==='api'&&item.endpoint===group.endpoints[0]);
    assert.equal(note.active,false);
    assert.equal(view.items.find(item=>item.owner.id==='files').active,true);
    assert.equal(new Set(view.items.map(item=>item.id)).size,view.items.length);
});

test('explicit close folds only the chosen branch and retains placement reservations for others',()=>{
    const graph=build(fixture), group=graph.nodes.find(node=>node.id==='memory').groups[1];
    const path=['memory',group.id,key(group.endpoints[0])];
    let history=architecture.appendArchitectureReveal([],path);
    history=architecture.appendArchitectureReveal(history,['files']);
    const full=architecture.architectureView(graph,path,'',history);
    const folded=architecture.architectureView(graph,['memory'],'',history,undefined,[['memory']],null);
    assert.equal(folded.items.some(item=>item.path.length>1&&item.owner.id==='memory'),false);
    assert.equal(folded.items.filter(item=>item.kind==='detail').length,0);
    assert.ok(folded.items.some(item=>item.owner.id==='files'&&item.kind==='group'));
    const geometry=load('src/features/api/utils/architectureLayout.ts',{}),before=geometry.architectureLayout(full),after=geometry.architectureLayout(folded);
    for(const item of folded.items)assert.deepEqual(json(after.positions.get(item.id)),json(before.positions.get(item.id)));
    const reopened=architecture.architectureView(graph,['memory'],'',history,undefined,[['memory',group.id],path],['memory']);
    assert.ok(reopened.items.some(item=>item.kind==='group'&&item.owner.id==='memory'));
    assert.equal(reopened.items.some(item=>item.kind==='api'&&item.owner.id==='memory'),false);
    assert.equal(reopened.items.filter(item=>item.kind==='detail').length,1);
});

test('all real catalog expansions fit nonoverlapping slots while keeping every original root anchor',()=>{
    const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/data/api-catalog.json'),'utf8'));
    const graph=build(catalog), geometry=load('src/features/api/utils/architectureLayout.ts',{});
    const roots=geometry.architectureLayout(architecture.architectureView(graph,[]));let history=[];
    for(const owner of graph.nodes)for(const group of owner.groups)for(const endpoint of group.endpoints)
        history=architecture.appendArchitectureReveal(history,[owner.id,group.id,key(endpoint)]);
    const layout=geometry.architectureLayout(architecture.architectureView(graph,[],'',history));
    for(const [id,box] of roots.positions)assert.deepEqual(json(layout.positions.get(id)),json(box));
    const boxes=[...layout.positions.values()];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
    }
});

test('natural process height expands graph bounds without moving navigation or boxing the diagram',()=>{
    const graph=build(fixture), geometry=load('src/features/api/utils/architectureLayout.ts',{});
    const view=architecture.architectureView(graph,['memory']);
    const process=view.items.find(item=>item.kind==='detail');
    const before=geometry.architectureLayout(view), after=geometry.architectureLayout(view,{[process.id]:1800});
    for(const item of view.items.filter(item=>item.kind!=='detail'))
        assert.deepEqual(json(after.positions.get(item.id)),json(before.positions.get(item.id)));
    const box=after.positions.get(process.id);
    assert.equal(box.height,1800);
    assert.ok(after.bounds.height>=box.y+1800);
    for(const item of view.items.filter(item=>item.kind!=='detail')){
        const navigation=after.positions.get(item.id);
        assert.ok(box.x+box.width<=navigation.x||navigation.x+navigation.width<=box.x
            ||box.y+box.height<=navigation.y||navigation.y+navigation.height<=box.y);
    }
});

test('previous process diagrams do not reserve a distant column or an invisible vertical stack',()=>{
    const graph=build(fixture), geometry=load('src/features/api/utils/architectureLayout.ts',{});
    let history=[];
    for(const owner of graph.nodes)for(const group of owner.groups)for(const endpoint of group.endpoints)
        history=architecture.appendArchitectureReveal(history,[owner.id,group.id,key(endpoint)]);
    const view=architecture.architectureView(graph,['memory'],'',history);
    const process=view.items.find(item=>item.kind==='detail'),layout=geometry.architectureLayout(view);
    assert.equal([...layout.positions.keys()].filter(id=>view.placementItems.find(item=>item.id===id)?.kind==='detail').length,1);
    const parent=layout.positions.get(process.parentId),box=layout.positions.get(process.id);
    const dx=Math.max(parent.x-box.x-box.width,box.x-parent.x-parent.width,0);
    const dy=Math.max(parent.y-box.y-box.height,box.y-parent.y-parent.height,0);
    assert.ok(Math.hypot(dx,dy)<500,'one selected process stays in nearby available space');
});
