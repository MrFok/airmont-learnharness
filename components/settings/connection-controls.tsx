"use client";
import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { ProviderMark } from "@/components/provider-mark";
import { Button } from "@/components/ui/button";

export function useDialogFocus(ref: RefObject<HTMLDivElement | null>, enabled = true, initialSelector?: string) {
	useEffect(() => {
		const dialog = ref.current;
		if (!enabled || !dialog || dialog.closest("[inert]")) return;
		const previous = document.activeElement as HTMLElement | null;
		const background = [...document.body.children].filter((element): element is HTMLElement =>
			element instanceof HTMLElement && !element.contains(dialog),
		);
		const states = background.map((element) => element.inert);
		background.forEach((element) => { element.inert = true; });
		const controls = () => [...dialog.querySelectorAll<HTMLElement>(
			'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
		)].filter((element) => element.getAttribute("tabindex") !== "-1" && !element.closest('[hidden], [inert]') && (element.getClientRects?.().length ?? 1) > 0);
		const initial = initialSelector ? dialog.querySelector<HTMLElement>(initialSelector) : null;
		(initial && !initial.matches(":disabled") ? initial : controls()[0] ?? dialog).focus();
		const key = (event: KeyboardEvent) => {
			if (event.key !== "Tab" || dialog.closest("[inert]")) return;
			const target = event.target instanceof Element ? event.target : null;
			if (target?.closest('[data-lh-menu], [data-proposed-dropdown]')) return;
			const items = controls();
			const edge = event.shiftKey ? items[0] : items.at(-1);
			if (document.activeElement === edge || !dialog.contains(document.activeElement)) {
				event.preventDefault();
				((event.shiftKey ? items.at(-1) : items[0]) ?? dialog).focus();
			}
		};
		document.addEventListener("keydown", key);
		return () => {
			document.removeEventListener("keydown", key);
			background.forEach((element, index) => { element.inert = states[index] ?? false; });
			if (previous?.isConnected && !previous.closest("[inert]")) previous.focus();
		};
	}, [enabled, initialSelector, ref]);
}

export function ConnectionRow({ label, action, disabled, onAction, children, testid, actionTestid }: { label: string; action: string; disabled: boolean; onAction: () => void; children?: React.ReactNode; testid?: string; actionTestid?: string }) {
	return <div className="settings-live-connection-row flex flex-wrap items-center gap-3" data-testid={testid}>
		<span className="flex items-center gap-2 font-ui text-xs text-foreground"><span aria-hidden="true" className="text-muted-foreground"><ProviderMark provider={label === "GitHub Copilot" ? "github-copilot" : label.toLowerCase()} /></span>{label}</span>
		{children}
		<Button type="button" size="xs" variant={action === "Connect" ? "outline" : "ghost"} className={`cursor-pointer disabled:cursor-not-allowed ${action === "Connect" ? "" : "text-muted-foreground hover:text-foreground"}`} data-testid={actionTestid} disabled={disabled} onClick={onAction}>{action}</Button>
	</div>;
}

export function ConnectionFooter({ leading, children, testid }: { leading?: React.ReactNode; children: React.ReactNode; testid?: string }) {
	return <div className="mt-4 flex flex-wrap items-center justify-between gap-3" data-testid={testid}>
		{leading}
		<div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
	</div>;
}

export function ConnectionDialog({ children, onClose, busy, label, testid, backdropTestid }: { children: React.ReactNode; onClose: () => void; busy: boolean; label: string; testid: string; backdropTestid: string }) {
	const ref = useRef<HTMLDivElement>(null), closeRef = useRef(onClose);
	closeRef.current = onClose;
	const backdropDismiss = useBackdropDismiss(() => { if (!busy) onClose(); });
	useDialogFocus(ref);
	useEffect(() => {
		const key = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			if (event.target instanceof Element && event.target.closest('[data-proposed-dropdown], [data-lh-menu]')) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			closeRef.current();
		};
		document.addEventListener("keydown", key);
		return () => document.removeEventListener("keydown", key);
	}, []);
	return createPortal(<div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80" data-testid={backdropTestid} {...backdropDismiss}>
		<div ref={ref} tabIndex={-1} data-settings-connection="" role="dialog" aria-modal="true" aria-label={label} aria-busy={busy} data-testid={testid} onClick={(event) => event.stopPropagation()} className="settings-dialog-pop mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-md border border-border bg-card p-5 shadow-xl">{children}</div>
	</div>, document.body);
}
