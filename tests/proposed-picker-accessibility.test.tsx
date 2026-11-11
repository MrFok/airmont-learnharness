import React, { act, useState } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";
import { ModelMenuList, ProviderMenuList, FontMenuList, ThinkingMenuList, fontMenuResults, customFamilyFor } from "../components/settings/model-menu";
import type { ModelCatalogEntry } from "../src/core";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const animations = { paused: true, LoadingIndicator: () => null, ThinkingText: () => null };
const model: ModelCatalogEntry = {
	id: "sample", name: "Sample model", provider: "openai", reasoning: false, input: ["text"], supportedLevels: [],
	cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 8192,
};
const providers = [
	{ id: "openai", label: "OpenAI", envVar: "OPENAI_API_KEY" },
	{ id: "anthropic", label: "Anthropic", envVar: "ANTHROPIC_API_KEY" },
];

function environment() {
	const dom = parseHTML("<html><body><div id='root'></div></body></html>");
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
			Object.assign(event, { key });
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

test("standalone pickers retain native controls and the production provider asset path", () => {
	const fixtures = [
		[<ModelMenuList key="model" models={[model]} effectiveId="sample" onPick={() => {}} />, ["Sample Model", "openai"]],
		[<ProviderMenuList key="provider" providers={[providers[0]!]} onPick={() => {}} />, ["OpenAI", "OPENAI_API_KEY"]],
		[<FontMenuList key="font" families={["Georgia", "Segoe UI"]} effectiveFamily={null} onPick={() => {}} />, ["Georgia", "Segoe UI"]],
		[<ThinkingMenuList key="thinking" levels={["low", "medium", "high"]} effectiveLevel="medium" onPick={() => {}} />, ["low", "medium", "high"]],
	] as const;
	for (const [fixture, labels] of fixtures) {
		const {document} = parseHTML(`<html><body>${renderToStaticMarkup(fixture)}</body></html>`);
		assert.equal(document.querySelector('[role="combobox"], [role="listbox"], [role="option"], [role="menuitemradio"]'), null);
		assert.ok(document.querySelectorAll('button[type="button"]').length);
		for (const label of labels) assert.ok(document.documentElement.textContent!.includes(label), label);
	}
	const {document} = parseHTML(`<html><body>${renderToStaticMarkup(fixtures[0][0])}</body></html>`);
	assert.match(document.querySelector('[data-provider-mark="openai"]')!.getAttribute('style')!, /url\("\/provider-marks\/openai\.svg"\)/);
});

test("Proposed search inputs control unique named listboxes and expose committed selection", () => {
	const { document } = parseHTML(renderToStaticMarkup(<InterfaceAnimationsContext value={animations}>
		<ModelMenuList models={[model, { ...model, provider: "anthropic" }]} effectiveId="sample" effectiveProvider="anthropic" onPick={() => {}} />
		<ProviderMenuList providers={providers} onPick={() => {}} />
		<FontMenuList families={["Georgia", "Segoe UI"]} effectiveFamily={null} onPick={() => {}} />
		<FontMenuList families={["Georgia"]} effectiveFamily="Georgia" onPick={() => {}} />
	</InterfaceAnimationsContext>));
	const inputs = [...document.querySelectorAll('[role="combobox"]')];
	assert.equal(inputs.length, 4);
	const ids = new Set<string>();
	for (const input of inputs) {
		assert.ok(input.getAttribute("aria-label"));
		assert.equal(input.getAttribute("aria-autocomplete"), "list");
		assert.equal(input.getAttribute("aria-expanded"), "true");
		const list = document.getElementById(input.getAttribute("aria-controls")!)!;
		assert.equal(list.getAttribute("role"), "listbox");
		assert.ok(list.getAttribute("aria-label"));
		for (const option of list.querySelectorAll('[role="option"]')) {
			assert.ok(option.id);
			assert.ok(!ids.has(option.id));
			ids.add(option.id);
			assert.equal(option.getAttribute("tabindex"), "-1");
			assert.equal(option.getAttribute("data-menu-selected"), option.getAttribute("aria-selected"));
		}
	}
	const selectedModel = document.querySelector('[data-testid="model-list"] [aria-selected="true"]')!;
	assert.ok(selectedModel.textContent?.includes("anthropic"));
	const fontLists = [...document.querySelectorAll('[data-testid="font-list"]')];
	assert.equal(fontLists[0]!.querySelectorAll('[role="option"]').length, 2);
	assert.match(fontLists[0]!.querySelector('[aria-selected="true"]')!.textContent!, /Segoe UI/);
	assert.match(fontLists[1]!.querySelector('[aria-selected="true"]')!.textContent!, /Georgia/);
});

test("font helpers use the supplied default identity without changing Current's default", () => {
	assert.deepEqual(fontMenuResults("segoe", ["Georgia"], "Segoe UI"), [null]);
	assert.equal(customFamilyFor("segoe", ["Georgia"], "Segoe UI"), null);
	assert.deepEqual(fontMenuResults("source", ["Georgia"], "Segoe UI"), []);
	assert.equal(customFamilyFor("source", ["Georgia"], "Segoe UI"), "source");
	assert.deepEqual(fontMenuResults("source", ["Georgia"]), [null]);
	assert.equal(customFamilyFor("source", ["Georgia"]), null);
});

test("search arrow navigation exposes a real active option while Enter and pointer keep their picks", async () => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	const picks: string[] = [];
	try {
		await act(async () => root.render(<InterfaceAnimationsContext value={animations}>
			<ProviderMenuList providers={providers} onPick={(provider) => picks.push(provider.id)} />
		</InterfaceAnimationsContext>));
		const input = env.host.querySelector("input")!;
		const rows = [...env.host.querySelectorAll<HTMLButtonElement>('[role="option"]')];
		await act(async () => { env.key(input, "ArrowDown"); });
		assert.equal(env.document.activeElement, input);
		assert.equal(input.getAttribute("aria-activedescendant"), rows[0]!.id);
		await act(async () => { env.key(input, "ArrowDown"); });
		assert.equal(input.getAttribute("aria-activedescendant"), rows[1]!.id);
		await act(async () => { env.key(input, "Enter"); });
		assert.deepEqual(picks, [rows[1]!.getAttribute("data-testid")!.replace("provider-option-", "")]);
		assert.equal(rows[1]!.getAttribute("aria-selected"), "true");
		await act(async () => rows[0]!.click());
		assert.equal(rows[0]!.getAttribute("data-menu-selected"), "true");
		assert.equal(rows[1]!.getAttribute("aria-selected"), "false");
	} finally {
		await act(async () => root.unmount());
		env.restore();
	}
});

