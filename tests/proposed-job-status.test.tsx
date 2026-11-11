import React, { act, type ReactNode } from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { DispatchCard } from "../components/artifacts/dispatch-card";
import { SubagentSteerCard } from "../components/artifacts/steer-card";
import { JobsContext } from "../components/jobs-context";
import { InterfaceAnimationsContext } from "../components/ui/interface-animations";
import type { JobRecord, LhViewMessage } from "../src/core";

Object.assign(globalThis, { React });

const animations = {
	paused: true,
	LoadingIndicator: () => <span data-working="" />,
	ThinkingText: ({ children }: { children: string }) => <span>{children}</span>,
};
const job: JobRecord = {
	id: "job-status",
	kind: "research",
	chatId: "session-status",
	toolCallId: "dispatch-status",
	status: "error",
	activity: "aborted",
	createdAt: "2026-10-27T00:00:00Z",
	updatedAt: "2026-10-27T00:00:00Z",
	error: "Aborted by learner",
	delivery: { kind: "abort", status: "delivered" },
};
const abortedMessage: LhViewMessage = {
	id: "delivery-status",
	role: "user",
	parts: [{ type: "data-subagent-aborted", data: { kind: "research" } }],
};

function inventory(children: ReactNode, proposed = true) {
	return proposed ? <InterfaceAnimationsContext value={animations}>{children}</InterfaceAnimationsContext> : children;
}

function dispatch(record: JobRecord | null, proposed = true, kind = record?.kind ?? "research") {
	return parseHTML(renderToStaticMarkup(inventory(
		<JobsContext.Provider value={record ? [record] : []}>
			<DispatchCard toolCallId="dispatch-status" kind={kind} />
		</JobsContext.Provider>,
		proposed,
	))).document;
}

