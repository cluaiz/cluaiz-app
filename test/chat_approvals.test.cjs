const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./cepHarness.cjs');

function setup({hidden=false,focused=true,push=true,permission='granted',worker=true}={}){
    const calls=[],shown=[],closed=[];
    const chat={resolvePermissionRequest:(...args)=>calls.push(['resolve',...args])};
    const perms={approvePermission:async id=>calls.push(['approve',id]),rejectPermission:async(id,f)=>calls.push(['reject',id,f])};
    let onMessage=null;
    const registration={showNotification:async(title,options)=>shown.push({title,options}),
        getNotifications:async({tag})=>[{close:()=>closed.push(tag)}]};
    class Notification{constructor(title,options){shown.push({title,options,plain:true});}}
    Notification.permission=permission;
    const navigator=worker?{serviceWorker:{register:async()=>registration,ready:Promise.resolve(registration),
        getRegistration:async()=>registration,addEventListener:(name,fn)=>{if(name==='message')onMessage=fn;}}}:{};
    const window={isSecureContext:true,Notification,focus:()=>calls.push(['focus'])};
    const document={hidden,hasFocus:()=>focused};
    const m=load('src/features/chat/approvals.ts',{
        '../../store/chat/useChatStore':{useChatStore:{getState:()=>chat}},
        '../../api/engine/permission/permission.store':{usePermissionStore:{getState:()=>perms}},
        '../../store/ui/useNotificationStore':{useNotificationStore:{getState:()=>({desktopPush:push})}},
    },{window,document,navigator,Notification});
    return {m,calls,shown,closed,message:data=>onMessage({data})};
}
const approval={sessionId:'s1',requestId:'ap_1',toolName:'web-search',parameters:{query:'x'}};
const tick=()=>new Promise(r=>setTimeout(r,0));

test('the Engine is answered first, then the chat shows the decision and the notification closes',async()=>{
    const s=setup();
    await s.m.decideChatApproval(approval,false,'not now');
    assert.deepEqual(s.calls.slice(0,2),[['reject','ap_1','not now'],['resolve','s1','ap_1','rejected','not now']]);
    await tick();assert.deepEqual(s.closed,['ap_1']);
});

test('a notification with Approve and Reject only when the App is out of sight',async()=>{
    const inFront=setup();await inFront.m.notifyApproval(approval);assert.equal(inFront.shown.length,0);
    const covered=setup({focused:false});await covered.m.notifyApproval(approval);
    assert.equal(covered.shown.length,1);
    assert.deepEqual(JSON.parse(JSON.stringify(covered.shown[0].options.actions.map(a=>a.action))),['approve','reject']);
    assert.equal(covered.shown[0].options.tag,'ap_1');
    covered.message({type:'cluaiz-approval',action:'approve',requestId:'ap_1',sessionId:'s1'});await tick();
    assert.deepEqual(covered.calls.slice(0,2),[['approve','ap_1'],['resolve','s1','ap_1','approved',undefined]]);
    const off=setup({hidden:true,push:false});await off.m.notifyApproval(approval);assert.equal(off.shown.length,0);
    const plain=setup({hidden:true,worker:false});await plain.m.notifyApproval(approval);
    assert.equal(plain.shown[0].plain,true);
});
