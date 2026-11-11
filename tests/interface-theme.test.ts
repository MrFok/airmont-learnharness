import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILTIN_THEMES, DEFAULT_THEME, exportThemeFile, interfaceThemeVars, themeVars, type Theme } from "../src/core/themes.ts";

test("the production factory theme retains separate canvas, field, overlay and selection roles", () => {
	const vars = interfaceThemeVars(DEFAULT_THEME, undefined);
	assert.equal(vars["--background"], "#161616");
	assert.equal(vars["--card"], "#242424");
	assert.equal(vars["--popover"], "#2e2e2e");
	assert.equal(vars["--accent"], "#3a3a3a");
	assert.equal(vars["--input"], "#777777");
	assert.equal(vars["--surface-deep"], "#080808");
});

test("saved color overrides survive the production adapter and an export/import round trip", () => {
	const appearance = { background: "#202020", colors: { surface: "#303030", border: "#aabbcc", text: "#eeeeee" } };
	const before = structuredClone(appearance);
	const vars = interfaceThemeVars(DEFAULT_THEME, appearance);
	assert.equal(vars["--background"], "#202020");
	assert.equal(vars["--card"], "#303030");
	assert.equal(vars["--popover"], "#303030");
	assert.equal(vars["--input"], "#aabbcc");
	assert.equal(vars["--foreground"], "#eeeeee");
	const imported: Theme = { ...exportThemeFile(DEFAULT_THEME, appearance), id: "imported", builtin: false };
	assert.deepEqual(interfaceThemeVars(imported, undefined), vars);
	assert.deepEqual(appearance, before);
});

test("exporting the factory theme preserves its hierarchy when imported under a new name", () => {
	const imported: Theme = { ...exportThemeFile(DEFAULT_THEME, undefined), id: "my-theme", builtin: false };
	assert.deepEqual(interfaceThemeVars(imported, undefined), interfaceThemeVars(DEFAULT_THEME, undefined));
});

test("light presets retain their own palette instead of inheriting dark factory surfaces", () => {
	const light = BUILTIN_THEMES.find(theme => theme.mode === "light")!;
	const expected = themeVars(light.colors, light.mode);
	const actual = interfaceThemeVars(light, undefined);
	for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, key);
	assert.notEqual(actual["--surface-deep"], "#080808");
});
