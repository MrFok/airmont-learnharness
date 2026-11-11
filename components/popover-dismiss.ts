import { useEffect, type RefObject } from "react";
import { useInteractionLayer, useInteractionLayers } from "./interaction-layers";

/** Dismiss on outside pointerdown or Escape; Proposed's portaled child menus retain their parent panel. */
export function usePopoverDismiss(
	rootRef: RefObject<HTMLElement | null>,
	open: boolean,
	close: () => void,
	options?: { layerRootRef?: RefObject<HTMLElement | null>; ownerId?: string },
) {
	const controller = useInteractionLayers();
	const panel = options?.layerRootRef ?? rootRef;
	const layer = useInteractionLayer({ kind: "popup", enabled: open, rootRef: panel, anchorRef: rootRef, ownerId: options?.ownerId,
		onClose: () => { close(); return "closed"; } });
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			if (!controller.isElementEligible(panel.current)) return;
			if (e.target instanceof Element && e.target.closest("[data-proposed-dropdown]")) return;
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [open, close, rootRef, panel, controller]);
	return layer;
}
