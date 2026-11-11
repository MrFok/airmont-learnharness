import React, { act } from "react";
import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { DictationMeter } from "../components/dictation-meter";
import { METER_CELLS, METER_TICK_MS, meterLevelHeight, rmsToMeter } from "../components/dictation-level";

test("dictation level mapping preserves the calibrated window and makes silence zero height", () => {
	assert.equal(rmsToMeter(10 ** (-50 / 20)), 0);
	assert.equal(rmsToMeter(10 ** (-10 / 20)), 1);
	assert.equal(meterLevelHeight(rmsToMeter(0)), 0);
	assert.equal(meterLevelHeight(rmsToMeter(0.01)), 4);
	assert.equal(meterLevelHeight(rmsToMeter(0.1)), 12);
	assert.equal(meterLevelHeight(rmsToMeter(1)), 16);
	for (const invalid of [-1, NaN, Infinity]) assert.equal(meterLevelHeight(rmsToMeter(invalid)), 0);
});

test("a taller preview peak widens visual amplitude without inventing a signal at silence", () => {
	assert.equal(meterLevelHeight(rmsToMeter(0), 24), 0);
	assert.equal(meterLevelHeight(rmsToMeter(0.01), 24), 6);
	assert.equal(meterLevelHeight(rmsToMeter(0.1), 24), 18);
	assert.equal(meterLevelHeight(rmsToMeter(1), 24), 24);
});

test("rendered meter follows quiet, loud and silent RMS even with reduced motion and animation pause", async () => {
	const dom = parseHTML("<html><body><div data-motion-paused='true'></div></body></html>");
	Object.assign(globalThis, {
		React,
		window: dom.window,
		document: dom.document,
		HTMLElement: dom.window.HTMLElement,
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	dom.window.matchMedia = ((query: string) => ({ media: query, matches: true })) as typeof window.matchMedia;
	Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", {
		configurable: true,
		get: () => 160,
	});
	let resize: () => void = () => {};
	let disconnected = false;
	class TestResizeObserver {
		constructor(callback: () => void) {
			resize = callback;
		}
		observe() {}
		disconnect() {
			disconnected = true;
		}
	}
	Object.assign(globalThis, { ResizeObserver: TestResizeObserver });
	let tick = () => {};
	let cleared = false;
	const interval = mock.method(globalThis, "setInterval", ((callback: () => void, ms: number) => {
		assert.equal(ms, METER_TICK_MS);
		tick = callback;
		return 1;
	}) as unknown as typeof setInterval);
	const clear = mock.method(globalThis, "clearInterval", () => {
		cleared = true;
	});
	const host = document.querySelector("[data-motion-paused]")!;
	const root = createRoot(host);
	const levelRef = { current: 0 };
	const bars = () => [...host.querySelectorAll<HTMLElement>('[data-testid="dictation-meter"] > span')];
	try {
		await act(async () => root.render(<DictationMeter levelRef={levelRef} />));
		assert.equal(bars().length, 40);
		assert.ok(bars().every((bar) => bar.style.height === "0px"));
		levelRef.current = 0.01;
		await act(async () => tick());
		assert.equal(bars().at(-1)?.style.height, "4px");
		levelRef.current = 0.1;
		await act(async () => tick());
		assert.equal(bars().at(-1)?.style.height, "12px");
		assert.equal(bars().at(-2)?.style.height, "4px");
		levelRef.current = 0;
		await act(async () => {
			for (let index = 0; index < METER_CELLS; index += 1) tick();
		});
		assert.ok(bars().every((bar) => bar.style.height === "0px"));
		Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", {
			configurable: true,
			get: () => 32,
		});
		await act(async () => resize());
		assert.equal(bars().length, 8);
		assert.ok(bars().every((bar) => !bar.style.animation));
	} finally {
		await act(async () => root.unmount());
		interval.mock.restore();
		clear.mock.restore();
	}
	assert.equal(cleared, true);
	assert.equal(disconnected, true);
});
