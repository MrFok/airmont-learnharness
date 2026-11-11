import React, { act, useContext } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { StreamdownContext, useIsCodeFenceIncomplete } from "streamdown";
import { MessageResponse, ToolContentResponse, streamdownPlugins } from "../components/ai-elements/message.tsx";
import { markdownCode } from "../lib/markdown-code.ts";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

async function mounted(run: (host: HTMLElement, root: ReturnType<typeof createRoot>) => Promise<void>) {
	const dom = parseHTML("<!doctype html><html><body><div id='root'></div></body></html>");
	const keys = { window: dom.window, document: dom.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node };
	const previous = new Map(Object.keys(keys).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	Object.assign(globalThis, keys);
	const host = dom.document.querySelector<HTMLElement>("#root")!;
	const root = createRoot(host);
	try { await run(host, root); }
	finally {
		await act(async () => root.unmount());
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
}

test("unchanged Markdown accepts appearance and parsing-mode changes", async () => mounted(async (host, root) => {
	await act(async () => root.render(<MessageResponse className="first" mode="static">{"**unfinished"}</MessageResponse>));
	assert.equal(host.querySelector("strong"), null);
	await act(async () => root.render(<MessageResponse className="second" mode="streaming">{"**unfinished"}</MessageResponse>));
	assert.ok(host.querySelector(".second"));
	assert.equal(host.querySelector(".first"), null);
	assert.equal(host.querySelector("strong")?.textContent, "unfinished");
}));

test("unchanged content propagates theme and streaming changes without rewriting its source", async () => mounted(async (host, root) => {
	function Probe() {
		const context = useContext(StreamdownContext);
		return <h1>{JSON.stringify([context.shikiTheme, context.isAnimating])}</h1>;
	}
	const plugins = { math: streamdownPlugins.math, cjk: streamdownPlugins.cjk };
	const components = { h1: Probe };
	await act(async () => root.render(<MessageResponse mode="static" plugins={plugins} components={components} shikiTheme={["github-light", "github-dark"]}>{"# same"}</MessageResponse>));
	await act(async () => root.render(<MessageResponse mode="static" plugins={plugins} components={components} shikiTheme={["solarized-light", "solarized-dark"]} isAnimating>{"# same"}</MessageResponse>));
	assert.deepEqual(JSON.parse(host.querySelector("h1")!.textContent!), [["solarized-light", "solarized-dark"], true]);
}));

test("the mounted renderer shows a middle-only code edit after highlighting finishes", async () => mounted(async (host, root) => {
	const first = "// " + "prefix".repeat(25) + '\nconst value = "FIRST";\n// ' + "suffix".repeat(25);
	const second = first.replace("FIRST", "OTHER");
	const themes = markdownCode.getThemes();
	for (const code of [first, second]) {
		await new Promise<void>(resolve => {
			if (markdownCode.highlight({ code, language: "typescript", themes }, () => resolve())) resolve();
		});
	}
	const render = async (code: string) => {
		await act(async () => root.render(<MessageResponse mode="static">{"```typescript\n" + code + "\n```"}</MessageResponse>));
		for (let attempt = 0; attempt < 50 && !host.querySelector('code span[style]'); attempt++) {
			await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
		}
		assert.ok(host.querySelector('code span[style]'), "the highlighted renderer replaced its plain fallback");
	};
	await render(first);
	assert.ok(host.textContent?.includes("FIRST"));
	await render(second);
	assert.ok(host.textContent?.includes("OTHER"));
	assert.ok(!host.textContent?.includes("FIRST"));
}));

test("an open code fence is incomplete only while its own content is live", () => {
	function Probe() { return <code data-incomplete={String(useIsCodeFenceIncomplete())} />; }
	const source = "```mermaid\ngraph TD\nA -->";
	for (const isAnimating of [true, false]) {
		const html = renderToStaticMarkup(<MessageResponse components={{ code: Probe }} isAnimating={isAnimating}>{source}</MessageResponse>);
		assert.ok(html.includes(`data-incomplete="${isAnimating}"`));
	}
});

test("tool content preserves code literals and applies appearance changes with unchanged input", async () => mounted(async (host, root) => {
	const source = "Literal `\\(x\\)` and $x = 1$.";
	await act(async () => root.render(<ToolContentResponse mode="static" className="before">{source}</ToolContentResponse>));
	const before = host.textContent;
	await act(async () => root.render(<ToolContentResponse mode="static" className="after">{source}</ToolContentResponse>));
	assert.equal(host.textContent, before);
	assert.ok(host.querySelector(".after"));
	assert.equal(host.querySelector('code[data-streamdown="inline-code"]')?.textContent, "\\(x\\)");
}));
