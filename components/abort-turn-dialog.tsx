"use client";

import { useId, useRef, type ReactElement, type ReactNode } from "react";
import { HostDialog } from "@/components/host-dialog";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";

/**
 * The ESC-abort guard (owner, 2026-10-02): the global Esc → abort chain
 * opens this confirm popup EVERYWHERE — mid-stream aborts and pending-
 * question dismissals alike. Esc on the popup itself cancels (claimed —
 * it must never chain into another abort), which is also why Chat's
 * abort handler ignores events while this dialog is open: two window
 * listeners fire per Esc and stopPropagation alone cannot order them.
 *
 * MINIMAL, the delete-node dialog's tone: title, one line, Cancel +
 * action. No busy state — both actions are local (a fetch that fires
 * and forgets, an answer submit whose own machinery shows progress).
 *
 * What "abort" means is mode-dependent: from a running turn it kills
 * the turn (partial stays); from a pending question there is no turn to
 * kill — abort IS dismissal (A2, 2026-10-03): the silent route writes
 * the skipped toolResult and wakes NOTHING; the session pauses until
 * the user's next plain message, which carries the dismissal to the
 * model in its context.
 */

/** What Esc is aborting — drives copy and the confirm action. */
export type AbortMode = "turn" | "question" | "problem";

const COPY: Record<AbortMode, { title: string; line: string; action: string }> = {
	turn: {
		title: "Abort this turn?",
		line: "The partial answer stays in the transcript.",
		action: "Abort",
	},
	question: {
		title: "Dismiss this question?",
		line: "Skipped — the teacher moves on without it.",
		action: "Dismiss",
	},
	problem: {
		title: "Discard this problem?",
		line: "The problem is dropped — no solution is revealed.",
		action: "Discard",
	},
};

/** The dialog's pure body — exported for SSR pins (the delete-node
 * pattern). The wrapper owns effects + the portal. */
export function AbortTurnBody({
	mode,
	onClose,
	onConfirm,
	busy = false,
	variant,
	renderFrame,
	cancelRef,
}: {
	mode: AbortMode;
	onClose: () => void;
	onConfirm: () => void;
	/** The dismiss doubles as the abort when a turn is still running
	 * (owner, 2026-10-04): the line says so. */
	busy?: boolean;
	variant?: "proposed";
	cancelRef?: React.RefObject<HTMLButtonElement | null>;
	renderFrame?: (frame: ReactElement<{ children: ReactNode }>) => ReactNode;
}) {
	const proposed = useInterfaceAnimations() !== null || variant === "proposed";
	const id = useId();
	const backdropDismiss = useBackdropDismiss(onClose);
	const copy = COPY[mode];
	const frame = (
		<div
			tabIndex={-1}
			role="dialog"
			aria-modal="true"
			aria-labelledby={`${id}-title`}
			aria-describedby={`${id}-description`}
			data-proposed-confirmation={proposed ? "" : undefined}
			className="mx-4 w-full max-w-sm rounded-xl border bg-card p-5 shadow-lg"
			onClick={(e) => e.stopPropagation()}
		>
			<h2
				id={`${id}-title`}
				data-confirmation-part={proposed ? "title" : undefined}
				className="text-sm font-semibold text-card-foreground"
				data-testid="abort-turn-title"
			>
				{copy.title}
			</h2>
			<p
				id={`${id}-description`}
				data-confirmation-part={proposed ? "description" : undefined}
				className="mt-1.5 text-xs text-muted-foreground"
				data-testid="abort-turn-line"
			>
				{proposed && mode === "question" ? "This question is skipped. The session waits for your next message." : copy.line}
				{busy && mode !== "turn" ? " The working turn stops too." : ""}
			</p>
			<div
				data-confirmation-part={proposed ? "actions" : undefined}
				className="mt-4 flex justify-end gap-2"
			>
				<button
					type="button"
					ref={cancelRef}
					data-testid="abort-turn-cancel"
					onClick={onClose}
					className="rounded-sm px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					Cancel
				</button>
				<button
					type="button"
					data-testid="abort-turn-confirm"
					onClick={onConfirm}
					// Destructive red — the app's established destructive pair.
					className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20"
				>
					{copy.action}
				</button>
			</div>
		</div>
	);
	if (renderFrame) return renderFrame(frame);
	return <div data-testid="abort-turn-dialog"
		className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
		{...backdropDismiss}>{frame}</div>;
}

export function AbortTurnDialog({
	mode,
	onClose,
	onConfirm,
	busy = false,
}: {
	/** What Esc is aborting; null = closed (nothing rendered). */
	mode: AbortMode | null;
	onClose: () => void;
	onConfirm: (mode: AbortMode) => void;
	busy?: boolean;
}) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	const proposed = useInterfaceAnimations() !== null;
	if (mode === null) return null;
	return <AbortTurnBody mode={mode} onClose={onClose} onConfirm={() => onConfirm(mode)} busy={busy} cancelRef={cancelRef}
		renderFrame={(frame) => <HostDialog open frame={frame} initialFocusRef={proposed ? cancelRef : undefined} aria-label={COPY[mode].title}
			onClose={() => { onClose(); return "closed"; }}
			backdropProps={{ className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm", "data-testid": "abort-turn-dialog" }}>
			{frame.props.children}
		</HostDialog>} />;
}
