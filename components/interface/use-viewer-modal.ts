"use client";

import { useEffect, useEffectEvent, useRef } from "react";

const activeViewers: HTMLElement[] = [];
const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], iframe, [tabindex]:not([tabindex="-1"])';

export function useViewerModal(onClose: () => void) {
	const root = useRef<HTMLDivElement>(null);
	const close = useEffectEvent(onClose);
	useEffect(() => {
		const dialog = root.current;
		if (!dialog || dialog.closest("[data-preview-modal]")) return;
		const previous = document.activeElement;
		const background = new Map<HTMLElement, boolean>();
		for (let branch: HTMLElement = dialog; branch.parentElement; branch = branch.parentElement) {
			for (const sibling of branch.parentElement.children) {
				if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
				background.set(sibling, sibling.inert);
				sibling.inert = true;
			}
			if (branch.parentElement === document.body) break;
		}
		activeViewers.push(dialog);
		const childMenus = () => [...document.querySelectorAll<HTMLElement>("[data-proposed-dropdown]")]
			.filter((menu) => menu.getClientRects().length > 0 && !menu.closest("[inert]"));
		const controls = () => [dialog, ...childMenus().filter((menu) => !dialog.contains(menu))]
			.flatMap((scope) => [...scope.querySelectorAll<HTMLElement>(focusable)])
			.filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest("[inert]"));
		(controls()[0] ?? dialog).focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (activeViewers.at(-1) !== dialog || dialog.closest("[inert]")) return;
			const target = event.target instanceof Element ? event.target : null;
			const childMenu = target?.closest("[data-proposed-dropdown]");
			if (childMenu && (event.key === "Escape" || childMenu.matches('[role="menu"]'))) return;
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopImmediatePropagation();
				close();
				return;
			}
			if (event.key !== "Tab") return;
			const items = controls();
			const edge = event.shiftKey ? items[0] : items.at(-1);
			const inside = dialog.contains(document.activeElement) || childMenus().some((menu) => menu.contains(document.activeElement));
			if (items.length && inside && document.activeElement !== edge) return;
			event.preventDefault();
			(event.shiftKey ? items.at(-1) ?? dialog : items[0] ?? dialog).focus();
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => {
			window.removeEventListener("keydown", onKeyDown, true);
			activeViewers.splice(activeViewers.indexOf(dialog), 1);
			background.forEach((inert, element) => { element.inert = inert; });
			if (previous instanceof HTMLElement && previous.isConnected && !previous.closest("[inert]")) previous.focus();
		};
	}, []);
	return root;
}
