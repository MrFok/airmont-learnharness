import assert from "node:assert/strict";
import { test } from "node:test";
import type { Agent, AgentEvent } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxText, fauxThinking, fauxToolCall } from "@earendil-works/pi-ai";
import { SessionModel } from "../components/session-core.ts";
import { runPiTurn } from "../src/server/pi/ui-stream.ts";
import type { LhMessage } from "../src/core/native-messages.ts";

const message = (content: Parameters<typeof fauxAssistantMessage>[0]) => fauxAssistantMessage(content);

function update(partial: ReturnType<typeof fauxAssistantMessage>, type: string, contentIndex: number): AgentEvent {
	return {
		type: "message_update", message: partial,
		assistantMessageEvent: { type, contentIndex, partial, delta: "", content: "", toolCall: partial.content[contentIndex] },
	} as AgentEvent;
}

function streamHarness() {
	let emit: (event: AgentEvent) => void = () => { throw new Error("not subscribed"); };
	let finish: () => void = () => {};
	const gate = new Promise<void>(resolve => { finish = resolve; });
	const agent = {
		state: { messages: [] },
		subscribe(callback: (event: AgentEvent) => void) { emit = callback; return () => {}; },
		continue: () => gate,
		abort() {},
	} as unknown as Agent;
	const handle = runPiTurn({ agent, onFinish() {} });
	return {
		handle,
		emit: (event: AgentEvent) => emit(event),
		finish() { emit({ type: "agent_end", messages: [] }); finish(); },
	};
}

const framesOf = (wire: string): Record<string, unknown>[] => wire.split("\n\n").filter(frame => frame.startsWith("data: ") && !frame.includes("[DONE]")).map(frame => JSON.parse(frame.slice(6)));

test("coalescing and reattachment preserve active-block snapshots without duplicating the partial payload", async () => {
	const harness = streamHarness();
	const live = new Response(harness.handle.subscribe()).text();
	const first = message([fauxThinking("Reasoning"), fauxText("An unfinished answer")]);
	harness.emit({ type: "message_start", message: first });
	harness.emit(update(first, "thinking_start", 0));
	harness.emit(update(first, "text_start", 1));
	harness.emit(update(first, "thinking_end", 0));
	const replay = new Response(harness.handle.subscribe()).text();
	harness.emit({ type: "message_end", message: first });
	harness.finish();
	const wires = await Promise.all([live, replay]);
	assert.equal(framesOf(wires[0]!).filter(event => event.type === "message_update").length, 1);
	for (const wire of wires) {
		const updates = framesOf(wire).filter(event => event.type === "message_update");
		assert.ok(updates.length > 0);
		assert.ok(updates.every(event => JSON.stringify(event.streamingContentIndices) === "[1]"));
		assert.ok(!wire.includes("assistantMessageEvent"));
		assert.ok(wire.endsWith("data: [DONE]\n\n"));
	}
});

