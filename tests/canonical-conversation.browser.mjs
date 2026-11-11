import assert from "node:assert/strict";
import { build } from "esbuild";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const componentsOnly = process.env.LH_COMPONENTS_ONLY === "1";
const origin = process.env.LH_AUDIT_ORIGIN ?? "http://127.0.0.1:3000";
const browser = await puppeteer.launch({
	executablePath: process.env.CHROME_PATH ?? join(homedir(), "AppData/Local/Google/Chrome/Application/chrome.exe"),
	headless: true,
});
const page = await browser.newPage();
const issues = [];
const unavailable = [];
page.on("pageerror", (error) => issues.push(error.message));
page.on("console", (message) => {
	if (["warn", "warning", "error"].includes(message.type()) && !message.text().startsWith("Failed to load resource:")) issues.push(message.text());
});
page.on("response", (response) => {
	if (response.status() >= 400) unavailable.push({ path: new URL(response.url()).pathname, status: response.status() });
});
let home, reduced, draft, touch;
try {
	if (!componentsOnly) {
		await page.setViewport({ width: 1366, height: 950 });
		await page.goto(`${origin}/`, { waitUntil: "networkidle2", timeout: 60000 });
		await page.waitForSelector(".proposed-conversation-composer");
		await page.focus(".proposed-conversation-composer textarea");
		home = await page.evaluate(() => {
			const form = document.querySelector(".proposed-conversation-composer");
			const button = form.querySelector("button");
			const circle = getComputedStyle(button, "::before");
			return {
				canonical: document.documentElement.dataset.designSystem,
				heading: form.parentElement.previousElementSibling?.textContent,
				border: getComputedStyle(form.parentElement).borderWidth,
				fieldFocus: getComputedStyle(form.parentElement).outlineWidth,
				textareaFocus: getComputedStyle(form.querySelector("textarea")).outlineStyle,
				hit: [button.offsetWidth, button.offsetHeight],
				circle: [circle.width, circle.height],
				upArrow: !!button.querySelector(".lucide-arrow-up"),
				modes: [...document.querySelectorAll('[data-testid="home-mode-switch"] [role="radio"]')].map((row) => ({
					label: row.getAttribute("aria-label"), height: row.offsetHeight,
				})),
				overflow: document.documentElement.scrollWidth > innerWidth,
			};
		});
		assert.equal(home.canonical, "canonical");
		assert.equal(home.heading, "What do you want to learn?");
		assert.equal(home.fieldFocus, "2px");
		assert.equal(home.textareaFocus, "none");
		assert.deepEqual(home.circle, ["32px", "32px"]);
		assert.deepEqual(home.hit, [40, 40]);
		assert.equal(home.upArrow, true);
		assert.ok(home.modes.every((mode) => mode.height >= 44));
		assert.equal(home.overflow, false);
		await page.click('[data-testid="home-mode-switch"] [data-value="practice"]');
		await page.waitForFunction(() => document.querySelector(".proposed-conversation-composer textarea").placeholder.includes("practice"));
		await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
		await page.waitForFunction(() => document.querySelector('[data-testid="home-mode-switch"]').getAttribute("data-motion-disabled") === "true");
		reduced = await page.$eval("[data-sliding-pill]", (node) => getComputedStyle(node).transitionDuration);
		assert.ok(reduced.split(",").every((duration) => parseFloat(duration) === 0));
		await page.screenshot({ path: join(tmpdir(), "canonical-home.png") });
		await page.goto(`${origin}/chat/new?mode=practice`, { waitUntil: "networkidle2", timeout: 60000 });
		await page.waitForSelector('[data-testid="composer"]');
		draft = await page.evaluate(() => ({
			heading: document.querySelector('[data-testid="draft-prompt-heading"]')?.textContent,
			align: getComputedStyle(document.querySelector('[data-testid="draft-prompt-heading"]')).textAlign,
			upArrow: !!document.querySelector('[data-testid="composer"] .lucide-arrow-up'),
		}));
		assert.equal(draft.heading, "What do you want to practice?");
		assert.equal(draft.align, "center");
		assert.equal(draft.upArrow, true);
		await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
		await page.waitForFunction(() => document.querySelector('[aria-label="Close sidebar"]')?.offsetWidth >= 44);
		await page.click('[aria-label="Close sidebar"]');
		await page.waitForSelector('[aria-label="Open sidebar"]');
		await page.waitForFunction(() => document.querySelector('[aria-label="Open sidebar"]')?.parentElement.offsetWidth >= 44);
		const sidebarTouch = await page.$eval('[aria-label="Open sidebar"]', (node) => ({
			width: node.offsetWidth, height: node.offsetHeight,
			visibleWidth: node.parentElement.getBoundingClientRect().width,
			visibleHeight: node.parentElement.getBoundingClientRect().height,
		}));
		assert.ok(Object.values(sidebarTouch).every((size) => size >= 44));
		await page.waitForFunction(() => document.querySelector('[data-testid="composer"] button').offsetWidth >= 44);
		touch = await page.$eval('[data-testid="composer"] button', (node) => ({
			width: node.offsetWidth, height: node.offsetHeight, circle: getComputedStyle(node, "::before").width,
			overflow: document.documentElement.scrollWidth > innerWidth,
		}));
		assert.ok(touch.width >= 44 && touch.height >= 44);
		assert.equal(touch.circle, "32px");
		assert.equal(touch.overflow, false);
		await page.screenshot({ path: join(tmpdir(), "canonical-new-session-mobile.png") });
	}
	await page.setViewport({ width: 1366, height: 950 });
	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
	await page.setJavaScriptEnabled(false);
	await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60000 });
	const css = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => '<link rel="stylesheet" href="' + link.href + '">').join(""));
	assert.ok(css, "the running app supplies the production styles");
	const bundle = await build({
		stdin: {
			loader: "tsx", resolveDir: process.cwd(),
			contents: `
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {DesignProvider} from "./components/interface/design-provider";
import {Reasoning, ReasoningTrigger, ReasoningContent} from "./components/ai-elements/reasoning";
import {QuestionDock} from "./components/question-dock";
const input={question:"Which learning tools would help?",options:[{label:"Worked examples",value:"examples"},{label:"Practice questions",value:"practice"}],multiSelect:true};
function Harness(){const [questions,setQuestions]=useState(false);return <DesignProvider><main style={{maxWidth:900,margin:"32px auto",padding:16}}>
 <section data-reasoning-test><Reasoning defaultOpen><ReasoningTrigger/><ReasoningContent>{"Review the rate before answering."}</ReasoningContent></Reasoning><button data-after-reasoning onClick={()=>setQuestions(true)}>Show questions</button></section>
 {questions&&<section data-question-test><QuestionDock toolName="ask_user_question" toolCallId="browser-choices" input={input} expanded onExpand={()=>{}} onSubmit={()=>{throw new Error("This visual check must not submit an answer");}} dictationClaim={false}/></section>}
 </main></DesignProvider>}
createRoot(document.getElementById("conversation-test-root")).render(<Harness/>);
`,
		},
		bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", minify: true,
		define: { "process.env": '{"NODE_ENV":"development"}' },
		plugins: [{ name: "unused-node-imports", setup(builder) {
			builder.onResolve({ filter: /^node:/ }, ({ path }) => ({ path, external: true, sideEffects: false }));
		} }],
	});
	assert.doesNotMatch(bundle.outputFiles[0].text, /node:crypto/);
	await page.setContent('<!doctype html><html data-design-system="canonical"><head><link rel="icon" href="data:,">' + css + '</head><body data-app-interface><div id="conversation-test-root"></div></body></html>');
	await page.setJavaScriptEnabled(true);
	await page.addScriptTag({ content: bundle.outputFiles[0].text });
	await page.waitForSelector("[data-reasoning-test] [data-reasoning-panel]");
	const reasoningTrigger = '[data-reasoning-test] [data-slot="collapsible-trigger"]';
	await page.click(reasoningTrigger);
	await page.waitForFunction(() => {
		const panel = document.querySelector("[data-reasoning-test] [data-reasoning-panel]");
		return panel.inert && panel.getBoundingClientRect().height === 0;
	});
	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
	await page.waitForFunction(() => document.querySelector("[data-reasoning-test] [data-reasoning-panel]").dataset.motion === "animated");
	await page.click(reasoningTrigger);
	await page.waitForFunction(() => document.querySelector("[data-reasoning-test] [data-reasoning-panel]").getBoundingClientRect().height > 20);
	await page.click(reasoningTrigger);
	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
	await page.waitForFunction(() => {
		const panel = document.querySelector("[data-reasoning-test] [data-reasoning-panel]");
		return panel.dataset.motion === "instant" && panel.inert && panel.getBoundingClientRect().height === 0;
	});
	await page.focus(reasoningTrigger);
	await page.keyboard.press("Tab");
	assert.equal(await page.$eval("[data-after-reasoning]", (node) => document.activeElement === node), true);
	await page.focus(reasoningTrigger);
	await page.keyboard.press("Space");
	await page.waitForFunction(() => !document.querySelector("[data-reasoning-panel]").inert);
	assert.equal(await page.$eval(reasoningTrigger, (node) => document.activeElement === node && node.getAttribute("aria-expanded") === "true"), true);
	await page.focus(reasoningTrigger);
	await page.keyboard.press("Space");
	await page.waitForFunction(() => document.querySelector("[data-reasoning-panel]").inert);
	const reasoning = { closedInert: true, switchesMotionWhileMounted: true, keyboardFocus: true };
	await page.click("[data-after-reasoning]");
	await page.waitForSelector('[data-question-test] [data-testid="question-dock"]');
	const marker = '[data-question-test] [data-kbdrow="0"] > .proposed-choice-marker';
	const markerStyle = () => page.$eval(marker, (node) => ({ color: getComputedStyle(node).color, fill: getComputedStyle(node).backgroundColor }));
	const neutral = await markerStyle();
	await page.hover('[data-question-test] [data-kbdrow="0"]');
	assert.deepEqual(await markerStyle(), neutral);
	const rows = await page.$$('[data-question-test] [data-choice-mode="multi-select"] > button[role="checkbox"]');
	assert.equal(rows.length, 2);
	await rows[0].click();
	await rows[1].click();
	assert.equal(await page.$$eval('[data-question-test] button[role="checkbox"][aria-checked="true"]', (nodes) => nodes.length), 2);
	assert.equal(await page.$("[data-question-test] .proposed-choice-check"), null);
	const selected = await markerStyle();
	assert.notDeepEqual(selected, neutral);
	await page.hover('[data-question-test] [data-kbdrow="0"]');
	assert.deepEqual(await markerStyle(), selected);
	await rows[0].click();
	assert.equal(await page.$$eval('[data-question-test] button[role="checkbox"][aria-checked="true"]', (nodes) => nodes.length), 1);
	assert.equal(await page.$eval('[data-question-test] [data-choice-mode="multi-select"]', (node) => getComputedStyle(node).gap), "4px");
	const choices = { stableHoverMarkers: true, independentMultiSelection: true, noRedundantTicks: true };
	assert.deepEqual(issues, []);
	console.log(JSON.stringify({ componentsOnly, home, reduced, draft, touch, reasoning, choices, issues, unavailable, screenshots: componentsOnly ? [] : [join(tmpdir(), "canonical-home.png"), join(tmpdir(), "canonical-new-session-mobile.png")] }, null, 2));
} catch (error) {
	console.error(JSON.stringify({ issues, unavailable }));
	throw error;
} finally {
	await browser.close();
}
