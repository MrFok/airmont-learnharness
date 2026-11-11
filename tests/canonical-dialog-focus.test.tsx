import React, { act } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { DeleteSessionBody } from "../components/delete-session-dialog";
import { DeleteNodeBody } from "../components/delete-node-dialog";
import { AbortTurnBody } from "../components/abort-turn-dialog";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";

Object.assign(globalThis, { React });
const animations = { paused: true, LoadingIndicator: () => null, ThinkingText: () => null };
const props = { busy: false, failure: null, onClose() {}, onRun() {} };

test("canonical context promotes all real confirmation bodies without an explicit preview variant", () => {
 for (const body of [
  <DeleteSessionBody {...props} chat={{id:"sample",title:"Sample"}} traces={false} onTraces={()=>{}} />,
  <DeleteNodeBody {...props} nodes={[{id:"rate",name:"Rate"}]} />,
  <AbortTurnBody mode="question" onClose={()=>{}} onConfirm={()=>{}} />,
 ]) {
  const html=renderToStaticMarkup(<InterfaceAnimationsContext value={animations}>{body}</InterfaceAnimationsContext>);
  assert.match(html,/data-proposed-confirmation=""/);
  assert.match(html,/aria-labelledby=/);
  assert.match(html,/aria-describedby=/);
 }
});

test("real confirmation focuses Cancel, contains Tab, restores focus and ignores inert inventory bodies", async () => {
 const dom=parseHTML('<html><body><button id="trigger">Delete</button><div id="root"></div></body></html>');
 const saved=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.document,Element:dom.window.Element,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})) {
  saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 }
 let focused:HTMLElement|null=null;
 const focusTarget=():HTMLElement|null=>focused;
 dom.window.HTMLElement.prototype.focus=function(){focused=this;};
 Object.defineProperty(dom.document,'activeElement',{configurable:true,get:()=>focused});
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(dom.document.getElementById('root')!);
 const body=<DeleteNodeBody {...props} nodes={[{id:'rate',name:'Rate'}]} />;
 try {
  dom.document.getElementById('trigger')!.focus();
  await act(async()=>root.render(<div inert>{body}</div>));
  assert.equal(focusTarget()?.id,'trigger');
  assert.equal(dom.document.getElementById('trigger')!.inert,undefined);
  await act(async()=>root.render(body));
  assert.equal(focusTarget()?.getAttribute('data-testid'),'node-delete-cancel');
  assert.equal(dom.document.getElementById('trigger')!.inert,true);
  dom.document.querySelector<HTMLElement>('[data-testid="node-delete-confirm"]')!.focus();
  const event=new dom.window.Event('keydown',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'key',{value:'Tab'});
  dom.document.dispatchEvent(event);
  assert.equal(focusTarget()?.getAttribute('data-testid'),'node-delete-cancel');
  await act(async()=>root.unmount());
  assert.equal(focusTarget()?.id,'trigger');
  assert.equal(dom.document.getElementById('trigger')!.inert,false);
 } finally {
  await act(async()=>root.unmount());
  for(const [key,descriptor] of saved) {
   if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);
  }
 }
});
