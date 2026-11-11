import assert from "node:assert/strict";
import { test } from "node:test";
import type { CodeHighlighterPlugin, HighlightOptions } from "streamdown";
import { createMarkdownCodePlugin } from "../lib/markdown-code.ts";

type Result = NonNullable<ReturnType<CodeHighlighterPlugin["highlight"]>>;
const options = (code: string): HighlightOptions => ({ code, language: "typescript", themes: ["github-light", "github-dark"] });
const sourceOf = (result: Result) => result.tokens.map(line => line.map(token => token.content).join("")).join("\n");

function highlight(plugin: CodeHighlighterPlugin, input: HighlightOptions): Promise<Result> {
	return new Promise(resolve => {
		const cached = plugin.highlight(input, resolve);
		if (cached) resolve(cached);
	});
}

test("equal-length code with identical edges never shares the wrong highlighted content", async () => {
	const plugin = createMarkdownCodePlugin();
	const first = "// " + "prefix".repeat(25) + '\nconst value = "FIRST";\n// ' + "suffix".repeat(25);
	const second = first.replace("FIRST", "OTHER");
	assert.equal(first.length, second.length);
	assert.equal(first.slice(0, 100), second.slice(0, 100));
	assert.equal(first.slice(-100), second.slice(-100));
	const a = await highlight(plugin, options(first));
	const b = await highlight(plugin, options(second));
	assert.equal(sourceOf(a), first);
	assert.equal(sourceOf(b), second);
	assert.notEqual(a, b);
	assert.equal(plugin.highlight(options(first)), a);
});

test("concurrent requests share work and cache identity includes language and themes", async () => {
	const plugin = createMarkdownCodePlugin();
	const input = options("const value = 1;");
	const [a, b] = await Promise.all([highlight(plugin, input), highlight(plugin, input)]);
	assert.equal(a, b);
	const otherLanguage = await highlight(plugin, { ...input, language: "python" });
	const otherTheme = await highlight(plugin, { ...input, themes: ["solarized-light", "solarized-dark"] });
	assert.notEqual(a, otherLanguage);
	assert.notEqual(a, otherTheme);
	assert.equal(sourceOf(otherTheme), input.code);
	assert.equal(plugin.supportsLanguage("ts" as HighlightOptions["language"]), true);
	assert.equal(sourceOf(await highlight(plugin, { ...input, language: "unknown-language" as HighlightOptions["language"] })), input.code);
});

test("entry eviction follows recent use instead of retaining every streaming prefix", async () => {
	const plugin = createMarkdownCodePlugin({ maxEntries: 2 });
	const a = await highlight(plugin, options("const a = 1;"));
	await highlight(plugin, options("const b = 2;"));
	assert.equal(plugin.highlight(options("const a = 1;")), a);
	await highlight(plugin, options("const c = 3;"));
	assert.equal(plugin.highlight(options("const a = 1;")), a);
	assert.equal(plugin.highlight(options("const b = 2;")), null);
	assert.equal(sourceOf(await highlight(plugin, options("const b = 2;"))), "const b = 2;");
});

test("concurrent custom themes with the same authored name retain their own colors", async () => {
	const custom = (color: string) => ({
		name: "same-name",
		type: "dark" as const,
		colors: { "editor.foreground": color, "editor.background": "#000000" },
		settings: [{ settings: { foreground: color } }],
	});
	const red = custom("#ff0000");
	const green = custom("#00ff00");
	const a = createMarkdownCodePlugin();
	const b = createMarkdownCodePlugin();
	const [first, second] = await Promise.all([
		highlight(a, { code: "value", language: "text" as HighlightOptions["language"], themes: [red, red] }),
		highlight(b, { code: "value", language: "text" as HighlightOptions["language"], themes: [green, green] }),
	]);
	assert.ok(first.fg?.includes("#ff0000"));
	assert.ok(second.fg?.includes("#00ff00"));
	assert.equal(red.name, "same-name");
	assert.equal(green.name, "same-name");
});

test("the byte budget evicts results and oversized code still highlights without being retained", async () => {
	const input = options("const value = 1;");
	const baseline = createMarkdownCodePlugin();
	const result = await highlight(baseline, input);
	const singleBudget = 2 * (JSON.stringify(["typescript", ...input.themes, input.code]).length + JSON.stringify(result).length);
	const bounded = createMarkdownCodePlugin({ maxBytes: singleBudget + 10 });
	await highlight(bounded, input);
	const other = options("const value = 2;");
	await highlight(bounded, other);
	assert.equal(bounded.highlight(input), null);
	const oversized = createMarkdownCodePlugin({ maxBytes: 1 });
	assert.equal(sourceOf(await highlight(oversized, input)), input.code);
	assert.equal(oversized.highlight(input), null);
});
