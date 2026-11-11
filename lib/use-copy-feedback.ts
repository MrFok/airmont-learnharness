"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CopyState = "idle" | "copied" | "error";

export async function writeClipboardText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {}
	if (typeof document === "undefined") return false;
	const previousFocus = document.activeElement as HTMLElement | null;
	let textarea: HTMLTextAreaElement | undefined;
	try {
		textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.setAttribute("readonly", "");
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		document.body.appendChild(textarea);
		textarea.select();
		return document.execCommand("copy") === true;
	} catch {
		return false;
	} finally {
		try {
			textarea?.remove();
			previousFocus?.focus({ preventScroll: true });
		} catch {}
	}
}

export function useCopyFeedback() {
	const [state, setState] = useState<CopyState>("idle");
	const mounted = useRef(false);
	const request = useRef(0);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			request.current += 1;
			clearTimeout(timer.current);
		};
	}, []);
	const copy = useCallback(async (value: string | (() => string)): Promise<boolean> => {
		const current = ++request.current;
		clearTimeout(timer.current);
		if (mounted.current) setState("idle");
		let copied = false;
		try {
			copied = await writeClipboardText(typeof value === "function" ? value() : value);
		} catch {}
		if (!mounted.current || current !== request.current) return false;
		setState(copied ? "copied" : "error");
		timer.current = setTimeout(() => {
			if (mounted.current && current === request.current) setState("idle");
		}, 1500);
		return copied;
	}, []);
	return { state, copy };
}