async function withClient(run: (root: Root, dom: ReturnType<typeof parseHTML>) => Promise<void>) {
	const dom = parseHTML('<html><body><div id="root"></div></body></html>');
	const { window, document } = dom;
	const globals = { window, document, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
	const originals = new Map(Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
	for (const [name, value] of Object.entries(globals)) {
		Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
	}
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(document.getElementById("root")!);
	try {
		await run(root, dom);
	} finally {
		await act(async () => root.unmount());
		for (const [name, descriptor] of originals) {
			if (descriptor) Object.defineProperty(globalThis, name, descriptor);
			else Reflect.deleteProperty(globalThis, name);
		}
	}
}

test("Proposed dispatch renders learner cancellation for every job kind and delivery phase", () => {
	for (const kind of ["research", "pdf", "visual", "demo"] as const) {
		for (const status of ["pending", "delivered"] as const) {
			const document = dispatch({ ...job, kind, delivery: { kind: "abort", status } });
			const row = document.querySelector('[data-testid="dispatch-settled"]')!;
			assert.equal(row.getAttribute("data-job-state"), "aborted");
			assert.match(row.textContent!, /aborted by the learner/);
			assert.ok(row.querySelector("svg.lucide-circle-x"));
			assert.doesNotMatch(row.outerHTML, /text-red-500|failed|finished|data-working/);
		}
	}
});

test("the abort discriminator wins over setup refusal text in Proposed", () => {
	for (const error of [
		"No model configured — set up your models first (missing: cheap)",
		"No OpenRouter key is set — add one in Settings → Keys",
	]) {
		const document = dispatch({ ...job, error });
		assert.ok(document.querySelector('[data-job-state="aborted"]'));
		assert.equal(document.querySelector('[data-testid="dispatch-refused"]'), null);
	}
});

test("Proposed keeps real failures, setup refusals, and successful completion distinct", () => {
	const failed = dispatch({ ...job, delivery: undefined });
	assert.match(failed.querySelector('[data-testid="dispatch-settled"]')!.textContent!, /failed/);
	assert.ok(failed.querySelector(".text-red-500"));
	assert.equal(failed.querySelector('[data-job-state="aborted"]'), null);
	const finished = dispatch({ ...job, status: "done", delivery: { kind: "result", status: "pending" }, error: undefined });
	assert.match(finished.querySelector('[data-testid="dispatch-settled"]')!.textContent!, /finished/);
	assert.ok(finished.querySelector("svg.lucide-check"));
	assert.equal(finished.querySelector('[data-job-state="aborted"]'), null);
	for (const [error, expected] of [
		["No model configured — set up your models first (missing: cheap)", "needs model setup"],
		["No OpenRouter key is set — add one in Settings → Keys", "needs a provider key"],
	]) {
		const refused = dispatch({ ...job, delivery: undefined, error });
		assert.match(refused.querySelector('[data-testid="dispatch-refused"]')!.textContent!, new RegExp(expected!));
		assert.equal(refused.querySelector('[data-job-state="aborted"]'), null);
	}
});

test("pending dispatch still displays a working indicator rather than terminal status", () => {
	for (const record of [null, { ...job, status: "running", delivery: undefined, error: undefined } as JobRecord]) {
		const document = dispatch(record);
		assert.ok(document.querySelector('[data-testid="dispatch-card"] [data-working]'));
		assert.equal(document.querySelector('[data-testid="dispatch-settled"]'), null);
	}
});

test("Proposed dispatch and delivery use the same stopped row while retaining test IDs", () => {
	const dispatchRow = dispatch(job).querySelector('[data-testid="dispatch-settled"]')!;
	const delivery = parseHTML(renderToStaticMarkup(inventory(<SubagentSteerCard message={abortedMessage} />))).document;
	const deliveryRow = delivery.querySelector('[data-testid="job-aborted-badge"]')!;
	assert.equal(deliveryRow.getAttribute("data-job-state"), "aborted");
	assert.equal(deliveryRow.getAttribute("class"), dispatchRow.getAttribute("class"));
	assert.equal(deliveryRow.querySelector("svg")!.outerHTML, dispatchRow.querySelector("svg")!.outerHTML);
	assert.equal(deliveryRow.lastElementChild!.textContent, "aborted by the learner");
});

test("Current retains its existing dispatch and delivery wording, icons, and classes", () => {
	const current = dispatch(job, false);
	const row = current.querySelector('[data-testid="dispatch-settled"]')!;
	assert.equal(row.textContent, "Research agentfailed");
	assert.equal(row.getAttribute("class"), "flex items-center gap-2 text-xs text-muted-foreground");
	assert.equal(row.hasAttribute("data-job-state"), false);
	assert.ok(row.querySelector("svg.lucide-x.text-red-500"));
	assert.equal(current.querySelector('[data-testid="dispatch-status"]'), null);
	assert.equal(current.querySelector('[data-testid="dispatch-failure-details"]'), null);
	const delivery = parseHTML(renderToStaticMarkup(<SubagentSteerCard message={abortedMessage} />)).document;
	const badge = delivery.querySelector('[data-testid="job-aborted-badge"]')!;
	assert.equal(badge.textContent, "researchaborted by the learner");
	assert.equal(badge.hasAttribute("data-job-state"), false);
	assert.equal(badge.getAttribute("class"), "flex items-center gap-2 text-xs text-muted-foreground");
	assert.ok(badge.querySelector("svg.lucide-circle-x.size-3\\.5"));
});

test("Proposed failure shows the cause as text and teacher recovery without a retry action", () => {
	for (const error of ["Connection timed out <script>unsafe()</script>", undefined, "  "]) {
		const document = dispatch({ ...job, delivery: undefined, error });
		const row = document.querySelector('[data-testid="dispatch-settled"]')!;
		const details = document.querySelector('[data-testid="dispatch-failure-details"]')!;
		assert.equal(row.textContent, "Research agentfailed");
		assert.ok(row.querySelector("svg.lucide-x.text-red-500"));
		assert.match(details.textContent!, /Ask the teacher to try this task again\./);
		if (error?.trim()) assert.ok(details.textContent!.includes(error));
		assert.equal(details.querySelectorAll("script, button, a").length, 0);
		assert.equal(document.querySelector('[data-testid="dispatch-status"]')!.textContent, "Research agent failed.");
	}
	for (const record of [job, { ...job, status: "done" } as JobRecord, { ...job, delivery: undefined, error: "No model configured — set up your models first (missing: cheap)" }]) {
		assert.equal(dispatch(record).querySelector('[data-testid="dispatch-failure-details"]'), null);
	}
});

test("Proposed retains one polite status node across lifecycle changes without announcing activity or elapsed updates", async () => {
	await withClient(async (root, { window, document }) => {
		const render = async (record: JobRecord | null) => {
			await act(async () => root.render(inventory(
				<JobsContext.Provider value={record ? [record] : []}>
					<DispatchCard toolCallId="dispatch-status" kind="research" />
				</JobsContext.Provider>,
			)));
		};
		await render(null);
		const status = document.querySelector('[data-testid="dispatch-status"]')!;
		assert.equal(status.getAttribute("role"), "status");
		assert.equal(status.getAttribute("aria-live"), "polite");
		assert.equal(status.getAttribute("aria-atomic"), "true");
		assert.equal(status.textContent, "Research agent dispatched.");
		const running: JobRecord = { ...job, status: "running", delivery: undefined, error: undefined };
		await render(running);
		assert.equal(status.textContent, "Research agent running.");
		const loader = document.querySelector('[data-testid="dispatch-card"] [data-working]')!;
		assert.ok(loader.closest('[aria-hidden="true"]'));
		assert.equal(status.contains(loader), false);
		const announcements: string[] = [];
		const observer = new window.MutationObserver(() => announcements.push(status.textContent!));
		observer.observe(status, { subtree: true, childList: true, characterData: true });
		try {
			for (const activity of ["Reading source", "Comparing results", "Writing brief"]) {
				await render({ ...running, activity, createdAt: "2026-10-26T00:00:00Z" });
				assert.equal(document.querySelector('[data-testid="dispatch-status"]'), status);
				assert.equal(status.textContent, "Research agent running.");
				assert.equal(document.querySelector('[data-testid="dispatch-activity-line"]')!.textContent, activity);
			}
			assert.deepEqual(announcements, []);
			for (const [record, expected] of [
				[{ ...running, status: "done" }, "Research agent finished."],
				[{ ...running, status: "error", error: "Connection timed out" }, "Research agent failed."],
				[{ ...running, status: "error", error: "No model configured — set up your models first (missing: cheap)" }, "Research agent needs model setup."],
				[{ ...running, status: "error", error: "No OpenRouter key is set — add one in Settings → Keys" }, "Research agent needs a provider key."],
				[job, "Research agent aborted by the learner."],
			] as const) {
				await render(record);
				assert.equal(document.querySelector('[data-testid="dispatch-status"]'), status);
				assert.equal(status.textContent, expected);
			}
			assert.deepEqual(announcements, [
				"Research agent finished.",
				"Research agent failed.",
				"Research agent needs model setup.",
				"Research agent needs a provider key.",
				"Research agent aborted by the learner.",
			]);
		} finally {
			observer.disconnect();
		}
	});
});
