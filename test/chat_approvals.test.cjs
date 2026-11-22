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

function chatStore(){
    const {useChatStore}=load('src/store/chat/useChatStore.ts',{
        zustand:require('zustand'),'./useChatPrefsStore':{currentChatPrefs:()=>({})},
        '../../services/storage/ChatStorageManager':{chatStorageManager:{saveSessionMetadata:()=>{},saveMessages:()=>{},saveIndex:()=>{}}},
        '../../utils/topicProber':{inferChatTopicAndEmoji:()=>({})},'../../core/router':{pushChatRoute:()=>{}},
        './deletion':{createSessionDeleter:()=>async()=>true},'../../components/ui/toast':{toast:{error:()=>{}}},'../../api/client/errors':{errorMessage:e=>e.message},
    });
    useChatStore.setState({sessions:{s1:{id:'s1',title:'t',tags:[],unread:0,messages:[{sender:'assistant',text:'',time:'',date:0}]}},activeSessionId:'s1'});
    return useChatStore;
}
// Arrays made inside the loaded module come from another realm
const plain=v=>JSON.parse(JSON.stringify(v));
const ask=(requestId,toolName)=>({requestId,toolName,status:'pending'});

test('a second call in one answer keeps the first call and its outcome',()=>{
    const store=chatStore(),chat=()=>store.getState().sessions.s1.messages[0];
    store.getState().setPermissionRequestOnLastMessage('s1',ask('ap_1','web-search'));
    store.getState().resolvePermissionRequest('s1','ap_1','approved');
    store.getState().setPermissionRequestOnLastMessage('s1',ask('ap_2','web-fetch'));
    assert.deepEqual(plain(chat().earlierPermissionRequests.map(r=>[r.requestId,r.status])),[['ap_1','approved']]);
    assert.equal(chat().permissionRequest.requestId,'ap_2');
    store.getState().resolvePermissionRequest('s1','ap_2','timeout');
    const {messageApprovals}=setup().m;
    assert.deepEqual(plain(messageApprovals(chat()).map(r=>[r.toolName,r.status])),[['web-search','approved'],['web-fetch','timeout']]);
    // The same call sent again is not listed twice
    store.getState().setPermissionRequestOnLastMessage('s1',ask('ap_2','web-fetch'));
    assert.equal(chat().earlierPermissionRequests.length,1);
});
