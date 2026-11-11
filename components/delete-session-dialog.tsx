"use client";

import { useEffect, useId, useRef, useState } from "react";
import { InfoIcon } from "lucide-react";
import { useDialogFocus } from "@/components/settings/connection-controls";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import type { ChatDeleteMode, ChatListItem } from "@/src/core";

/** The graph-traces checkbox copy (owner, 2026-09-24 flow rework — was
 *  the delete-nodes option's body in the two-button design): the
 *  graph-touching consequence says so, shared-topic survival included.
 *  Exported pure for render pins: the copy is design, not implementation. */
export const TRACES_COPY = {
	testid: "delete-traces",
	checkbox: "delete-traces-checkbox",
	title: "Also remove its graph traces",
	body: "This session’s topics, links, and events leave the graph too. Topics other sessions or imported notes also cover survive; topics only this session created are removed entirely.",
};

export function DeleteSessionDialog({
	chat,
	onClose,
	onDeleted,
}: {
	/** The session up for deletion; null = closed. */
	chat: Pick<ChatListItem, "id" | "title"> | null;
	onClose: () => void;
	/** Success path — the sidebar owns navigation + list patching. */
	onDeleted: (id: string, mode: ChatDeleteMode, graphRevision: number) => void;
}) {
	const [traces, setTraces] = useState(false);
	const [busy, setBusy] = useState(false);
	const backdropDismiss = useBackdropDismiss(() => {
		if (!busy) onClose();
	});
	// Retry IS pressing Delete again: the mode always derives from the
	// checkbox's current state (a toggle between failure and retry is a
	// change of intent, honored as such — the checkbox is disabled while
	// busy, so no mid-flight switches).
	const [failure, setFailure] = useState<{ code: string; error: string } | null>(null);

	// Fresh state per session: closing resets, opening a new chat starts clean.
	useEffect(() => {
		if (!chat) {
			setTraces(false);
			setBusy(false);
			setFailure(null);
		}
	}, [chat]);

	// Esc closes (claimed — a menu/dialog Esc must not also abort a turn).
	useEffect(() => {
		if (!chat) return;
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
	}, [chat, onClose]);

	const run = async () => {
		if (!chat || busy) return;
		const mode: ChatDeleteMode = traces ? "delete-nodes" : "preserve-graph";
		setBusy(true);
		setFailure(null);
		try {
			const res = await fetch(`/api/chats/${chat.id}?mode=${mode}`, { method: "DELETE" });
			const body = (await res.json()) as {
				ok?: boolean;
				error?: string;
				code?: string;
				graphRevision?: number;
			};
			if (!res.ok) {
				// 409 (turn/jobs running) and 503 (extraction winding down) are
				// both retryable — keep the dialog open, show the server's line.
				setFailure({ code: body.code ?? "error", error: body.error ?? `Delete failed (${res.status})` });
				setBusy(false);
				return;
			}
			onDeleted(chat.id, mode, body.graphRevision ?? 0);
		} catch {
			setFailure({ code: "network", error: "Delete failed — network error. Try again." });
			setBusy(false);
		}
	};

	if (!chat) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
			{...backdropDismiss}
		>
			<DeleteSessionBody
				chat={chat}
				traces={traces}
				busy={busy}
				failure={failure}
				onTraces={(next) => setTraces(next)}
				onClose={onClose}
				onRun={() => void run()}
			/>
		</div>,
		document.body,
	);
}

/** The dialog's pure body — exported for SSR pins (the settings-dialog /
 *  node-dialog body pattern). The wrapper owns state + effects + portal. */
