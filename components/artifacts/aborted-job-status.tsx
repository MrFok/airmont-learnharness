import { CircleX } from "lucide-react";

export function AbortedJobStatus({ label, testid }: {
	label: string;
	testid: "dispatch-settled" | "job-aborted-badge";
}) {
	return (
		<div data-testid={testid} data-job-state="aborted" className="flex items-center gap-2 text-xs text-muted-foreground">
			<CircleX className="size-3.5" />
			<span className="font-medium uppercase tracking-wide">{label}</span>
			<span>aborted by the learner</span>
		</div>
	);
}
