const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./cepHarness.cjs');
const m=load('src/features/api/utils/architectureLayout.ts',{});
const start={x:35,y:-70,scale:0.8};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('zero/non-finite wheel input is unchanged; magnitude and units determine scaling',()=>{
    for(const delta of [0,NaN,Infinity,-Infinity])assert.equal(m.wheelFactor(delta,0,900),1);
    const small=m.wheelFactor(1,0,900), large=m.wheelFactor(100,0,900);
    assert.ok(large<small&&small<1);
    near(m.wheelFactor(1,1,900),m.wheelFactor(16,0,900));
    near(m.wheelFactor(1,2,100),m.wheelFactor(100,0,900));
    assert.equal(m.zoomViewport(start,1,200,300),start);
});
test('zoom retains the world-space point under the pointer and safely clamps/reverses',()=>{
    const x=431,y=217;
    for(const factor of [0.00001,0.8,1.2,1000]){
        const next=m.zoomViewport(start,factor,x,y);
        near((x-start.x)/start.scale,(x-next.x)/next.scale);
        near((y-start.y)/start.scale,(y-next.y)/next.scale);
        assert.ok(next.scale>=m.MIN_SCALE&&next.scale<=m.MAX_SCALE);
    }
    const minimum=m.zoomViewport(start,0.00001,x,y);
    assert.ok(m.zoomViewport(minimum,1.2,x,y).scale>minimum.scale);
    for(const factor of [NaN,Infinity,0,-1])assert.equal(m.zoomViewport(start,factor,x,y),start);
});
test('visible graph boxes never overlap and fit includes all bounds without a guessed API count',()=>{
    const owner={id:'owned'};
    const view={items:Array.from({length:18},(_,i)=>({id:String(i),column:i%4,kind:i%5===0?'detail':'api',owner})),path:['owned'],edges:[]};
    const layout=m.architectureLayout(view), boxes=[...layout.positions.values()];
    for(let i=0;i<boxes.length;i++){
        const a=boxes[i];assert.ok(a.x+a.width<=layout.bounds.width&&a.y+a.height<=layout.bounds.height);
        for(let j=i+1;j<boxes.length;j++){
            const b=boxes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
        }
    }
    const fit=m.fitViewport(layout.bounds,1440,950);
    assert.ok(Number.isFinite(fit.x)&&Number.isFinite(fit.y));
    const detail=m.fitViewport({x:800,y:100,width:340,height:278},390,844,true);
    assert.ok(detail.scale>=0.85);
});
test('edges use actual box anchors in both directions and empty graph bounds stay finite',()=>{
    const a={x:0,y:0,width:280,height:118}, b={x:380,y:100,width:340,height:278};
    assert.match(m.architectureEdgePath(a,b),/^M280,59 /);
    assert.match(m.architectureEdgePath(b,a),/^M380,239 /);
    const empty=m.architectureLayout({items:[],path:[],edges:[]});
    assert.ok(empty.bounds.width>0&&empty.bounds.height>0);
});

test('append-only children avoid occupied slots without moving any existing card',()=>{
    const item=(id,column,parentId,kind='component')=>({id,column,parentId,kind});
    const roots=[item('client',0),item('memory',2),item('files',2),item('runtime',3)];
    const initial=m.architectureLayout({items:roots,path:[],edges:[]});
    const first=m.architectureLayout({items:[...roots,item('notes',3,'memory','group')],path:['memory'],edges:[],focusId:'notes'});
    const second=m.architectureLayout({items:[...roots,item('notes',3,'memory','group'),item('read',4,'notes','api'),item('file-child',3,'files','group')],path:['files'],edges:[]});
    for(const [id,box]of initial.positions)assert.deepEqual(JSON.parse(JSON.stringify(first.positions.get(id))),JSON.parse(JSON.stringify(box)));
    for(const [id,box]of first.positions)assert.deepEqual(JSON.parse(JSON.stringify(second.positions.get(id))),JSON.parse(JSON.stringify(box)));
    const boxes=[...second.positions.values()];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
    }
    assert.ok(first.positions.get('notes').x>first.positions.get('memory').x);
});

test('keyboard reveal only pans and leaves already visible nodes unchanged',()=>{
    const current={x:20,y:30,scale:0.7};
    assert.equal(m.revealViewport(current,{x:100,y:100,width:100,height:100},1200,900),current);
    const shifted=m.revealViewport(current,{x:2000,y:1800,width:280,height:118},1200,900);
    assert.equal(shifted.scale,current.scale);assert.notEqual(shifted.x,current.x);
});
