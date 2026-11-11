import React, { act } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { renderToStaticMarkup } from "react-dom/server";
import { Toggle } from "../components/settings/controls";
import { InvertDiscIcon } from "../components/artifacts/invert-disc";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const animations = { paused: true, LoadingIndicator: () => null, ThinkingText: () => null };

test("Current retains native switch semantics without opting into Proposed presentation", () => {
	for (const checked of [false, true]) {
		for (const disabled of [false, true]) {
			for (const disc of [false, true]) {
				const icon = disc ? <InvertDiscIcon className="size-3" /> : undefined;
				const html = renderToStaticMarkup(<Toggle checked={checked} disabled={disabled}
					label="Example setting" title="Setting tooltip" onChange={() => {}} discIcon={icon} />);
				const { document } = parseHTML(html);
				const button = document.querySelector("button")!;
				assert.equal(button.getAttribute("role"), "switch");
				assert.equal(button.getAttribute("aria-label"), "Example setting");
				assert.equal(button.getAttribute("aria-checked"), String(checked));
				assert.equal(button.hasAttribute("disabled"), disabled);
				assert.equal(button.querySelectorAll("svg").length > 0, disc);
				assert.equal(document.querySelector(".proposed-toggle"), null);
			}
		}
	}
});

test("Proposed switches separate their track from the target and preserve the brightness disc", () => {
	for (const checked of [false, true]) {
		for (const disabled of [false, true]) {
			const { document } = parseHTML(renderToStaticMarkup(
				<InterfaceAnimationsContext value={animations}>
					<Toggle checked={checked} disabled={disabled} label="Invert figure brightness"
						title="Invert colors" onChange={() => {}} discIcon={<InvertDiscIcon className="size-3" />} />
				</InterfaceAnimationsContext>,
			));
			const button = document.querySelector("button")!;
			assert.equal(button.getAttribute("role"), "switch");
			assert.equal(button.getAttribute("aria-checked"), String(checked));
			assert.equal(button.getAttribute("aria-label"), "Invert figure brightness");
			assert.equal(button.getAttribute("title"), "Invert colors");
			assert.equal(button.getAttribute("data-testid"), "toggle-invert-figure-brightness");
			assert.equal(button.hasAttribute("disabled"), disabled);
			assert.equal(button.className, "proposed-toggle");
			const track = button.firstElementChild!;
			assert.equal(track.className, "proposed-toggle-track");
			assert.equal(track.getAttribute("aria-hidden"), "true");
			assert.equal(track.firstElementChild?.className, "proposed-toggle-thumb proposed-toggle-disc");
			const expectedIcon = parseHTML(renderToStaticMarkup(<InvertDiscIcon className="size-3" />)).document.querySelector("svg")!;
			assert.equal(track.querySelector("svg")?.outerHTML, expectedIcon.outerHTML);
		}
	}
});

test("Current and Proposed switches preserve controlled changes and suppress disabled clicks", async () => {
	const dom = parseHTML("<html><body><div id='root'></div></body></html>");
	const previous = new Map<string, PropertyDescriptor | undefined>();
	for (const [key, value] of Object.entries({ window: dom.window, document: dom.document, HTMLElement: dom.window.HTMLElement })) {
		previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
	const { createRoot } = await import("react-dom/client");
	const host = dom.document.querySelector<HTMLDivElement>("#root")!;
	const root = createRoot(host);
	try {
		for (const proposed of [false, true]) {
			for (const checked of [false, true]) {
				for (const disabled of [false, true]) {
					for (const disc of [false, true]) {
						const seen: boolean[] = [];
						await act(async () => root.render(
							<InterfaceAnimationsContext value={proposed ? animations : null}>
								<Toggle checked={checked} disabled={disabled} label="Test setting" onChange={(next) => seen.push(next)}
									discIcon={disc ? <InvertDiscIcon className="size-3" /> : undefined} />
							</InterfaceAnimationsContext>,
						));
						const button = host.querySelector("button")!;
						await act(async () => (button.querySelector("svg") ?? button.lastElementChild!).dispatchEvent(new dom.window.Event("click", { bubbles: true })));
						assert.deepEqual(seen, disabled ? [] : [!checked]);
						assert.equal(button.getAttribute("aria-checked"), String(checked));
					}
				}
			}
		}
	} finally {
		await act(async () => root.unmount());
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
