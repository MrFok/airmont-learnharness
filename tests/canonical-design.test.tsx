import React from "react";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DesignProvider } from "../components/interface/design-provider";
import { BrailleSpinner } from "../components/braille-spinner";
import { Shimmer } from "../components/ai-elements/shimmer";
import { ThinkingBlock } from "../components/thinking-block";
import { DictationMeter } from "../components/dictation-meter";
import { appearanceVars, resolveAppearance, staleVarNames } from "../components/settings/appearance";

Object.assign(globalThis, { React });

describe("canonical application design", () => {
	it("activates the shared loading, thought, and dictation treatments without inventory fixtures", () => {
		const markup = renderToStaticMarkup(<DesignProvider>
			<BrailleSpinner label="Preparing lesson" />
			<Shimmer>Writing the assessment</Shimmer>
			<ThinkingBlock text="The ratio might settle toward a value." />
			<DictationMeter levelRef={{ current: 0 }} />
		</DesignProvider>);
		assert.match(markup, /aria-label="Preparing lesson"/);
		assert.match(markup, /data-proposed-loader="circular3"/);
		assert.match(markup, /data-proposed-thinking/);
		assert.match(markup, /Your thinking/);
		assert.match(markup, /data-appearance="proposed"/);
		assert.match(markup, /data-meter-baseline/);
		assert.doesNotMatch(markup, /data-proposed-inventory|braille-frame/);
	});
	it("keeps explicit saved overrides and resets only those overrides when cleared", () => {
		const saved = { background: "#202020", fontFamily: "Georgia", proseFontSize: 20, sessionNameSerif: false, mdRendering: { headingWeight: 800, boldColor: "#eeaabb" } };
		const before = structuredClone(saved);
		const custom = appearanceVars(resolveAppearance(saved));
		assert.equal(custom["--background"], "#202020");
		assert.equal(custom["--lh-prose-size"], "20px");
		assert.equal(custom["--lh-heading-weight"], "800");
		assert.equal(custom["--font-title"], "var(--font-prose)");
		assert.deepEqual(saved, before);
		const defaults = appearanceVars(resolveAppearance(undefined));
		assert.equal(defaults["--lh-heading-weight"], "600");
		assert.ok(staleVarNames(Object.keys(custom), defaults).includes("--font-prose"));
	});
	it("keeps shared production design code independent of inventory components", () => {
		const visit = (directory: string) => {
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				const path = join(directory, entry.name);
				if (entry.isDirectory()) visit(path);
				else if (/\.[tj]sx?$/.test(path)) assert.doesNotMatch(readFileSync(path, "utf8"), /(?:from|import\s*\()\s*["'][^"']*design-system\//, path);
			}
		};
		visit("components/interface");
	});
});