test("font option identities survive reordered results and loading never exposes a missing active option", async () => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	const picks: Array<string | null> = [];
	const render = (families?: string[]) => root.render(<InterfaceAnimationsContext value={animations}>
		<FontMenuList families={families} effectiveFamily={null} onPick={(family) => picks.push(family)} />
	</InterfaceAnimationsContext>);
	try {
		await act(async () => render(["Georgia"]));
		const id = env.host.querySelector('[data-testid="font-option-Georgia"]')!.id;
		await act(async () => render(["Arial", "Georgia"]));
		assert.equal(env.host.querySelector('[data-testid="font-option-Georgia"]')!.id, id);
		const input = env.host.querySelector("input")!;
		await act(async () => { env.key(input, "ArrowDown"); });
		assert.equal(env.document.getElementById(input.getAttribute("aria-activedescendant")!)?.getAttribute("role"), "option");
		await act(async () => render());
		assert.equal(env.host.querySelector('[role="listbox"]')!.getAttribute("aria-busy"), "true");
		assert.equal(input.hasAttribute("aria-activedescendant"), false);
		await act(async () => { env.key(input, "Enter"); });
		assert.deepEqual(picks, []);
	} finally {
		await act(async () => root.unmount());
		env.restore();
	}
});

test("font filtering resets active descendants, preserves family IDs and exposes the custom choice", async () => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	const picks: Array<string | null> = [];
	try {
		await act(async () => root.render(<InterfaceAnimationsContext value={animations}>
			<FontMenuList families={["Arial", "Georgia", "Segoe UI"]} effectiveFamily="Georgia" onPick={(value) => picks.push(value)} />
		</InterfaceAnimationsContext>));
		const input = env.host.querySelector<HTMLInputElement>("input")!;
		const georgiaId = env.host.querySelector('[data-testid="font-option-Georgia"]')!.id;
		const setValue = Object.getOwnPropertyDescriptor(env.window.HTMLInputElement.prototype, "value")!.set!;
		const type = (value: string) => {
			// Linkedom lacks the browser's default text type after React removes the type attribute.
			input.type = "text";
			setValue.call(input, value);
			input.dispatchEvent(new env.window.Event("input", { bubbles: true }));
		};
		await act(async () => { env.key(input, "ArrowDown"); });
		assert.ok(input.hasAttribute("aria-activedescendant"));
		await act(async () => type("Georgia"));
		assert.equal(input.hasAttribute("aria-activedescendant"), false);
		assert.equal(env.host.querySelectorAll('[role="option"]').length, 1);
		assert.equal(env.host.querySelector('[role="option"]')!.id, georgiaId);
		await act(async () => { env.key(input, "ArrowDown"); });
		assert.equal(input.getAttribute("aria-activedescendant"), georgiaId);
		await act(async () => type("Baskerville"));
		assert.equal(input.hasAttribute("aria-activedescendant"), false);
		await act(async () => { env.key(input, "ArrowDown"); });
		const custom = env.host.querySelector('[data-testid="font-option-custom"]')!;
		assert.equal(input.getAttribute("aria-activedescendant"), custom.id);
		await act(async () => { env.key(input, "Enter"); });
		assert.deepEqual(picks, ["Baskerville"]);
		await act(async () => type("segoe"));
		const defaultRow = env.host.querySelector('[data-testid="font-option-default"]')!;
		assert.match(defaultRow.textContent!, /Segoe UI/);
		assert.equal(env.host.querySelector('[data-testid="font-option-custom"]'), null);
	} finally {
		await act(async () => root.unmount());
		env.restore();
	}
});

