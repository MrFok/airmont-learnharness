import assert from "node:assert/strict";
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const bundle = await build({
	stdin: {
		loader: "tsx",
		resolveDir: process.cwd(),
		contents: `
import React, {useState, useRef} from "react";
import {createRoot} from "react-dom/client";
import {DesignProvider} from "./components/interface/design-provider";
import {InteractionLayersProvider} from "./components/interaction-layers";
import {MermaidOverlay, SessionMermaidContext} from "./components/session-overlay";
import {VisualOutputCard} from "./components/artifacts/visual-card";
import {DemoOutputCard} from "./components/artifacts/demo-card";
import {PlanPopup} from "./components/plan-block";
import {GraphChromeRow} from "./components/graph-view";
import {sanitizeRenderSettings} from "./src/core/render-settings";
const source='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160"><path d="M20 140L280 20" stroke="#336699"/><text x="20" y="30">Original figure</text></svg>';
const html='<html><body style="margin:20px;font:16px Georgia;color:#336699"><button>Original demo</button><p>Untouched generated document.</p></body></html>';
const tree={nodes:[{id:"a",title:"First concept"},{id:"b",title:"Second concept"}],edges:[{from:"a",to:"b"}],version:1};
const messages=[{id:"plan",role:"assistant",parts:[{type:"tool-plan_init",state:"output-available",output:{ok:true,tree}}]}];
function Harness(){
 const [focus,setFocus]=useState(null),[plan,setPlan]=useState(false),[settings,setSettings]=useState(()=>sanitizeRenderSettings({}));
 const search=useRef(null),file=useRef(null);
 return <InteractionLayersProvider><DesignProvider><header style={{height:60}}><button data-outside>Outside session</button></header>
 <main data-test-session style={{position:"relative",margin:"0 auto",width:"min(100%,1000px)",height:640,padding:12}}>
 <div data-background><button data-open-plan onClick={()=>setPlan(true)}>Open plan</button>
 <div data-proposed-graph-controls><GraphChromeRow isEmpty={false} query="" onQuery={()=>{}} noMatch={false} importing={false} searchInputRef={search} fileInputRef={file} onImportFiles={()=>{}} settings={settings} changeSettings={setSettings} onOpenChains={()=>{}}/></div>
 <SessionMermaidContext value={{openFigure:(svg,inverted)=>setFocus({svg,inverted}),openMermaid:()=>{}}}>
 <VisualOutputCard output={{svg:source}}/>
 </SessionMermaidContext><DemoOutputCard output={{title:"An original demo",html}}/></div>
 {plan&&<PlanPopup messages={messages} onClose={()=>setPlan(false)}/>}
 {focus&&<MermaidOverlay {...focus} onClose={()=>setFocus(null)}/>}
 </main></DesignProvider></InteractionLayersProvider>
}
createRoot(document.getElementById("viewer-test-root")).render(<Harness/>);
`,
	},
	bundle: true,
	write: false,
	platform: "browser",
	format: "iife",
	jsx: "automatic",
	minify: true,
	define: { "process.env": '{"NODE_ENV":"development"}' },
	plugins: [{
		name: "unused-node-imports",
		setup(builder) {
			builder.onResolve({ filter: /^node:/ }, ({ path }) => ({ path, external: true, sideEffects: false }));
		},
	}],
});
assert.doesNotMatch(bundle.outputFiles[0].text, /node:crypto/);

