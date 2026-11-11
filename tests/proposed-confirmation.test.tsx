import React, { act } from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { DeleteSessionBody, TRACES_COPY } from "../components/delete-session-dialog";
import { DeleteNodeBody } from "../components/delete-node-dialog";
import { AbortTurnBody } from "../components/abort-turn-dialog";

(globalThis as Record<string, unknown>).React = React;

const session = {
	chat: { id: "sample", title: "Rates of change" },
	traces: false,
	busy: false,
	failure: null,
	onTraces: () => {},
	onClose: () => {},
	onRun: () => {},
};

it("keeps the production graph-traces explanation visible and does not add the preview disclosure", () => {
	const html = renderToStaticMarkup(<DeleteSessionBody {...session} />);
	assert.ok(html.includes(TRACES_COPY.body));
	assert.doesNotMatch(html, /About removing graph traces|data-proposed-confirmation|hidden=/);
});

it("opts each confirmation body into the same Proposed hierarchy without changing its consequence", () => {
	for (const body of [
		<DeleteSessionBody key="session" {...session} variant="proposed" />,
		<DeleteNodeBody
			key="node"
			nodes={[{ id: "rate", name: "Rate" }]}
			busy={false}
			failure={null}
			onClose={() => {}}
			onRun={() => {}}
			variant="proposed"
		/>,
		<AbortTurnBody key="abort" mode="turn" onClose={() => {}} onConfirm={() => {}} variant="proposed" />,
	]) {
		const html = renderToStaticMarkup(body);
		assert.match(html, /data-proposed-confirmation=""/);
		for (const part of ["title", "description", "actions"])
			assert.ok(html.includes(`data-confirmation-part="${part}"`));
	}
});

it("discloses the graph consequence independently of the destructive option and preserves busy state", async () => {
	const dom = parseHTML("<html><body><div id='root'></div></body></html>");
	const previous = new Map<string, PropertyDescriptor | undefined>();
	for (const [key, value] of Object.entries({
		window: dom.window,
		document: dom.document,
		HTMLElement: dom.window.HTMLElement,
		IS_REACT_ACT_ENVIRONMENT: true,
	})) {
		previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
	const { createRoot } = await import("react-dom/client");
	const host = dom.document.getElementById("root")!;
	const root = createRoot(host);
	let changes = 0;
	try {
		await act(async () =>
			root.render(
				<DeleteSessionBody
					{...session}
					busy
					variant="proposed"
					onTraces={() => {
						changes += 1;
					}}
				/>,
			),
		);
		const info = host.querySelector<HTMLButtonElement>("button[aria-controls]")!;
		const details = dom.document.getElementById(info.getAttribute("aria-controls")!)!;
		assert.equal(info.getAttribute("aria-expanded"), "false");
		assert.ok(details.hasAttribute("hidden"));
		assert.equal(details.textContent, TRACES_COPY.body);
		assert.equal(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled, true);
		await act(async () => info.click());
		assert.equal(info.getAttribute("aria-expanded"), "true");
		assert.equal(details.hasAttribute("hidden"), false);
		assert.equal(changes, 0);
		await act(async () => info.click());
		assert.equal(info.getAttribute("aria-expanded"), "false");
		assert.ok(details.hasAttribute("hidden"));
	} finally {
		await act(async () => root.unmount());
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
