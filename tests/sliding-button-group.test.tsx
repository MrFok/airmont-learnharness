import React, { act } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { SlidingButtonGroup } from "../components/ui/sliding-button-group";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function environment() {
	const dom = parseHTML("<html><body><div id='root'></div></body></html>");
	dom.window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
	const frames = new Map<number, FrameRequestCallback>();
	let frame = 0;
	class Observer {
		observe() {}
		disconnect() {}
	}
	const previous = new Map<string, PropertyDescriptor | undefined>();
	for (const [key, value] of Object.entries({
		window: dom.window,
		document: dom.document,
		Element: dom.window.Element,
		HTMLElement: dom.window.HTMLElement,
		HTMLButtonElement: dom.window.HTMLButtonElement,
		ResizeObserver: Observer,
		MutationObserver: Observer,
		getComputedStyle: () => ({ direction: "ltr" }),
		requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frame, callback); return frame; },
		cancelAnimationFrame: (id: number) => frames.delete(id),
	})) {
		previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
	return {
		window: dom.window,
		host: dom.document.getElementById("root")!,
		frames,
		restore() {
			for (const [key, descriptor] of previous) {
				if (descriptor) Object.defineProperty(globalThis, key, descriptor);
				else Reflect.deleteProperty(globalThis, key);
			}
		},
	};
}

test("caller handlers run and can prevent group navigation without changing normal keyboard selection", async (context) => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	const diagnostics: unknown[][] = [];
	context.mock.method(console, "error", (...args: unknown[]) => diagnostics.push(args));
	context.mock.method(console, "warn", (...args: unknown[]) => diagnostics.push(args));
	const keys: string[] = [];
	const changes: string[] = [];
	let prevent = true;
	let leaves = 0;
	try {
		await act(async () => root.render(<SlidingButtonGroup value="first" label="Mode"
			options={[{ value: "first", label: "First" }, { value: "disabled", label: "Disabled", disabled: true }, { value: "last", label: "Last" }]}
			onValueChange={(value) => changes.push(value)}
			onKeyDown={(event) => { keys.push(event.key); if (prevent) event.preventDefault(); }}
			onPointerLeave={() => { leaves += 1; }} />));
		const group = env.host.querySelector<HTMLElement>('[role="radiogroup"]')!;
		const first = env.host.querySelector<HTMLButtonElement>('[data-value="first"]')!;
		const last = env.host.querySelector<HTMLButtonElement>('[data-value="last"]')!;
		let focused = false;
		last.focus = () => { focused = true; };
		const key = async () => act(async () => {
			const event = new env.window.Event("keydown", { bubbles: true, cancelable: true });
			Object.assign(event, { key: "ArrowRight" });
			first.dispatchEvent(event);
			assert.equal(event.defaultPrevented, true);
		});
		await key();
		assert.deepEqual(keys, ["ArrowRight"]);
		assert.deepEqual(changes, []);
		assert.equal(focused, false);
		prevent = false;
		await key();
		assert.deepEqual(keys, ["ArrowRight", "ArrowRight"]);
		assert.deepEqual(changes, ["last"]);
		assert.equal(focused, true);
		await act(async () => {
			group.dispatchEvent(new env.window.Event("pointerout", { bubbles: true }));
		});
		assert.equal(leaves, 1);
		assert.deepEqual(diagnostics, []);
	} finally {
		await act(async () => root.unmount());
		assert.equal(env.frames.size, 0);
		env.restore();
	}
});
