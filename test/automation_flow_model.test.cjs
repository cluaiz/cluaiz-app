const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {load}=require('./cepHarness.cjs');
const yaml=require(require.resolve('yaml',{paths:[path.join(__dirname,'..')]}));

const icons=new Proxy({},{get:(_,name)=>name});
const kinds=load('src/features/automation/model/kinds.ts',{'lucide-react':icons});
const doc=load('src/features/automation/model/flowDoc.ts',{yaml});
const graph=load('src/features/automation/model/flowGraph.ts',{'./kinds':kinds,'./flowDoc':doc});
const plain=value=>JSON.parse(JSON.stringify(value));

const FLOW=`# keeps notes
flow: cluaiz.flow/1
name: mail
on:
  - schedule: "0 9 * * *"
steps:
  - id: mails
    tool: mcp:mail/unread
  - id: judge
    if: { gt: [1, 0] }
    then:
      - ask: "Urgent?"   # a model decides
    else:
      - set: { quiet: true }
  - id: every
    each: "\${{ steps.mails.output }}"
    do:
      - call: fs.write
  - id: report
    needs: [mails]
    ask: Write it
    on_error: [{ fail: broken }]
`;

test('a flow becomes nodes and edges: triggers, the list in order, branches, loops, needs and error steps',()=>{
  const {value}=doc.readFlow(FLOW);
  const g=graph.flowGraph(value);
  const ids=g.nodes.map(node=>node.id);
  assert.deepEqual(plain(ids),['trigger:0','mails','judge','judge.then.0','judge.else.0','every','every.do.0','report','report.on_error.0','add']);
  const edge=(source,target)=>g.edges.find(item=>item.source===source&&item.target===target);
  assert.equal(edge('trigger:0','mails').kind,'next');
  assert.deepEqual(plain(edge('judge','judge.then.0').insert),{list:['steps',1,'then'],index:0});
  assert.equal(edge('judge','judge.then.0').sourceHandle,'then');
  assert.ok(edge('judge.then.0','every')&&edge('judge.else.0','every'),'both branches join the next step');
  assert.deepEqual(plain(edge('judge.then.0','every').insert),{list:['steps',1,'then'],index:1});
  assert.equal(edge('every.do.0','every').kind,'loop');
  assert.equal(edge('every','add').sourceHandle,'done');
  assert.equal(edge('mails','report').kind,'needs','a step with needs waits for those, not the step above');
  assert.equal(edge('every','report'),undefined);
  assert.equal(edge('report','report.on_error.0').sourceHandle,'error');
  assert.equal(g.pointers.get('/steps/1/then/0'),'judge.then.0');
  const judge=g.nodes.find(node=>node.id==='judge');
  assert.deepEqual(plain(judge.data.outlets.map(outlet=>outlet.id)),['then','else']);
});

test('a flow without triggers starts by hand; an empty loop body offers a place for its first step',()=>{
  const g=graph.flowGraph({flow:'cluaiz.flow/1',name:'x',steps:[{id:'a',repeat:[],until:true,max:3}]});
  assert.equal(g.nodes[0].type,'start');
  const ghost=g.nodes.find(node=>node.id==='add:a');
  assert.deepEqual(plain(ghost.data.at),{list:['steps',0,'repeat'],index:0});
});

test('edits keep comments, insert into lists that do not exist yet, move, copy with new ids and point at lines',()=>{
  const inserted=doc.editFlow(FLOW,'yaml',doc.insertStep({list:['steps',3,'else'],index:0},{set:{a:1}}));
  assert.match(inserted,/# keeps notes/);
  assert.match(inserted,/# a model decides/);
  assert.deepEqual(plain(doc.readFlow(inserted).value.steps[3].else),[{set:{a:1}}]);
  const moved=doc.editFlow(FLOW,'yaml',doc.moveAt(['steps',0],1));
  assert.deepEqual(plain(doc.readFlow(moved).value.steps.map(step=>step.id)),['judge','mails','every','report']);
  const named=doc.editFlow(FLOW,'yaml',doc.setStepId(['steps',1,'then',0],'urgent'));
  assert.deepEqual(plain(Object.keys(doc.readFlow(named).value.steps[1].then[0])),['id','ask']);
  const used=doc.stepIds(doc.readFlow(FLOW).value);
  assert.equal(doc.freshId('mails',used),'mails_2');
  assert.equal(doc.freshId('9-x',used),'x');
  assert.deepEqual(plain(doc.copyWithIds({id:'report',ask:'x',on_error:[{id:'mails',fail:'y'}]},used)),{id:'report_2',ask:'x',on_error:[{id:'mails_2',fail:'y'}]});
  assert.equal(doc.lineRange(FLOW,['steps',1]),'L9-L14');
  const json=doc.editFlow('{"flow":"cluaiz.flow/1","name":"j","steps":[]}','json',doc.setValue(['description'],'d'));
  assert.equal(JSON.parse(json).description,'d');
  assert.equal(doc.pointerOf(['steps',1,'with','a/b']),'/steps/1/with/a~1b');
});

test('every step kind and trigger has a look and a template that names its own kind',()=>{
  for(const [key,view] of Object.entries(kinds.STEP_KINDS))assert.equal(kinds.stepKind(view.template),key);
  for(const [key,view] of Object.entries(kinds.TRIGGER_KINDS))assert.equal(kinds.triggerKind(view.template),key);
  assert.equal(kinds.stepKind({each:[],parallel:2,do:[]}),'each','a field named like a later kind does not change the kind');
});
