import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { DemoOutputCard, buildDemoSrcDoc } from "../components/artifacts/demo-card";
import { VisualOutputCard } from "../components/artifacts/visual-card";
import { MermaidOverlay } from "../components/session-overlay";
import { DesignProvider } from "../components/interface/design-provider";

Object.assign(globalThis, { React });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><text fill="#336699">Original figure</text></svg>';
const html = '<html><body style="font-family:serif;color:#336699"><button>Original demo</button></body></html>';

test("canonical figures preserve original image content and natural sizing inside an inverted paper frame", () => {
	const { document } = parseHTML(renderToStaticMarkup(<DesignProvider><VisualOutputCard output={{ svg }} initialInverted /></DesignProvider>));
	const paper = document.querySelector("[data-interface-artifact-paper]")!;
	const image = paper.querySelector("img")!;
	assert.equal(decodeURIComponent(image.getAttribute("src")!.split(",").slice(1).join(",")), svg);
	assert.equal(image.getAttribute("width"), "320");
	assert.match(paper.getAttribute("style")!, /Iowan Old Style/);
	assert.match(paper.getAttribute("style")!, /invert\(1\) hue-rotate\(180deg\)/);
	assert.equal(paper.querySelector("[data-testid=visual-svg]")!.children.length, 1);
	assert.equal(paper.querySelectorAll("svg").length, 1);
	assert.equal(paper.textContent, "");
	assert.equal(document.querySelector("[data-testid=visual-download]")?.getAttribute("aria-label"), "Download figure as SVG");
});

test("canonical demos preserve sandbox, bridge, source styling, title and the outer brightness inversion", () => {
	const title = "An original demo title that stays readable";
	const { document } = parseHTML(renderToStaticMarkup(<DesignProvider><DemoOutputCard output={{ html, title }} initialInverted /></DesignProvider>));
	const paper = document.querySelector("[data-interface-artifact-paper]")!;
	const iframe = paper.querySelector("iframe")!;
	assert.equal(iframe.getAttribute("srcDoc"), buildDemoSrcDoc(html));
	assert.equal(iframe.getAttribute("sandbox"), "allow-scripts");
	assert.equal(iframe.getAttribute("scrolling"), "no");
	assert.equal(iframe.getAttribute("title"), title);
	assert.match(paper.getAttribute("style")!, /invert\(1\) hue-rotate\(180deg\)/);
	assert.doesNotMatch(iframe.getAttribute("style")!, /invert/);
	assert.equal(paper.querySelectorAll("svg").length, 1);
	assert.doesNotMatch(paper.textContent, /LearnHarness|Original demo/);
});

test("canonical figure focus retains the session overlay geometry and original isolated SVG", () => {
	const { document } = parseHTML(renderToStaticMarkup(<DesignProvider><MermaidOverlay svg={svg} onClose={() => {}} /></DesignProvider>));
	const dialog = document.querySelector('[role="dialog"]')!;
	assert.equal(dialog.getAttribute("aria-label"), "Figure focus");
	assert.ok(dialog.classList.contains("absolute"));
	assert.ok(!dialog.classList.contains("fixed"));
	assert.equal(dialog.getAttribute("tabindex"), "-1");
	const paper = dialog.querySelector("[data-interface-artifact-paper]")!;
	assert.equal(decodeURIComponent(paper.querySelector("img")!.getAttribute("src")!.split(",").slice(1).join(",")), svg);
	assert.ok(dialog.querySelector("[data-viewer-stage]"));
});
