import React, { act, useRef } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { useViewerFocus } from "../components/interface/use-viewer-modal";
import { InteractionLayersProvider, useInteractionLayer } from "../components/interaction-layers";
import { HostDialog } from "../components/host-dialog";
import { installModalDom } from "./modal-dom";

test("a session viewer leaves sidebar access and Escape ownership to the foreground modal", async () => {
	const dom = parseHTML('<html><body><button id="outside">Outside</button><div id="host"></div></body></html>');
	const globals = { React, window: dom.window, document: dom.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true };
	const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	Object.assign(globalThis, globals);
	const restore = installModalDom(dom);
	let viewerClosed = 0, modalClosed = 0;
	function Viewer() {
		const ref = useRef<HTMLDivElement>(null);
		useViewerFocus(ref);
		useInteractionLayer({ kind: "view", rootRef: ref, enabled: true, onClose: () => { viewerClosed++; return "closed"; } });
		return <div ref={ref} id="viewer" role="region"><button aria-label="Close">Close viewer</button></div>;
	}
	function Scene({ modal }: { modal: boolean }) {
		return <><Viewer /><HostDialog open={modal} aria-label="Foreground" onClose={() => { modalClosed++; return "closed"; }}><h2>Foreground modal</h2></HostDialog></>;
	}
	const root = createRoot(dom.document.getElementById("host")!);
	const render = async (modal: boolean) => act(async () => root.render(<InteractionLayersProvider><Scene modal={modal} /></InteractionLayersProvider>));
	const escape = async () => act(async () => {
		const event = new dom.window.Event("keydown", { cancelable: true, bubbles: true });
		Object.defineProperty(event, "key", { value: "Escape" });
		dom.document.dispatchEvent(event);
		assert.equal(event.defaultPrevented, true);
	});
	try {
		await render(false);
		assert.equal(document.getElementById("outside")!.getAttribute("aria-hidden"), null);
		assert.equal(document.getElementById("outside")!.hasAttribute("inert"), false);
		assert.equal(document.activeElement?.getAttribute("aria-label"), "Close");
		await render(true);
		await escape();
		assert.equal(modalClosed, 1);
		assert.equal(viewerClosed, 0);
		await render(false);
		await act(async () => new Promise(resolve => setTimeout(resolve, 5)));
		await escape();
		assert.equal(viewerClosed, 1);
		assert.equal(modalClosed, 1);
	} finally {
		await act(async () => root.unmount());
		await new Promise(resolve => setTimeout(resolve, 5));
		restore();
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
		}
	}
});
