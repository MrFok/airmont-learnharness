import React, { act } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { QuestionDock } from "../components/question-dock";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const animations = { paused: true, LoadingIndicator: () => null, ThinkingText: () => null };
const question = {
	question: "What is a derivative?",
	options: [{ label: "A local rate", value: "rate" }, { label: "An area", value: "area" }],
	correctAnswer: "rate", explanation: "It measures a local rate.",
};

function environment() {
	const dom = parseHTML("<html><body><div id='root'></div><button id='outside'>Outside control</button><div id='portals'></div></body></html>");
	Object.assign(dom.document, { oninput: null });
	let focused: Element | null = null;
	Object.defineProperty(dom.document, "activeElement", { get: () => focused, configurable: true });
	dom.window.HTMLElement.prototype.focus = function () { focused = this; };
	dom.window.HTMLElement.prototype.scrollIntoView = () => {};
	const previous = new Map<string, PropertyDescriptor | undefined>();
	for (const [key, value] of Object.entries({ window: dom.window, document: dom.document, HTMLElement: dom.window.HTMLElement })) {
		previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
	return {
		window: dom.window,
		document: dom.document,
		host: dom.document.getElementById("root")!,
		key(target: Element, key: string) {
			const event = new dom.window.Event("keydown", { bubbles: true, cancelable: true });
			Object.assign(event, { key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false });
			target.dispatchEvent(event);
			return event;
		},
		restore() {
			for (const [key, descriptor] of previous) {
				if (descriptor) Object.defineProperty(globalThis, key, descriptor);
				else Reflect.deleteProperty(globalThis, key);
			}
		},
	};
}

test("Proposed questions do not claim keys from a dialog nested within their root or an inert specimen", async () => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	try {
		await act(async () => root.render(<InterfaceAnimationsContext value={animations}>
			<QuestionDock toolName="quiz" toolCallId="nested" input={question} expanded onExpand={() => {}} onSubmit={() => {}} dictationClaim={false} />
		</InterfaceAnimationsContext>));
		const dock = env.host.querySelector<HTMLElement>('[data-testid="question-dock"]')!;
		const nested = env.document.createElement("div");
		nested.setAttribute("role", "dialog");
		nested.innerHTML = "<button>Nested overlay control</button>";
		dock.appendChild(nested);
		const target = nested.querySelector("button")!;
		target.focus();
		assert.equal(env.key(target, "Tab").defaultPrevented, false);
		assert.equal(env.document.activeElement, target);
		dock.setAttribute("inert", "");
		const row = dock.querySelector<HTMLElement>("[data-kbdrow]")!;
		assert.equal(env.key(row, "Tab").defaultPrevented, false);
	} finally {
		await act(async () => root.unmount());
		env.restore();
	}
});

test("Current question document and window shortcuts still operate outside their root", async () => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	let submissions = 0;
	try {
		await act(async () => root.render(<QuestionDock toolName="quiz" toolCallId="current" input={question} expanded
			onExpand={() => {}} onSubmit={() => { submissions += 1; }} dictationClaim={false}
			initialDraft={{ selection: { selected: new Set([0]), otherSelected: false, dontKnow: false }, thinking: "", other: "", text: "", confidenceIndex: 2 }} />));
		const outside = env.document.getElementById("outside")!;
		outside.focus();
		await act(async () => { env.key(outside, "Enter"); });
		assert.equal(submissions, 1);
		await act(async () => { assert.equal(env.key(outside, "Tab").defaultPrevented, true); });
		assert.equal(env.document.activeElement, env.host.querySelector("[data-kbdrow]"));
		await act(async () => { env.key(outside, "Enter"); });
		assert.ok(submissions > 1);
	} finally {
		await act(async () => root.unmount());
		env.restore();
	}
});
