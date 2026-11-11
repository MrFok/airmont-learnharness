"use client";

import { useEffect, type RefObject } from "react";
import { useInteractionLayers } from "@/components/interaction-layers";

export function useViewerFocus(root: RefObject<HTMLDivElement | null>) {
	const controller = useInteractionLayers();
	useEffect(() => {
		const view = root.current;
		if (!view || !controller.isElementEligible(view)) return;
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const close = view.querySelector<HTMLElement>('button[aria-label="Close"]');
		if (close && controller.isElementEligible(close)) close.focus({ preventScroll: true });
		return () => {
			if (!view.contains(document.activeElement) && document.activeElement !== document.body) return;
			const generation = controller.getGeneration();
			const focusRevision = controller.getFocusRevision();
			setTimeout(() => controller.restoreFocus(opener, generation, focusRevision), 0);
		};
	}, [controller, root]);
}