export function DeleteSessionBody({
	chat,
	traces,
	busy,
	failure,
	onTraces,
	onClose,
	onRun,
	variant,
}: {
	chat: Pick<ChatListItem, "id" | "title">;
	/** The graph-traces checkbox — unchecked by default (preserve-graph). */
	traces: boolean;
	busy: boolean;
	failure: { code: string; error: string } | null;
	onTraces: (next: boolean) => void;
	onClose: () => void;
	onRun: () => void;
	variant?: "proposed";
}) {
	const proposed = useInterfaceAnimations() !== null || variant === "proposed";
	const id = useId();
	const dialogRef = useRef<HTMLDivElement>(null);
	useDialogFocus(dialogRef, true, '[data-testid="delete-cancel"]');
	return (
		<div
			ref={dialogRef}
			tabIndex={-1}
			role="dialog"
			aria-modal="true"
			aria-labelledby={`${id}-title`}
			aria-describedby={`${id}-description`}
			data-testid="delete-session-dialog"
			data-proposed-confirmation={proposed ? "" : undefined}
			onClick={(e) => e.stopPropagation()}
			className="w-[32rem] max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-5 shadow-xl"
		>
			<h2
				id={`${id}-title`}
				data-confirmation-part={proposed ? "title" : undefined}
				className="text-sm font-semibold text-destructive"
			>
				Delete session?
			</h2>
			<div data-confirmation-part={proposed ? "subject" : undefined} className="mt-1.5">
				<code data-testid="session-name-code" className="font-mono text-sm text-foreground">
					{chat.title}
				</code>
			</div>
			<p
				id={`${id}-description`}
				data-confirmation-part={proposed ? "description" : undefined}
				className="mt-2 text-sm text-muted-foreground"
			>
				This permanently removes the session — its messages, background jobs, and extraction records.
				Everything it added to the graph stays unless you check below. This cannot be undone.
			</p>
			{proposed ? (
				<ProposedTracesOption traces={traces} busy={busy} onTraces={onTraces} />
			) : (
				<label
					data-testid={TRACES_COPY.testid}
					className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/60 px-4 py-3"
				>
					<input
						type="checkbox"
						data-testid={TRACES_COPY.checkbox}
						checked={traces}
						onChange={(e) => onTraces(e.target.checked)}
						disabled={busy}
						className="mt-0.5 size-4 shrink-0 accent-primary"
					/>
					<span className="min-w-0">
						<span className="block text-sm text-foreground">{TRACES_COPY.title}</span>
						<span className="mt-1 block text-xs text-muted-foreground">{TRACES_COPY.body}</span>
					</span>
				</label>
			)}
			{failure && (
				<div
					role="alert"
					data-testid="delete-failure"
					data-confirmation-part={proposed ? "error" : undefined}
					className="mt-3 rounded-sm border border-border/60 px-3 py-2 text-xs"
				>
					<span className="text-foreground">{failure.error}</span>
					<button
						type="button"
						data-testid="delete-retry"
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
					data-testid="delete-cancel"
					onClick={onClose}
					disabled={busy}
					className="rounded-sm px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
				>
					Cancel
				</button>
				<button
					type="button"
					data-testid="delete-confirm"
					onClick={onRun}
					disabled={busy}
					className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-40"
				>
					{busy ? "Deleting…" : "Delete"}
				</button>
			</div>
		</div>
	);
}

function ProposedTracesOption({
	traces,
	busy,
	onTraces,
}: {
	traces: boolean;
	busy: boolean;
	onTraces: (next: boolean) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const detailsId = useId();
	return (
		<div data-testid={TRACES_COPY.testid} data-confirmation-part="traces">
			<div className="proposed-traces-row">
				<label>
					<input
						type="checkbox"
						data-testid={TRACES_COPY.checkbox}
						checked={traces}
						onChange={(event) => onTraces(event.target.checked)}
						disabled={busy}
					/>
					<span>{TRACES_COPY.title}</span>
				</label>
				<button
					type="button"
					aria-label="About removing graph traces"
					aria-expanded={expanded}
					aria-controls={detailsId}
					onClick={() => setExpanded((value) => !value)}
				>
					<InfoIcon aria-hidden="true" size={16} strokeWidth={1.5} />
				</button>
			</div>
			<p id={detailsId} hidden={!expanded}>
				{TRACES_COPY.body}
			</p>
		</div>
	);
}
