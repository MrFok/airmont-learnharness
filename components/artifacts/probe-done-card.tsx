"use client";

import { ChevronRightIcon, CircleAlert, ClipboardCheckIcon, ClipboardList } from "lucide-react";
import { ToolContentResponse } from "@/components/ai-elements/message";
import { parseProbeDoneInput, type ProbeDoneResult } from "@/src/core";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";

export function ProbeDoneCard({ part }: { part: { input?: unknown; output?: unknown; state?: unknown } }) {
	const canonical = useInterfaceAnimations() !== null;
	const output = part.output as ProbeDoneResult | undefined;
	const state = typeof part.state === "string" ? part.state : "";
	const assessment = parseProbeDoneInput(part.input)?.assessment;
	const strands = assessment && Array.isArray(assessment.strands) ? assessment.strands : null;
	const rejected = Boolean(output && !output.ok) || state === "output-error";
	const writing = !output && !rejected && (state === "input-streaming" || state === "input-available");
	const recorded = output?.ok === true && strands !== null;
	const phase = rejected ? "rejected" : writing ? "writing" : recorded ? "recorded" : "unavailable";
	const status = {
		rejected: "Assessment not recorded",
		writing: "Writing the assessment…",
		recorded: "Assessment recorded",
		unavailable: "Assessment unavailable",
	}[phase];
	const Icon = recorded ? ClipboardCheckIcon : rejected ? CircleAlert : ClipboardList;
	const heading = <>
		<Icon aria-hidden="true" className="size-3.5" />
		<span className="min-w-0 truncate">{rejected ? status : "Probe assessment"}</span>
	</>;
	const content = strands && <div className="space-y-2 p-3">
		{strands.map((strand, index) => <div key={index}>
			<div data-assessment-part={canonical ? "strand-label" : undefined}>
				<ToolContentResponse className="text-sm font-medium">{strand.strand}</ToolContentResponse>
			</div>
			<div data-assessment-part={canonical ? "strand-body" : undefined}>
				<ToolContentResponse className="mt-0.5 text-sm text-muted-foreground">{strand.assessment}</ToolContentResponse>
			</div>
		</div>)}
		{assessment?.summary && <div data-assessment-part={canonical ? "summary" : undefined}>
			<ToolContentResponse className="text-sm text-muted-foreground">{assessment.summary}</ToolContentResponse>
		</div>}
	</div>;
	const attributes = {
		"data-testid": "probe-done-card",
		"data-probe-state": canonical ? phase : undefined,
		"aria-busy": canonical ? writing : undefined,
	};

	return <>
		{canonical && <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status}</span>}
		{recorded ? <details {...attributes} className="group my-3 overflow-hidden rounded-xl border bg-card/60">
			<summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
				{heading}
				<span className="ml-auto shrink-0 font-normal normal-case tracking-normal">{strands.length} strand{strands.length === 1 ? "" : "s"}</span>
				<ChevronRightIcon aria-hidden="true" className="size-3 shrink-0 opacity-50 transition-transform group-open:rotate-90" />
			</summary>
			{content}
		</details> : <div {...attributes} className="my-3 rounded-xl border bg-card/60 p-3">
			<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</div>
			{rejected ? <p className="text-sm text-muted-foreground">{output && !output.ok
				? output.error ?? "The assessment could not be recorded. Continue the session to try again."
				: "The assessment couldn’t be read. Ask the teacher to write it again."}</p>
				: writing ? <><Shimmer className="text-sm text-muted-foreground">Writing the assessment…</Shimmer>{content}</>
					: <p className="text-sm text-muted-foreground">No assessment was returned. Ask the teacher to write it again.</p>}
		</div>}
	</>;
}
