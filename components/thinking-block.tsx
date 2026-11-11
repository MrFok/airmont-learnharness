"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { blurAfterPointerClick } from "@/components/focus-hygiene";
import { cn } from "@/lib/utils";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";

// ── The ⌘T store (module-scope, one per page load) ─────────────────────────
// null = "rows run their own defaults" (the pre-toggle state); the first ⌘T
// resolves from `true` (transcript rows default open) and then alternates.
let allUserThinkingOpen: boolean | null = null;
const userThinkingListeners = new Set<(open: boolean) => void>();

export function currentUserThinkingOpen(): boolean {
	return allUserThinkingOpen ?? true;
}

/** The row's starting state: an explicit ⌘T set wins over the row's own
 *  default (late mounts honor the last set — same path as the live sync,
 *  readable at render time so static SSR reflects the store too). */
function resolveUserThinkingOpen(defaultOpen: boolean): boolean {
	return allUserThinkingOpen ?? defaultOpen;
}

export function setAllUserThinkingOpen(open: boolean) {
	allUserThinkingOpen = open;
	for (const l of userThinkingListeners) l(open);
}

function subscribeUserThinking(fn: (open: boolean) => void): () => void {
	userThinkingListeners.add(fn);
	if (allUserThinkingOpen !== null) fn(allUserThinkingOpen); // late mounts honor the last set
	return () => userThinkingListeners.delete(fn);
}

export function ThinkingBlock({
	label = "YOUR THINKING",
	text,
	testId,
	dataCommit,
	defaultOpen = false,
	inCard = false,
	appearance,
}: {
	label?: string;
	text: string;
	testId?: string;
	/** The practice marker's register flag (commit vs nudge). */
	dataCommit?: boolean;
	/** Transcript rows arrive expanded (owner, 2026-10-07). */
	defaultOpen?: boolean;
	/** On the card's own background: no band (the accent read too light). */
	inCard?: boolean;
	appearance?: "proposed";
}) {
	const proposedAnimations = useInterfaceAnimations();
	const contentId = useId();
	const [open, setOpen] = useState(() => resolveUserThinkingOpen(defaultOpen));
	// ⌘T: an explicit global set overrides every row (once set, rows re-sync).
	const syncedRef = useRef(false);
	useEffect(
		() =>
			subscribeUserThinking((o) => {
				syncedRef.current = true;
				setOpen(o);
			}),
		[],
	);
	if (appearance === "proposed" || proposedAnimations !== null) {
		return (
			<div
				data-testid={testId}
				data-appearance="proposed"
				data-commit={dataCommit === undefined ? undefined : dataCommit ? "true" : "false"}
				className="my-2 w-full py-2"
			>
				<button
					type="button"
					data-testid={testId ? `${testId}-trigger` : undefined}
					aria-expanded={open}
					aria-controls={contentId}
					data-thinking-part="label"
					className="flex min-h-10 w-full items-center gap-2 rounded-md text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					onClick={(event) => {
						setOpen((value) => !value);
						blurAfterPointerClick(event);
					}}
				>
					<BrainIcon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
					<span className="min-w-0 flex-1">{label === "YOUR THINKING" ? "Your thinking" : label}</span>
					<ChevronDownIcon
						aria-hidden="true"
						className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
					/>
				</button>
				<p
					id={contentId}
					data-thinking-part="body"
					hidden={!open}
					className="lh-prose mt-2 whitespace-pre-wrap text-muted-foreground"
				>
					{text}
				</p>
			</div>
		);
	}
	return (
		/* The rail GROUPS and the rail IS THE MISSING CHARACTER (owner
		   rounds, 2026-10-05): the heading sits INSIDE the rail, and the
		   rail's full width (border + padding) is exactly THREE CHARACTERS of
		   the mono heading font — 'YOUR THINKING' is three chars shorter
		   than 'AGENT'S THINKING', so with the user row offset by the rail
		   and the agent row flush, the chevrons line up vertically. Three
		   (not one, owner round 5): the wider gap reads better than the
		   cramped single-char rail. The heading
		   register is the card eyebrows' small mono caps (text-xs = the
		   11px rung). */
		<div
			data-testid={testId}
			data-commit={dataCommit === undefined ? undefined : dataCommit ? "true" : "false"}
			className={cn(
				// Round five (owner, 2026-10-07): total inset still 3ch (the
				// chevron law); the rail narrows (14px gap), padding 4px, pr-4
				// keeps the text off the band's right edge. In-card rows take
				// NO band — the accent lift read too light; rail only.
				"lh-card-enter my-2 w-full border-l-[calc(3ch-14px)] border-muted-foreground/30 py-1 pl-[14px] pr-4 font-ui text-xs",
				inCard ? "" : "bg-card",
			)}
		>
			<button
				type="button"
				data-testid={testId ? `${testId}-trigger` : undefined}
				onClick={(e) => {
					setOpen((v) => !v);
					blurAfterPointerClick(e);
				}}
				aria-expanded={open}
				className="flex w-full items-center gap-2 font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
			>
				<BrainIcon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
				{label}
				<ChevronDownIcon
					className={cn("size-4 shrink-0 transition-transform", open ? "rotate-180" : "rotate-0")}
				/>
			</button>
			{open && (
				<span className="lh-prose mt-1.5 block whitespace-pre-wrap text-[15px] italic text-foreground/50">
					{text}
				</span>
			)}
		</div>
	);
}
