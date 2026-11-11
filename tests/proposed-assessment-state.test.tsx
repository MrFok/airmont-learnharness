import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { ProbeDoneCard } from "../components/artifacts/probe-done-card";
import { AbortTurnBody } from "../components/abort-turn-dialog";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";
import { ThinkingHighlight } from "../components/interface/thinking-highlight";

Object.assign(globalThis, { React });
const assessment = { strands: [{ strand: "Slope", assessment: "Connect rates to limits." }], summary: "Start with a shrinking interval." };
const animations = { paused: false, ThinkingText: ThinkingHighlight, LoadingIndicator: () => null };
function render(part: { state?: string; input?: unknown; output?: unknown }) {
	return parseHTML(`<html><body>${renderToStaticMarkup(<InterfaceAnimationsContext value={animations}><ProbeDoneCard part={part} /></InterfaceAnimationsContext>)}</body></html>`).document;
}

test("pending assessments share the thinking highlight and announce a pending state without claiming completion", () => {
	for (const input of [{}, { assessment }]) {
		const document = render({ state: "input-streaming", input });
		assert.equal(document.querySelector('[data-probe-state="writing"]')?.getAttribute("aria-busy"), "true");
		assert.equal(document.querySelector("[data-proposed-thinking]")?.textContent, "Writing the assessment…");
		assert.equal(document.querySelector('[role="status"]')?.textContent, "Writing the assessment…");
		assert.doesNotMatch(document.body.textContent ?? document.documentElement.textContent, /concluded|Assessment recorded/);
	}
});

test("only acknowledged valid assessments are recorded and terminal states never keep writing", () => {
	const complete = render({ state: "output-available", input: { assessment }, output: { ok: true } });
	assert.ok(complete.querySelector('[data-probe-state="recorded"]'));
	assert.equal(complete.querySelector('[role="status"]')?.textContent, "Assessment recorded");
	assert.equal(complete.querySelector('[data-probe-state="recorded"]')?.tagName, "DETAILS");
	assert.equal(complete.querySelector('[data-probe-state="recorded"]')?.hasAttribute("open"), false);
	assert.match(complete.documentElement.textContent, /Connect rates to limits/);
	for (const part of [
		{ state: "output-available", output: { ok: false, error: "Answer the open question." } },
		{ state: "output-error", input: { assessment: "untrusted malformed input" } },
		{ state: "output-available", output: { ok: true } },
	]) {
		const document = render(part);
		assert.equal(document.querySelector("[data-proposed-thinking]"), null);
		assert.equal(document.querySelector('[data-testid="probe-done-card"]')?.getAttribute("aria-busy"), "false");
		assert.doesNotMatch(document.documentElement.textContent, /retried|untrusted malformed input|Writing the assessment/);
	}
});

test("standalone assessment retains the upstream caption and pending presentation", () => {
	const markup = renderToStaticMarkup(<ProbeDoneCard part={{ state: "input-streaming", input: {} }} />);
	assert.match(markup, /Probe assessment/);
	assert.match(markup, /Writing the assessment/);
	assert.doesNotMatch(markup, /data-proposed-thinking|data-probe-state|aria-busy/);
});

test("Proposed question dismissal explains the existing pause instead of promising automatic continuation", () => {
	const props = { mode: "question" as const, onClose() {}, onConfirm() {} };
	const proposed = renderToStaticMarkup(<AbortTurnBody {...props} variant="proposed" />);
	assert.match(proposed, /waits for your next message/);
	assert.doesNotMatch(proposed, /teacher moves on/);
	assert.match(renderToStaticMarkup(<AbortTurnBody {...props} />), /teacher moves on/);
});
