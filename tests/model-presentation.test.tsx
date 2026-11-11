import React from "react";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { modelDisplayName, providerMarkSource } from "../components/model-presentation";
import { ProviderMark } from "../components/provider-mark";

(globalThis as Record<string, unknown>).React = React;

describe("model selector presentation", () => {
	it("prefers catalog display names while retaining version coordinates", () => {
		assert.equal(modelDisplayName("claude-sonnet-4-5", "Claude Sonnet 4.5"), "Claude Sonnet 4.5");
		assert.equal(modelDisplayName("anthropic:claude-sonnet-4-5"), "Claude Sonnet 4.5");
		assert.equal(modelDisplayName("claude-3-5-sonnet"), "Claude 3.5 Sonnet");
		assert.equal(modelDisplayName("gpt-4.1-mini"), "GPT 4.1 Mini");
		assert.equal(modelDisplayName("z-ai/glm-5.3-flash"), "GLM 5.3 Flash");
		assert.equal(modelDisplayName("o3"), "o3");
	});
	it("maps the source provider rather than guessing from the model vendor", () => {
		assert.match(providerMarkSource("openrouter")!, /openrouter\.svg$/);
		assert.match(providerMarkSource("openai-codex")!, /openai\.svg$/);
		for (const provider of [
			"anthropic",
			"openai",
			"openrouter",
			"google",
			"deepseek",
			"ollama",
			"mistral",
			"zai",
			"azure-openai-responses",
			"xai",
			"github-copilot",
		])
			assert.ok(existsSync(join(process.cwd(), "public", providerMarkSource(provider)!)));
		assert.equal(providerMarkSource("new-local-provider"), null);
		const known = renderToStaticMarkup(<ProviderMark provider="anthropic" />);
		assert.match(known, /aria-label="anthropic source"/);
		assert.match(known, /provider-marks\/anthropic.svg/);
		const fallback = renderToStaticMarkup(<ProviderMark provider="new-local-provider" />);
		assert.match(fallback, /aria-label="new-local-provider source"/);
	});
	it("uses the source logos for subscription provider identities", () => {
		for (const [provider, asset] of [["chatgpt", "openai"], ["grok", "grok"]] as const) {
			const markup = renderToStaticMarkup(<ProviderMark provider={provider} />);
			assert.ok(markup.includes(`provider-marks/${asset}.svg`));
			assert.ok(markup.includes(`aria-label="${provider} source"`));
		}
	});
});
