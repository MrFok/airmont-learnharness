import React from "react";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LearnerIdentity } from "../components/profile";
import { ProfileSection } from "../components/settings/profile-section";
import { ThinkingBlock } from "../components/thinking-block";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";

(globalThis as Record<string, unknown>).React = React;

describe("learner profile surfaces", () => {
	it("keeps legacy thinking markup when the profile is empty", () => {
		const markup = renderToStaticMarkup(<ThinkingBlock text="A thought" defaultOpen />);
		assert.match(markup, /YOUR THINKING/);
		assert.match(markup, /border-l-/);
		assert.doesNotMatch(markup, /data-learner-identity/);
	});
	it("uses one unboxed proposed thinking row with a brain icon and accessible collapse", () => {
		const markup = renderToStaticMarkup(
			<ThinkingBlock appearance="proposed" text="A thought" testId="thinking" />,
		);
		assert.match(markup, /lucide-brain/);
		assert.doesNotMatch(markup, /data-learner-identity|<img/);
		assert.match(markup, /aria-expanded="false"/);
		assert.match(markup, /aria-controls="([^"]+)"/);
		assert.match(markup, /<p[^>]+hidden/);
		assert.doesNotMatch(markup, /border-l-|bg-card/);
	});
	it("renders username and image fallbacks without remote image requests", () => {
		const markup = renderToStaticMarkup(
			<LearnerIdentity profile={{ username: "Ricky", avatar: "https://example.com/image.png" }} />,
		);
		assert.match(markup, /Ricky/);
		assert.doesNotMatch(markup, /<img|example.com/);
	});
	it("flattens nested learner thinking throughout the Proposed preview context", () => {
		const markup = renderToStaticMarkup(
			<InterfaceAnimationsContext value={{ LoadingIndicator: () => null, ThinkingText: () => null }}>
				<ThinkingBlock text="A nested thought" inCard defaultOpen />
			</InterfaceAnimationsContext>,
		);
		assert.match(markup, /data-appearance="proposed"/);
		assert.match(markup, />Your thinking<\/span>/);
		assert.match(markup, /A nested thought/);
		assert.doesNotMatch(markup, /YOUR THINKING|>You<|border-l-|bg-card/);
	});
	it("exposes labeled controlled fields, save failure and pending states without writing on mount", () => {
		let writes = 0;
		const markup = renderToStaticMarkup(
			<ProfileSection
				profile={{ username: "Ricky", avatar: null }}
				onSave={() => {
					writes += 1;
				}}
				error="Could not save"
				saving
			/>,
		);
		assert.equal(writes, 0);
		assert.match(markup, /type="file"/);
		assert.match(markup, /accept="image\/png,image\/jpeg,image\/webp"/);
		assert.match(markup, /autoComplete="nickname"/);
		assert.match(markup, /role="alert"/);
		assert.match(markup, /Saving…/);
		assert.match(markup, /disabled/);
	});
});
