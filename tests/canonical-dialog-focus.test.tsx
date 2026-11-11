import React, { act, useState } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { DeleteSessionBody, DeleteSessionDialog } from "../components/delete-session-dialog";
import { DeleteNodeBody, DeleteNodeDialog } from "../components/delete-node-dialog";
import { DeleteSourceBody, DeleteSourceDialog } from "../components/delete-source-dialog";
import { AbortTurnBody } from "../components/abort-turn-dialog";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";
import { InteractionLayersProvider } from "../components/interaction-layers";
import { installModalDom } from "./modal-dom";

Object.assign(globalThis, { React });
const animations = { paused: true, LoadingIndicator: () => null, ThinkingText: () => null };
const props = { busy: false, failure: null, onClose() {}, onRun() {} };

test("canonical context promotes all confirmation bodies without a preview variant", () => {
	for (const body of [
		<DeleteSessionBody {...props} chat={{ id: "sample", title: "Sample" }} traces={false} onTraces={() => {}} />,
		<DeleteNodeBody {...props} nodes={[{ id: "rate", name: "Rate" }]} />,
		<DeleteSourceBody {...props} sources={[]} folders={[]} deleteSessions={false} onDeleteSessions={() => {}} failure="" />,
		<AbortTurnBody mode="question" onClose={() => {}} onConfirm={() => {}} />,
	]) {
		const html = renderToStaticMarkup(<InterfaceAnimationsContext value={animations}>{body}</InterfaceAnimationsContext>);
		assert.match(html, /data-proposed-confirmation=""/);
		assert.match(html, /aria-labelledby=/);
		assert.match(html, /aria-describedby=/);
	}
});

test("real deletion dialogs focus Cancel, isolate through HostDialog, suppress native Tab, and restore focus", async () => {
	const dom = parseHTML('<html><body><button id="trigger">Delete</button><div id="root"></div></body></html>');
	const globals = { window: dom.window, document: dom.document, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
	const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	Object.assign(globalThis, globals);
	const restore = installModalDom(dom);
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(document.getElementById("root")!);
	function Confirmation({ family }: { family: "node" | "session" | "source" }) {
		const [open, setOpen] = useState(true);
		const onClose = () => setOpen(false);
		return <InteractionLayersProvider><InterfaceAnimationsContext value={animations}>
			{family === "node" ? <DeleteNodeDialog nodes={open ? [{ id: "rate", name: "Rate" }] : null} onClose={onClose} onDeleted={() => {}} />
				: family === "session" ? <DeleteSessionDialog chat={open ? { id: "sample", title: "Sample" } : null} onClose={onClose} onDeleted={() => {}} />
					: <DeleteSourceDialog open={open} sources={[]} folders={[]} onClose={onClose} onDelete={async () => {}} />}
		</InterfaceAnimationsContext></InteractionLayersProvider>;
	}
	try {
		for (const family of ["node", "session", "source"] as const) {
			const prefix = family === "session" ? "delete" : `${family}-delete`;
			document.getElementById("trigger")!.focus();
			await act(async () => root.render(<Confirmation key={family} family={family} />));
			assert.equal(document.activeElement?.getAttribute("data-testid"), `${prefix}-cancel`);
			assert.equal(document.getElementById("trigger")!.getAttribute("aria-hidden"), "true");
			const confirm = document.querySelector<HTMLElement>(`[data-testid="${prefix}-confirm"]`)!;
			confirm.focus();
			const tab = new dom.window.Event("keydown", { bubbles: true, cancelable: true });
			Object.defineProperty(tab, "key", { value: "Tab" });
			dom.window.dispatchEvent(tab);
			assert.equal(tab.defaultPrevented, true);
			assert.equal(document.activeElement, confirm);
			const escape = new dom.window.Event("keydown", { bubbles: true, cancelable: true });
			Object.defineProperty(escape, "key", { value: "Escape" });
			await act(async () => document.dispatchEvent(escape));
			await act(async () => new Promise(resolve => setTimeout(resolve, 5)));
			assert.equal(document.querySelector('[role="dialog"]'), null);
			assert.equal(document.activeElement?.id, "trigger");
			assert.notEqual(document.getElementById("trigger")!.getAttribute("aria-hidden"), "true");
		}
	} finally {
		await act(async () => root.unmount());
		await new Promise(resolve => setTimeout(resolve, 5));
		restore();
		for (const [key, descriptor] of saved) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
		}
	}
});
