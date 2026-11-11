"use client";

import { useContext } from "react";
import { CheckIcon, SettingsIcon, XIcon } from "lucide-react";
import { JobsContext } from "@/components/jobs-context";
import { ChatActionsContext } from "@/components/chat";
import { isModelsRefusal, isProviderKeyRefusal, type JobKind, type JobRecord } from "@/src/core";
import { BrailleSpinner } from "@/components/braille-spinner";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";
import { AbortedJobStatus } from "./aborted-job-status";

/**
 * The dispatch card (contracts.ts "THE ASYNC PROTOCOL" §4): the tool-call
 * box for a background sub-agent. The tool part's output is the FIRE-AND-
 * FORGET ACK (a string) — never the result. Live status comes from the
 * chat-view jobs feed via JobsContext, matched by toolCallId:
 *
 *   job unknown → "dispatched" pulse (the jobs feed hasn't seen it yet)
 *   running     → live activity card (activity line + elapsed)
 *   done/error  → quiet one-liner ("finished" / "failed") — the artifact
 *                 itself arrives in the steer message right below, so the
 *                 box must not duplicate it.
 */
const KIND_LABEL: Record<JobKind, string> = {
	research: "Research agent",
	demo: "Demo agent",
	visual: "Figure agent",
	pdf: "PDF reader",
	plugin: "Plugin worker",
};

function dispatchState(job: JobRecord | null, proposed: boolean) {
	if (proposed && job?.delivery?.kind === "abort") return "aborted by the learner";
	if (!job) return "dispatched";
	if (job.status === "running") return "running";
	if (isModelsRefusal(job.error)) return "needs model setup";
	if (isProviderKeyRefusal(job.error)) return "needs a provider key";
	return job.status === "error" ? "failed" : "finished";
}

export function DispatchCard({ toolCallId, kind }: { toolCallId: string; kind: JobKind }) {
	const jobs = useContext(JobsContext);
	const proposed = useInterfaceAnimations() !== null;
	const job = jobs.find((j) => j.toolCallId === toolCallId) ?? null;
	const label = kind === "plugin" ? job?.plugin?.label || job?.plugin?.toolName || KIND_LABEL.plugin : KIND_LABEL[kind];
	const state = dispatchState(job, proposed);
	const body = <DispatchCardBody job={job} label={label} state={state} proposed={proposed} />;
	return proposed ? (
		<>
			<span data-testid="dispatch-status" className="sr-only" role="status" aria-live="polite" aria-atomic="true">
				{label} {state}.
			</span>
			{body}
		</>
	) : body;
}

function DispatchCardBody({ job, label, state, proposed }: {
	job: JobRecord | null;
	label: string;
	state: ReturnType<typeof dispatchState>;
	proposed: boolean;
}) {
	if (state === "aborted by the learner") {
		return <AbortedJobStatus label={label} testid="dispatch-settled" />;
	}
	if (state === "dispatched" || state === "running") {
		return <DispatchActivityCard job={job} label={label} proposed={proposed} />;
	}
	if (state === "needs model setup") {
		return <DispatchRefusedCard label={label} line="needs model setup" button="Set up models" />;
	}
	if (state === "needs a provider key") {
		return <DispatchRefusedCard label={label} line="needs a provider key" button="Add a key" />;
	}
	const failed = state === "failed";
	const row = (
		<div
			className="flex items-center gap-2 text-xs text-muted-foreground"
			data-testid="dispatch-settled"
		>
			{failed ? <XIcon className="size-3.5 text-error" /> : <CheckIcon className="size-3.5" />}
			<span className="font-medium uppercase tracking-wide">{label}</span>
			<span>{failed ? "failed" : "finished"}</span>
		</div>
	);
	return proposed && failed ? (
		<>
			{row}
			<div data-testid="dispatch-failure-details" className="mt-1 space-y-1 text-sm text-muted-foreground">
				{job?.error?.trim() && <p className="whitespace-pre-wrap break-words">{job.error}</p>}
				<p>Ask the teacher to try this task again.</p>
			</div>
		</>
	) : row;
}

/** The refused card: quiet info tone — nothing red, nothing "failed". */
function DispatchRefusedCard({ label, line, button }: { label: string; line: string; button: string }) {
	const ctx = useContext(ChatActionsContext);
	return (
		<div
			className="flex items-center gap-2 text-xs text-muted-foreground"
			data-testid="dispatch-refused"
		>
			<SettingsIcon className="size-3.5" />
			<span className="font-medium uppercase tracking-wide">{label}</span>
			<span>{line}</span>
			{ctx && (
				<button
					type="button"
					data-testid="dispatch-setup-link"
					onClick={ctx.openSetup}
					className="ml-1 rounded-sm border border-border bg-card px-2 py-0.5 font-ui normal-case tracking-normal text-foreground transition-colors hover:border-muted-foreground/50"
				>
					{button}
				</button>
			)}
		</div>
	);
}

function DispatchActivityCard({ job, label, proposed }: { job: JobRecord | null; label: string; proposed: boolean }) {
	// Elapsed from createdAt — jobs appear here only via the jobs feed (post-mount),
	// so no SSR/hydration mismatch.
	const elapsed =
		job && job.createdAt ? Math.max(0, Math.round((Date.now() - Date.parse(job.createdAt)) / 1000)) : null;
	return (
		<div
			className="rounded-xl border bg-card p-4 text-card-foreground"
			data-testid="dispatch-card"
		>
			<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{proposed ? <span aria-hidden="true"><BrailleSpinner label={`${label} running`} /></span> : <BrailleSpinner label={`${label} running`} />}
				{label}
				{elapsed !== null && <span className="font-normal">· {elapsed}s</span>}
			</div>
			{job?.activity && (
				<div className="mt-1 truncate text-sm text-muted-foreground" data-testid="dispatch-activity-line">
					{job.activity}
				</div>
			)}
			{!job && (
				<div className="mt-1 text-sm text-muted-foreground" data-testid="dispatch-pending">
					Dispatched…
				</div>
			)}
		</div>
	);
}
