"use client";

import { CircleAlert, ClipboardCheckIcon, ClipboardList } from "lucide-react";
import { parseProbeDoneInput, type ProbeDoneResult } from "@/src/core";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";

/** The assessment belongs to the tool input; output only acknowledges or refuses recording it. */
export function ProbeDoneCard({ part }: { part: { input?: unknown; output?: unknown; state?: unknown } }) {
	const proposed = useInterfaceAnimations() !== null;
	const output = part.output as ProbeDoneResult | undefined;
	const state = typeof part.state === "string" ? part.state : "";

	const input = parseProbeDoneInput(part.input);
	const assessment = input?.assessment;
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
	const Icon = phase === "recorded" ? ClipboardCheckIcon : phase === "rejected" ? CircleAlert : ClipboardList;

	return (
		<>
		{proposed && <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status}</span>}
		<div
			data-testid="probe-done-card"
			data-probe-state={proposed ? phase : undefined}
			aria-busy={proposed ? writing : undefined}
			className="my-3 rounded-xl border bg-card/60 p-3"
		>
			<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{proposed ? <Icon aria-hidden="true" className="size-3.5" /> : <ClipboardCheckIcon className="size-3.5 text-primary" />}
				{proposed ? rejected ? "Assessment not recorded" : "Your assessment" : "Probe concluded — your assessment"}
			</div>
			{proposed && writing && <Shimmer className="text-sm text-muted-foreground">Writing the assessment…</Shimmer>}
			{output && !output.ok ? (
				<p className="text-sm text-muted-foreground">{proposed ? output.error ?? "The assessment could not be recorded. Continue the session to try again." : <>The prober retried: {output.error}</>}</p>
			) : state === "output-error" ? (
				<p className="text-sm text-muted-foreground">
					{proposed ? "The assessment couldn’t be read. Ask the teacher to write it again." : "The assessment was malformed — the prober retried with a corrected one."}
				</p>
			) : strands ? (
				<div className="space-y-2">
					{strands.map((s, i) => (
						<div key={i} className="rounded-lg bg-background/60 px-3 py-2">
							<div data-assessment-part={proposed ? "strand-label" : undefined} className="text-sm font-medium">{s.strand}</div>
							<div data-assessment-part={proposed ? "strand-body" : undefined} className="mt-0.5 text-sm text-muted-foreground">{s.assessment}</div>
						</div>
					))}
					{assessment?.summary && (
						<p data-assessment-part={proposed ? "summary" : undefined} className="px-1 text-sm text-muted-foreground">{assessment.summary}</p>
					)}
				</div>
			) : proposed ? (
				!writing && <p className="text-sm text-muted-foreground">No assessment was returned. Ask the teacher to write it again.</p>
			) : (
				<p className="text-sm text-muted-foreground">Writing the assessment…</p>
			)}
		</div>
		</>
	);
}
