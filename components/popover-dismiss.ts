import { useEffect, type RefObject } from "react";

/** Dismiss on outside pointerdown or Escape; Proposed's portaled child menus retain their parent panel. */
export function usePopoverDismiss(
	rootRef: RefObject<HTMLElement | null>,
	open: boolean,
	close: () => void,
): void {
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			if (e.target instanceof Element && e.target.closest("[data-proposed-dropdown]")) return;
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// Claim the Esc (keyboard wave A): the window-level dismiss
				// chain must not ALSO stop dictation / abort a turn under
				// this popover. Popovers are the chain's topmost layer.
				e.stopPropagation();
				close();
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open, close, rootRef]);
}