test("provider block completion reaches text, reasoning, and send_to_user before the message ends", async () => {
	const harness = streamHarness();
	const snapshots: Array<Array<{ type: string; text?: string; state?: string }>> = [];
	const model = new SessionModel({
		chatId: "scripted-content",
		initialMessages: [],
		fetch: async () => new Response(harness.handle.subscribe()),
		onChange: () => snapshots.push(model.getState().messages.flatMap(row => row.parts).filter(part => part.type === "text" || part.type === "reasoning")),
	});
	const consume = model.resumeStream(false);
	await Promise.resolve();
	const partial = message([
		fauxThinking("Reasoning"),
		fauxText("Visible text"),
		fauxToolCall("send_to_user", { message: "Tool prose" }, { id: "send-1" }),
	]);
	harness.emit({ type: "message_start", message: partial });
	for (const [type, index] of [["thinking_start", 0], ["thinking_end", 0], ["text_start", 1], ["text_end", 1], ["toolcall_start", 2], ["toolcall_end", 2]] as const) {
		harness.emit(update(partial, type, index));
		harness.emit({ type: "turn_start" });
	}
	harness.emit({ type: "message_end", message: partial });
	const next = message([fauxText("Next step")]);
	harness.emit({ type: "message_start", message: next });
	harness.emit(update(next, "text_start", 0));
	harness.emit({ type: "turn_start" });
	harness.emit({ type: "message_end", message: next });
	harness.finish();
	await consume;
	for (const text of ["Reasoning", "Visible text", "Tool prose", "Next step"]) {
		assert.ok(snapshots.some(parts => parts.some(part => part.text === text && part.state === "streaming")), `${text} becomes live`);
		assert.ok(snapshots.some(parts => parts.some(part => part.text === text && part.state === "done")), `${text} settles`);
	}
	const nextLive = snapshots.find(parts => parts.some(part => part.text === "Next step" && part.state === "streaming"))!;
	assert.ok(nextLive.filter(part => part.text !== "Next step").every(part => part.state === "done"));
	assert.equal(model.status, "ready");
	assert.ok(model.getState().messages.flatMap(row => row.parts).filter(part => part.text).every(part => part.state === "done"));
	assert.ok(!JSON.stringify(model.getState().nativeMessages).includes("streamingContentIndices"));
});

test("live snapshots retain the 100 ms window and boundaries flush without waiting", async context => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const harness = streamHarness();
	const reader = harness.handle.subscribe().getReader();
	try {
		const first = message([fauxText("First")]);
		harness.emit({ type: "message_start", message: first });
		await reader.read();
		harness.emit(update(first, "text_start", 0));
		const latest = message([fauxText("First and latest")]);
		harness.emit(update(latest, "text_delta", 0));
		let delivered = false;
		const next = reader.read().then(result => { delivered = true; return result; });
		context.mock.timers.tick(99);
		await Promise.resolve();
		assert.equal(delivered, false);
		context.mock.timers.tick(1);
		const frame = new TextDecoder().decode((await next).value);
		assert.ok(frame.includes("First and latest"));
		assert.deepEqual(framesOf(frame)[0]!.streamingContentIndices, [0]);
		harness.emit(update(latest, "text_end", 0));
		harness.emit({ type: "message_end", message: latest });
		const flushed = new TextDecoder().decode((await reader.read()).value);
		assert.deepEqual(framesOf(flushed)[0]!.streamingContentIndices, []);
		assert.equal(framesOf(new TextDecoder().decode((await reader.read()).value))[0]!.type, "message_end");
	} finally {
		harness.finish();
		await reader.cancel();
		context.mock.timers.reset();
	}
});

test("non-tail reasoning updates, aborted messages, and record reload retain correct content states", async () => {
	for (const stopReason of ["stop", "aborted", "error"] as const) {
		const partial = message([fauxThinking("Trailing reasoning"), fauxText("Earlier text")]);
		const final = { ...partial, stopReason };
		const events = [
			{ type: "message_start", message: partial },
			{ type: "message_update", message: partial, streamingContentIndices: [0] },
			{ type: "message_update", message: partial, streamingContentIndices: [] },
			{ type: "message_end", message: final },
		];
		const states: Array<Record<string, string | undefined>> = [];
		const model = new SessionModel({
			chatId: "termination",
			initialMessages: [],
			fetch: async () => new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n"),
			onChange: () => states.push(Object.fromEntries(model.getState().messages.flatMap(row => row.parts).filter(part => part.text).map(part => [part.text, part.state]))),
		});
		await model.resumeStream(false);
		assert.ok(states.some(state => state["Trailing reasoning"] === "streaming" && state["Earlier text"] === "done"));
		assert.ok(model.getState().messages.flatMap(row => row.parts).filter(part => part.text).every(part => part.state === "done"));
		const restored = new SessionModel({ chatId: "restored", initialMessages: model.getState().nativeMessages as LhMessage[] });
		assert.ok(restored.getState().messages.flatMap(row => row.parts).filter(part => part.text).every(part => part.state === "done"));
	}
});
