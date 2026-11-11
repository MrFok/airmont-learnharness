"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDialogFocus } from "@/components/settings/connection-controls";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";

/** The 409 extraction_running line (owner phrasing, node interlude):
 *  the server's error names the extraction; the ACTIVITY DOCK is the
 *  surface the user actually watches drain. Exported pure for pins. */
export const EXTRACTION_RETRY_LINE = "An extraction is running — try again when the activity dock drains.";

/**
 * Node deletion (node interlude, Platform's 50bfcba engine) — the
 * confirm surface, portaled z-50 like the session-delete dialog whose
 * tone it follows. FULL DEATH by owner ruling: the node, every edge
 * touching it, every event naming it, its position.
 *
 * MINIMAL BY OWNER RULING (2026-09-30): NO pre-flight impact read —
 * what full death takes is obvious (the edges die with the node), the
 * fetch flickered the dialog open-closed, and richer facts would only
 * grow more confusing as deletion semantics evolve (rewiring talk is
 * on the table). The screen is: title, names, one permanence line,
 * Cancel / Delete. The 409 extraction_running still gets the dock
 * phrasing with a Try-again — the run is never aborted server-side,
 * it clears on its own; other failures state themselves plainly.
 *
 * WORDING: "node"/"nodes" — THE UI word for graph objects (owner
 * ruling, same day, standardized everywhere in the UI).
 */
/** The dialog's pure body — exported for SSR pins (the settings-dialog
 *  body pattern). The wrapper owns state + effects + the portal. */
export function DeleteNodeBody({
	nodes,
	busy,
	failure,
	onClose,
	onRun,
	variant,
}: {
	/** One node (the canvas context menu) or many (the chain table's
	 *  selection). One names it alone; many pluralize the title and
	 *  list the names. */
	nodes: { id: string; name: string }[];
	busy: boolean;
	failure: { code: string; error: string } | null;
	onClose: () => void;
	onRun: () => void;
	variant?: "proposed";
}) {
	const proposed = useInterfaceAnimations() !== null || variant === "proposed";
	const id = useId();
	const dialogRef = useRef<HTMLDivElement>(null);
	useDialogFocus(dialogRef, true, '[data-testid="node-delete-cancel"]');
	return (
		<div
			ref={dialogRef}
			tabIndex={-1}
			role="dialog"
			aria-modal="true"
			aria-labelledby={`${id}-title`}
			aria-describedby={`${id}-description`}
			data-testid="delete-node-dialog"
			data-proposed-confirmation={proposed ? "" : undefined}
			onClick={(e) => e.stopPropagation()}
			className="w-[32rem] max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-5 shadow-xl"
		>
			<h2
				id={`${id}-title`}
				data-confirmation-part={proposed ? "title" : undefined}
				className="text-sm font-semibold text-destructive"
			>
				{nodes.length === 1 ? "Delete node?" : `Delete ${nodes.length} nodes?`}
			</h2>
			<div data-confirmation-part={proposed ? "subject" : undefined} className="mt-1.5">
				{nodes.length === 1 ? (
					<code data-testid="node-name-code" className="font-mono text-sm text-foreground">
						{nodes[0]?.name}
					</code>
				) : (
					<code data-testid="node-names-code" className="font-mono text-sm text-foreground">
						{nodes
							.slice(0, 8)
							.map((n) => n.name)
							.join(", ")}
						{nodes.length > 8 ? `, and ${nodes.length - 8} more` : ""}
					</code>
				)}
			</div>
			<p
				id={`${id}-description`}
				data-confirmation-part={proposed ? "description" : undefined}
				className="mt-2 text-sm text-muted-foreground"
				data-testid="node-permanence-line"
			>
				{nodes.length === 1
					? "This permanently deletes the node — this cannot be undone."
					: `This permanently deletes all ${nodes.length} nodes — this cannot be undone.`}
			</p>
			{failure && (
				<div
					role="alert"
					data-testid="node-delete-failure"
					data-confirmation-part={proposed ? "error" : undefined}
					className="mt-3 rounded-sm border border-border/60 px-3 py-2 text-xs"
				>
					<span className="text-foreground">
						{failure.code === "extraction_running" ? EXTRACTION_RETRY_LINE : failure.error}
					</span>
					<button
						type="button"
						data-testid="node-delete-retry"
						onClick={onRun}
						disabled={busy}
						className="ml-3 text-xs text-foreground underline-offset-2 hover:underline disabled:opacity-40"
					>
						Try again
					</button>
				</div>
			)}
			<div
				data-confirmation-part={proposed ? "actions" : undefined}
				className="mt-4 flex justify-end gap-2"
			>
				<button
					type="button"
					data-testid="node-delete-cancel"
					onClick={onClose}
					disabled={busy}
					className="rounded-sm px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
				>
					Cancel
				</button>
				<button
					type="button"
					data-testid="node-delete-confirm"
					onClick={onRun}
					disabled={busy}
					// Destructive red (owner, polish round) — the
					// app's established destructive pair (chat's
					// refusal banner): border + text, fill on hover.
					className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-40"
				>
					{busy ? "Deleting…" : "Delete"}
				</button>
			</div>
		</div>
	);
}

