import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { DEMO_BRIDGE_SCRIPT } from "../components/artifacts/demo-card";

test("a late parent can request the current demo height, while other message senders are ignored", () => {
	const listeners = new Map<string, (event: unknown) => void>();
	const received: unknown[] = [];
	let listening = false;
	const parent = {
		postMessage: (message: unknown) => {
			if (listening) received.push(message);
		},
	};
	const body = { scrollHeight: 560, getBoundingClientRect: () => ({ height: 560 }) };
	const window = {
		addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
	};
	class ResizeObserver {
		constructor(private callback: () => void) {}
		observe() {
			this.callback();
		}
	}
	runInNewContext(DEMO_BRIDGE_SCRIPT.replace(/^<script>|<\/script>$/g, ""), {
		window,
		parent,
		ResizeObserver,
		document: { body, documentElement: { scrollHeight: 560 } },
		getComputedStyle: () => ({ marginTop: "0", marginBottom: "0" }),
		setTimeout: (callback: () => void) => callback(),
	});
	assert.deepEqual(received, []);
	listening = true;
	listeners.get("message")!({ source: {}, data: { type: "demo-measure" } });
	listeners.get("message")!({ source: parent, data: { type: "unrelated" } });
	assert.deepEqual(received, []);
	listeners.get("message")!({ source: parent, data: { type: "demo-measure" } });
	assert.equal(received.length, 1);
	assert.equal(JSON.stringify(received[0]), JSON.stringify({ type: "demo-resize", height: 560 }));
});
