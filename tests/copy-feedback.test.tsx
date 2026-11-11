import React, { act } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { useCopyFeedback, writeClipboardText } from "../lib/use-copy-feedback";
import { CopyFeedback } from "../components/ui/copy-feedback";
import { CopyCorner } from "../components/md-blocks";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

function environment(writeText: (text: string) => Promise<void>) {
	const dom = parseHTML("<html><body><button id='before'>Before</button><div id='root'></div></body></html>");
	Object.assign(dom.window, { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
	const previous = new Map<string, PropertyDescriptor | undefined>();
	for (const [key, value] of Object.entries({ window: dom.window, document: dom.document, navigator: { clipboard: { writeText } } })) {
		previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
	let restored = 0;
	const before = dom.document.querySelector<HTMLButtonElement>("#before")!;
	before.focus = () => { restored += 1; };
	Object.defineProperty(dom.document, "activeElement", { configurable: true, value: before });
	Object.assign(dom.window.HTMLTextAreaElement.prototype, { select() {} });
	return {
		document: dom.document,
		host: dom.document.querySelector<HTMLDivElement>("#root")!,
		restored: () => restored,
		restore() {
			for (const [key, descriptor] of previous) {
				if (descriptor) Object.defineProperty(globalThis, key, descriptor);
				else Reflect.deleteProperty(globalThis, key);
			}
		},
	};
}

const animations = { paused: true, LoadingIndicator: () => null, ThinkingText: () => null };

test("clipboard API success skips fallback and fallback accurately reports failures with cleanup and focus restoration", async () => {
	const env = environment(async (text) => { assert.equal(text, "source"); });
	try {
		Object.assign(env.document, { execCommand: () => { throw new Error("must not use fallback"); } });
		assert.equal(await writeClipboardText("source"), true);
		assert.equal(env.restored(), 0);
		Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => { throw new Error("denied"); } } } });
		for (const result of [true, false, "throws"] as const) {
			Object.assign(env.document, { execCommand: (command: string) => {
				assert.equal(command, "copy");
				assert.equal(env.document.querySelector("textarea")?.value, "source");
				if (result === "throws") throw new Error("unsupported");
				return result;
			} });
			assert.equal(await writeClipboardText("source"), result === true);
			assert.equal(env.document.querySelector("textarea"), null);
		}
		assert.equal(env.restored(), 3);
	} finally { env.restore(); }
});

test("icon-only feedback announces failure, retries successfully, calls onCopied only on success and resets at 1500ms", async (context) => {
	let fail = true;
	let copied = 0;
	let throwSource = false;
	const env = environment(async () => { if (fail) throw new Error("denied"); });
	Object.assign(env.document, { execCommand: () => false });
	const root = createRoot(env.host);
	context.mock.timers.enable({ apis: ["setTimeout"] });
	try {
		await act(async () => root.render(
			<InterfaceAnimationsContext value={animations}>
				<CopyFeedback label="Copy code" getText={() => { if (throwSource) throw new Error("no source"); return "source"; }} onCopied={() => { copied += 1; }} />
			</InterfaceAnimationsContext>,
		));
		const button = env.host.querySelector("button")!;
		const click = async () => act(async () => { button.click(); });
		assert.equal(button.textContent, "");
		assert.equal(button.getAttribute("data-testid"), "md-copy");
		assert.equal(button.getAttribute("data-copy-motion"), "instant");
		assert.equal(button.querySelector("svg")?.getAttribute("width"), "16");
		await click();
		assert.equal(button.getAttribute("data-copy-state"), "error");
		assert.equal(env.host.querySelector('[role="status"]')?.textContent, "Copy code: Could not copy");
		assert.equal(copied, 0);
		fail = false;
		await click();
		assert.equal(button.getAttribute("data-copy-state"), "copied");
		assert.equal(env.host.querySelector('[role="status"]')?.textContent, "Copy code: Copied");
		assert.equal(copied, 1);
		assert.equal(button.textContent, "");
		await act(async () => context.mock.timers.tick(1499));
		assert.equal(button.getAttribute("data-copy-state"), "copied");
		await act(async () => context.mock.timers.tick(1));
		assert.equal(button.getAttribute("data-copy-state"), "idle");
		assert.equal(env.host.querySelector('[role="status"]')?.textContent, "");
		throwSource = true;
		await click();
		assert.equal(button.getAttribute("data-copy-state"), "error");
		assert.equal(copied, 1);
	} finally {
		await act(async () => root.unmount());
		context.mock.timers.reset();
		env.restore();
	}
});

test("only the latest clipboard request updates feedback and unmounted requests cannot report success", async () => {
	const pending: Array<() => void> = [];
	const env = environment(() => new Promise<void>((resolve) => pending.push(resolve)));
	const root = createRoot(env.host);
	let feedback!: ReturnType<typeof useCopyFeedback>;
	function Probe() {
		feedback = useCopyFeedback();
		return <output>{feedback.state}</output>;
	}
	let unmounted = false;
	try {
		await act(async () => root.render(<Probe />));
		let first!: Promise<boolean>;
		let second!: Promise<boolean>;
		await act(async () => { first = feedback.copy("first"); second = feedback.copy("second"); });
		await act(async () => pending[1]!());
		assert.equal(await second, true);
		assert.equal(env.host.textContent, "copied");
		await act(async () => pending[0]!());
		assert.equal(await first, false);
		assert.equal(env.host.textContent, "copied");
		let late!: Promise<boolean>;
		await act(async () => { late = feedback.copy("late"); });
		await act(async () => root.unmount());
		unmounted = true;
		pending[2]!();
		assert.equal(await late, false);
	} finally {
		if (!unmounted) await act(async () => root.unmount());
		env.restore();
	}
});

test("CopyCorner keeps Current markup and selects the new icon-only feedback only in Proposed", () => {
	const current = renderToStaticMarkup(<CopyCorner label="Copy code" getText={() => "source"} />);
	assert.match(current, /group-hover\/md:opacity-100/);
	assert.doesNotMatch(current, /proposed-copy|role="status"/);
	const proposed = renderToStaticMarkup(
		<InterfaceAnimationsContext value={animations}><CopyCorner label="Copy code" getText={() => "source"} /></InterfaceAnimationsContext>,
	);
	assert.match(proposed, /proposed-copy-button/);
	assert.match(proposed, /role="status" aria-live="polite"/);
	assert.doesNotMatch(proposed, />Copy(?: code)?<|>Copied<|>Failed</);
});