export function DeleteNodeDialog({
	nodes,
	onClose,
	onDeleted,
}: {
	/** The nodes up for deletion; null/empty = closed. One (the canvas
	 *  context menu) or many (the chain table's selection). Names from
	 *  the client's snapshot — what the user sees is what the dialog
	 *  names. */
	nodes: { id: string; name: string }[] | null;
	onClose: () => void;
	/** Success path — the callers announce lh:graph-revision so the
	 *  snapshot refetches. The deleted ids ride along so
	 *  selection-side callers can prune. */
	onDeleted: (nodeIds: string[], graphRevision: number) => void;
}) {
	const [busy, setBusy] = useState(false);
	const backdropDismiss = useBackdropDismiss(() => {
		if (!busy) onClose();
	});
	const [failure, setFailure] = useState<{ code: string; error: string } | null>(null);

	// Fresh state per dialog: closing resets.
	useEffect(() => {
		if (!nodes || nodes.length === 0) {
			setBusy(false);
			setFailure(null);
		}
	}, [nodes]);

	// Esc closes (claimed — a dialog Esc must not also abort a turn).
	useEffect(() => {
		if (!nodes || nodes.length === 0) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// THE ONE-ESC LAW (keyboard round 2026-10-06): claim at the
				// document level — a window-level stopPropagation cannot stop
				// the earlier-registered global window listener.
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [nodes, onClose]);

	// Sequential full deaths — never parallel (the store's revision
	// counter and the sweep must observe them in order). A failure STOPS
	// the run: what died, died; the failure line names why the rest
	// still stands (extraction_running especially must not be plowed
	// through). onDeleted fires with everything that actually died.
	const run = async () => {
		if (!nodes || nodes.length === 0 || busy) return;
		setBusy(true);
		setFailure(null);
		const dead: string[] = [];
		let revision = 0;
		try {
			for (const n of nodes) {
				const res = await fetch(`/api/graph/nodes/${encodeURIComponent(n.id)}`, { method: "DELETE" });
				const body = (await res.json()) as {
					error?: string;
					code?: string;
					graphRevision?: number;
				};
				if (!res.ok) {
					setFailure({ code: body.code ?? "error", error: body.error ?? `Delete failed (${res.status})` });
					setBusy(false);
					if (dead.length > 0) onDeleted(dead, revision);
					return;
				}
				dead.push(n.id);
				revision = body.graphRevision ?? revision;
			}
			onDeleted(dead, revision);
		} catch {
			setFailure({ code: "network", error: "Delete failed — network error. Try again." });
			setBusy(false);
			if (dead.length > 0) onDeleted(dead, revision);
		}
	};

	if (!nodes || nodes.length === 0) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
			{...backdropDismiss}
		>
			<DeleteNodeBody
				nodes={nodes}
				busy={busy}
				failure={failure}
				onClose={onClose}
				onRun={() => void run()}
			/>
		</div>,
		document.body,
	);
}