test("thinking menu arrows move focus without committing; native activation keys remain available", async () => {
	const env = environment();
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(env.host);
	function Thinking() {
		const [level, setLevel] = useState("medium");
		return <ThinkingMenuList levels={["low", "medium", "high"]} effectiveLevel={level} onPick={setLevel} />;
	}
	try {
		await act(async () => root.render(<InterfaceAnimationsContext value={animations}><Thinking /></InterfaceAnimationsContext>));
		const rows = [...env.host.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
		assert.equal(env.host.querySelector('[role="menu"]')!.getAttribute("aria-label"), "Thinking level");
		assert.equal(rows[1]!.getAttribute("aria-checked"), "true");
		assert.equal(rows[1]!.getAttribute("tabindex"), "0");
		await act(async () => { env.key(rows[1]!, "ArrowDown"); });
		assert.equal(env.document.activeElement, rows[2]);
		assert.equal(rows[2]!.getAttribute("data-menu-selected"), "false");
		assert.equal(rows[1]!.getAttribute("aria-checked"), "true");
		assert.equal(rows[2]!.getAttribute("tabindex"), "0");
		assert.equal(env.key(rows[2]!, "Enter").defaultPrevented, false);
		await act(async () => rows[2]!.click());
		assert.equal(rows[2]!.getAttribute("aria-checked"), "true");
		await act(async () => rows[0]!.click());
		assert.equal(rows[0]!.getAttribute("aria-checked"), "true");
		assert.equal(env.key(rows[0]!, " ").defaultPrevented, false);
	} finally {
		await act(async () => root.unmount());
		env.restore();
	}
});
