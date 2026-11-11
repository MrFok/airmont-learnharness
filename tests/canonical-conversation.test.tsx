import React, { act } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { Composer } from "../components/composer";
import { QuestionDock } from "../components/question-dock";
import { AnsweredCard } from "../components/answered-card";
import { ThinkingBlock } from "../components/thinking-block";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../components/ai-elements/reasoning";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const animations = { paused: true, LoadingIndicator: () => null, ThinkingText: ({ children }: { children: string }) => <span>{children}</span> };
const canonical = (children: React.ReactNode) => <InterfaceAnimationsContext value={animations}>{children}</InterfaceAnimationsContext>;
const quiz = {
	question: "What is a derivative?",
	options: [{ label: "A rate", value: "rate" }, { label: "An area", value: "area" }],
	correctAnswer: "rate", explanation: "It measures a local rate.",
};
const draft = { selection: { selected: new Set([0]), otherSelected: false, dontKnow: false }, thinking: "Preserved reasoning", other: "", text: "", confidenceIndex: 2 };

function environment() {
	const dom = parseHTML('<html data-design-system="canonical"><body><div id="root"></div><button id="outside">Transcript control</button></body></html>');
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
		host: dom.document.getElementById("root")!,
		document: dom.document,
		key(target: Element, key: string, overrides = {}) {
			const event = new dom.window.Event("keydown", { bubbles: true, cancelable: true });
			Object.assign(event, { key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false, ...overrides });
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

test("canonical composer retains steer, stop and next handlers and protects IME and dictation Escape", async () => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	const actions: string[] = [];
	const render = async (busy: boolean, canSend: boolean, nextProblem = false) => act(async () => root.render(canonical(
		<Composer busy={busy} canSend={canSend} nextProblem={nextProblem} value={canSend ? "Draft" : ""} onChange={() => {}}
			onSend={() => actions.push("send")} onStop={() => actions.push("stop")} onNext={() => actions.push("next")} onEscape={() => actions.push("dictation-cancel")} />,
	)));
	try {
		await render(true, true);
		assert.ok(env.host.querySelector(".proposed-conversation-composer .proposed-conversation-send .lucide-arrow-up"));
		await act(async () => { env.key(env.host.querySelector("textarea")!, "Enter"); });
		await render(true, false);
		assert.ok(env.host.querySelector('[aria-label="Stop"][data-stopping="true"] .lucide-square'));
		await act(async () => { env.key(env.host.querySelector("textarea")!, "Enter"); });
		await render(false, false, true);
		assert.ok(env.host.querySelector('[aria-label="Next problem"].proposed-conversation-next'));
		await act(async () => { env.key(env.host.querySelector("textarea")!, "Enter"); });
		await render(false, true);
		await act(async () => {
			assert.equal(env.key(env.host.querySelector("textarea")!, "Enter", { isComposing: true }).defaultPrevented, false);
			assert.equal(env.key(env.host.querySelector("textarea")!, "Enter", { shiftKey: true }).defaultPrevented, false);
			env.key(env.host.querySelector("textarea")!, "Escape");
		});
		assert.deepEqual(actions, ["send", "stop", "next", "dictation-cancel"]);
	} finally {
		await act(async () => root.unmount());
		env.restore();
	}
});

test("canonical question shortcuts remain global and submit exactly once after row navigation", async () => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	let submissions = 0;
	try {
		await act(async () => root.render(canonical(<QuestionDock toolName="quiz" toolCallId="live-canonical" input={quiz} expanded
			onExpand={() => {}} onSubmit={() => { submissions += 1; }} dictationClaim={false} initialDraft={draft} />)));
		const outside = env.document.getElementById("outside")!;
		outside.focus();
		await act(async () => { env.key(outside, "Enter"); });
		assert.equal(submissions, 1);
		await act(async () => { env.key(outside, "Tab"); });
		assert.equal(env.document.activeElement, env.host.querySelector("[data-kbdrow]"));
		await act(async () => { env.key(outside, "Enter"); });
		assert.equal(submissions, 2);
		const slider = env.host.querySelector<HTMLInputElement>('input[type="range"]')!;
		const previous = slider.value;
		await act(async () => { env.key(outside, "ArrowRight"); });
		assert.notEqual(slider.value, previous);
		assert.ok(env.host.querySelector('[data-interface-learning-dock="true"] .proposed-choice-marker'));
	} finally {
		await act(async () => root.unmount());
		env.restore();
	}
});

test("global provider selects flat thinking, trailing answer status and accessible reasoning panels", () => {
	const html = renderToStaticMarkup(canonical(<>
		<ThinkingBlock text="Preserved thought" defaultOpen />
		<AnsweredCard answer={{ kind: "quiz", questionText: "A rate?", dontKnow: false, answers: [{ index: 1, label: "Yes", value: "yes" }], correct: true, answeredAt: "2026-10-27T00:00:00Z" }} />
		<Reasoning><ReasoningTrigger /><ReasoningContent>Recorded reasoning</ReasoningContent></Reasoning>
	</>));
	const document = parseHTML(`<html><body>${html}</body></html>`).document;
	assert.ok(document.querySelector('[data-thinking-part="body"]'));
	assert.doesNotMatch(document.querySelector('[data-appearance="proposed"]')!.outerHTML, /border-l-|italic/);
	assert.match(document.querySelector('[data-answer-part="header"]')!.textContent ?? "", /correct/);
	assert.ok(document.querySelector("[data-proposed-answer]"));
	assert.ok(document.querySelector('[data-reasoning-panel][inert][aria-hidden="true"][data-motion="instant"]'));
});
