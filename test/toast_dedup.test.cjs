const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./cepHarness.cjs');

const {useToastStore}=load('src/components/ui/toast/useToastStore.ts',{zustand:require('zustand'),'./toastTypes':{}});
const messages=()=>useToastStore.getState().toasts.map(t=>`${t.type}:${t.message}`);

test('the same message twice shows once, as the newer toast',()=>{
    const store=useToastStore.getState();store.clearToasts();
    const first=store.addToast({type:'error',message:'Engine offline'});
    store.addToast({type:'info',message:'Saved'});
    const second=store.addToast({type:'error',message:'Engine offline'});
    assert.equal(messages().join('|'),'info:Saved|error:Engine offline');
    assert.notEqual(first,second);
    assert.equal(useToastStore.getState().toasts[1].id,second);
});

test('a loading toast that ends as an error already shown replaces the older one',()=>{
    const store=useToastStore.getState();store.clearToasts();
    store.addToast({type:'error',message:'Failed to update mode'});
    const id=store.addToast({type:'loading',message:'Updating mode...'});
    assert.equal(useToastStore.getState().toasts.length,2,'loading toasts are never merged');
    store.updateToast(id,{type:'error',message:'Failed to update mode'});
    assert.equal(JSON.stringify(useToastStore.getState().toasts.map(t=>t.id)),JSON.stringify([id]));
    store.addToast({type:'success',message:'Failed to update mode'});
    assert.equal(useToastStore.getState().toasts.length,2,'a different type is a different toast');
});
