import React, { act } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { DesignProvider } from "../components/interface/design-provider.tsx";
import { ThinkingBlock } from "../components/thinking-block.tsx";
import { AbortTurnDialog } from "../components/abort-turn-dialog.tsx";
import { InteractionLayersProvider, useInteractionLayers, type InteractionLayersController } from "../components/interaction-layers.tsx";
import { quoteFilePath } from "../src/core/file-paths.ts";
import { installModalDom } from "./modal-dom.ts";

(globalThis as Record<string, unknown>).React = React;

test("canonical learner thinking preserves path references and submitted images", () => {
	const path = "C:/notes/proof.png";
	const text = `My reasoning uses ${quoteFilePath(path)}. <script>unsafe()</script>`;
	const html = renderToStaticMarkup(<DesignProvider><ThinkingBlock text={text}
		images={[{ type: "image", mimeType: "image/png", data: "aW1hZ2U=" }]} defaultOpen /></DesignProvider>);
	const doc = parseHTML(`<html><body>${html}</body></html>`).document;
	const label = doc.querySelector('[data-thinking-part="label"]')!;
	const body = doc.querySelector('[data-thinking-part="body"]')!;
	assert.equal(label.textContent, "Your thinking");
	assert.equal(label.getAttribute("aria-controls"), body.id);
	assert.equal(body.hasAttribute("hidden"), false);
	assert.equal(body.querySelector('[role="img"]')?.getAttribute("aria-label"), path);
	assert.equal(body.querySelector('[data-testid="submitted-images"] img')?.getAttribute("src"), "data:image/png;base64,aW1hZ2U=");
	assert.equal(body.querySelector("script"), null);
	assert.match(body.textContent!, /<script>unsafe\(\)<\/script>/);
});

test("canonical image-only thinking retains its expandable image content", () => {
	const html = renderToStaticMarkup(<DesignProvider><ThinkingBlock text=""
		images={[{ type: "image", mimeType: "image/png", data: "aW1hZ2U=" }]} defaultOpen /></DesignProvider>);
	const doc = parseHTML(`<html><body>${html}</body></html>`).document;
	assert.equal(doc.querySelector('[data-thinking-part="label"]')?.getAttribute("aria-expanded"), "true");
	assert.equal(doc.querySelectorAll('[data-testid="submitted-images"] img').length, 1);
});

test("canonical abort confirmation focuses Cancel and Escape closes only its own layer", async () => {
	const dom = parseHTML("<html><head></head><body><div id='root'></div></body></html>");
	const globals = { React, window: dom.window, document: dom.document, Element: dom.window.Element,
		HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
	const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	Object.assign(globalThis, globals);
	const restore = installModalDom(dom);
	const root = createRoot(dom.document.querySelector("#root")!);
	let controller!: InteractionLayersController;
	let cancelled = 0;
	function Harness() {
		controller = useInteractionLayers();
		const [open, setOpen] = React.useState(true);
		return <AbortTurnDialog mode={open ? "question" : null} busy
			onClose={() => { cancelled++; setOpen(false); }}
			onConfirm={() => assert.fail("Escape must never confirm dismissal")} />;
	}
	try {
		await act(async () => root.render(<InteractionLayersProvider><DesignProvider><Harness /></DesignProvider></InteractionLayersProvider>));
		assert.equal(dom.document.activeElement, dom.document.querySelector('[data-testid="abort-turn-cancel"]'));
		assert.equal(dom.document.querySelectorAll('[role="dialog"]').length, 1);
		assert.match(dom.document.querySelector('[data-testid="abort-turn-line"]')!.textContent!, /waits for your next message/);
		const event = Object.assign(new dom.window.Event("keydown", { bubbles: true, cancelable: true }), { key: "Escape" });
		await act(async () => { controller.captureKeyDown(event as unknown as KeyboardEvent); dom.document.dispatchEvent(event); });
		assert.equal(event.defaultPrevented, true);
		assert.equal(cancelled, 1);
		assert.equal(dom.document.querySelector('[role="dialog"]'), null);
	} finally {
		await act(async () => root.unmount());
		await new Promise(resolve => setTimeout(resolve, 5));
		restore();
		for (const [key, descriptor] of saved) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
