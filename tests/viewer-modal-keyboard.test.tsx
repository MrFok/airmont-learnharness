import React, { act } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { useViewerModal } from "../components/interface/use-viewer-modal";

test("an inert viewer leaves keyboard ownership to the foreground modal", async () => {
	const dom = parseHTML('<html><body><button id="outside">Outside</button><div id="host"></div></body></html>');
	const previous = new Map<string, PropertyDescriptor | undefined>();
	for (const key of ["React", "window", "document", "HTMLElement", "Element", "IS_REACT_ACT_ENVIRONMENT"]) previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
	Object.assign(globalThis, { React, window: dom.window, document: dom.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true });
	let closed = 0;
	function Viewer() {
		const ref = useViewerModal(() => closed++);
		return <div ref={ref} id="viewer" role="dialog" tabIndex={-1}><button>Close viewer</button></div>;
	}
	const root = createRoot(dom.document.getElementById("host")!);
	try {
		await act(async () => root.render(<Viewer />));
		const viewer = dom.document.getElementById("viewer")!;
		viewer.setAttribute("inert", "");
		const escape = () => {
			const event = new dom.window.Event("keydown", { cancelable: true });
			Object.defineProperty(event, "key", { value: "Escape" });
			dom.window.dispatchEvent(event);
			return event;
		};
		assert.equal(escape().defaultPrevented, false);
		assert.equal(closed, 0);
		viewer.removeAttribute("inert");
		assert.equal(escape().defaultPrevented, true);
		assert.equal(closed, 1);
	} finally {
		await act(async () => root.unmount());
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