const directory = join(process.cwd(), ".next/visual-pass/graph-artifacts/viewers");
await mkdir(directory, { recursive: true });
const browser = await puppeteer.launch({
	executablePath: [process.env.CHROME_PATH, join(process.env.USERPROFILE, "AppData/Local/Google/Chrome/Application/chrome.exe"), join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe")].find((path) => path && existsSync(path)),
	headless: true,
	protocolTimeout: 60000,
});
try {
	const page = await browser.newPage();
	await page.setRequestInterception(true);
	page.on("request", (request) => {
		if (new URL(request.url()).pathname === "/favicon.ico") void request.respond({ status: 204 });
		else void request.continue();
	});
	await page.setJavaScriptEnabled(false);
	await page.goto(process.env.LH_AUDIT_ORIGIN ?? "http://127.0.0.1:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
	const css = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => `<link rel="stylesheet" href="${link.href}">`).join(""));
	assert.ok(css, "the running app supplies the actual canonical styles");
	await page.setViewport({ width: 1440, height: 1000 });
	await page.setContent(`<!doctype html><html data-design-system="canonical"><head><link rel="icon" href="data:,">${css}</head><body data-app-interface><div id="viewer-test-root"></div></body></html>`);
	await page.setJavaScriptEnabled(true);
	const errors = [];
	const failedResources = [];
	page.on("response", (response) => {
		if (response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() });
	});
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (["warning", "warn", "error"].includes(message.type())) errors.push(message.text());
	});
	await page.addScriptTag({ content: bundle.outputFiles[0].text });
	await page.waitForSelector('[data-testid="demo-iframe"]').catch((error) => {
		throw new Error(JSON.stringify(errors), { cause: error });
	});
	await page.waitForFunction(() => Number.parseFloat(document.querySelector('[data-testid="demo-iframe"]').style.height) < 360);
	assert.equal(await page.$eval('[data-testid="demo-iframe"]', (node) => node.getAttribute("sandbox")), "allow-scripts");
	assert.equal(await page.$$eval('[data-interface-artifact-paper]', (nodes) => nodes.length), 2);
	const graphSettings = '[aria-label="Graph display settings"]';
	await page.click(graphSettings);
	const graphPanel = await page.$eval(`${graphSettings} + div`, (panel) => ({
		className: panel.className,
		radius: getComputedStyle(panel).borderRadius,
		width: panel.getBoundingClientRect().width,
		background: getComputedStyle(panel).backgroundColor,
	}));
	assert.equal(graphPanel.radius, "12px", JSON.stringify(graphPanel));
	assert.ok(graphPanel.width >= 280);
	const graphAnchor = await page.$eval(graphSettings, (button) => {
		const trigger = button.getBoundingClientRect();
		const panel = button.nextElementSibling.getBoundingClientRect();
		return { right: panel.right - trigger.right, gap: panel.top - trigger.bottom };
	});
	assert.deepEqual(graphAnchor, { right: 0, gap: 8 });
	await page.keyboard.press("Escape");
	for (const [open, dialog, close] of [
		['[data-testid="visual-open"]', '[data-testid="mermaid-overlay"]', '[data-testid="mermaid-overlay-close"]'],
		['[data-open-plan]', '[data-testid="plan-popup"]', '[data-testid="plan-popup-close"]'],
	]) {
		await page.click(open);
		await page.waitForSelector(dialog);
		await page.waitForFunction((selector) => getComputedStyle(document.querySelector(`${selector} [data-viewer-transform]`)).opacity === "1", {}, dialog);
		assert.equal(await page.$eval(close, (node) => document.activeElement === node), true);
		assert.equal(await page.$eval('[data-background]', (node) => node.inert), false);
		assert.equal(await page.$eval('header', (node) => node.inert), false);
		assert.equal(await page.$eval(dialog, (node) => node.getAttribute('role')), 'region');
		assert.equal(await page.$eval(dialog, (node) => node.hasAttribute('aria-modal')), false);
		const geometry = await page.$eval(dialog, (node) => {
			const dialog = node.getBoundingClientRect(), session = document.querySelector('[data-test-session]').getBoundingClientRect();
			return { x: dialog.x - session.x, y: dialog.y - session.y, width: dialog.width - session.width, height: dialog.height - session.height, position: getComputedStyle(node).position };
		});
		assert.deepEqual(geometry, { x: 0, y: 0, width: 0, height: 0, position: "absolute" });
		await page.keyboard.down("Shift");
		await page.keyboard.press("Tab");
		await page.keyboard.up("Shift");
		assert.equal(await page.$eval(close, (node) => document.activeElement === node), true);
		await page.keyboard.press("Tab");
		assert.equal(await page.$eval(close, (node) => document.activeElement === node), true);
		await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
		assert.equal(await page.$eval(`${dialog} [data-viewer-transform]`, (node) => getComputedStyle(node).transitionDuration), "0s");
		await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
		await page.screenshot({ path: join(directory, dialog.includes("plan") ? "plan.png" : "figure.png") });
		await page.keyboard.press("Escape");
		await page.waitForSelector(dialog, { hidden: true });
		await page.waitForFunction((selector) => document.activeElement === document.querySelector(selector), {}, open);
		assert.equal(await page.$eval(open, (node) => document.activeElement === node), true);
		assert.equal(await page.$eval('[data-background]', (node) => node.inert), false);
	}
	await page.setViewport({ width: 390, height: 844 });
	await page.click('[data-testid="visual-open"]');
	await page.waitForSelector('[data-testid="mermaid-overlay"]');
	await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="mermaid-overlay"] [data-viewer-transform]')).opacity === "1");
	const targets = await page.$$eval('[data-testid="mermaid-overlay"] button', (nodes) => nodes.map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
	assert.ok(targets.every((target) => target.width >= 44 && target.height >= 44), JSON.stringify(targets));
	await page.screenshot({ path: join(directory, "figure-mobile.png") });
	await page.keyboard.press("Escape");
	await page.click('[data-open-plan]');
	await page.waitForSelector('[data-testid="plan-popup"]');
	const planHeading = await page.$eval('[data-testid="plan-popup"] > div > span:first-child', (node) => ({ height: node.getBoundingClientRect().height, lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight) }));
	assert.ok(planHeading.height <= planHeading.lineHeight + 1, JSON.stringify(planHeading));
	await page.screenshot({ path: join(directory, "plan-mobile.png") });
	await page.keyboard.press("Escape");
	await page.click(graphSettings);
	const mobileGraph = await page.$eval(graphSettings, (button) => {
		const trigger = button.getBoundingClientRect();
		const panel = button.nextElementSibling.getBoundingClientRect();
		return { width: trigger.width, height: trigger.height, panelLeft: panel.left, panelRight: panel.right };
	});
	assert.ok(mobileGraph.width >= 44 && mobileGraph.height >= 44, JSON.stringify(mobileGraph));
	assert.ok(mobileGraph.panelLeft >= 0 && mobileGraph.panelRight <= 390, JSON.stringify(mobileGraph));
	await page.keyboard.press("Escape");
	const searchAlignment = await page.$eval('[aria-label="Search nodes"]', (input) => {
		const field = input.getBoundingClientRect(), icon = input.previousElementSibling.getBoundingClientRect();
		return { inside: icon.top >= field.top && icon.bottom <= field.bottom && icon.left >= field.left && icon.right <= field.right };
	});
	assert.equal(searchAlignment.inside, true);
	await page.screenshot({ path: join(directory, "artifacts-mobile.png") });
	assert.deepEqual(errors, [], JSON.stringify({ errors, failedResources }));
	console.log(JSON.stringify({ graphPanel, targets, errors, screenshots: directory }));
} finally {
	await browser.close();
}
