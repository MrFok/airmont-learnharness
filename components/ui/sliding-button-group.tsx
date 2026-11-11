"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useInterfaceAnimations } from "./interface-animations";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export type SlidingOption = {
	value: string;
	label: string;
	testId?: string;
	icon?: ReactNode;
	disabled?: boolean;
};

type SlidingButtonGroupProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
	value: string;
	onValueChange: (value: string) => void;
	label: string;
	options: readonly SlidingOption[];
	orientation?: "horizontal" | "vertical";
};

export function useMotionDisabled() {
	const reduced = usePrefersReducedMotion();
	const animations = useInterfaceAnimations();
	return reduced || Boolean(animations?.paused);
}

export function useTouchPress(root: RefObject<HTMLDivElement | null>, disabled: boolean) {
	useEffect(() => {
		const element = root.current;
		if (!element || disabled) return;
		const active = new Map<number, { element: HTMLButtonElement; start: number }>();
		const pending = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
		const down = (event: PointerEvent) => {
			if (event.pointerType === "mouse" || !(event.target instanceof Element)) return;
			const button = event.target.closest("button");
			if (!button || button.disabled || button.closest("[data-motion-press-root]") !== element)
				return;
			clearTimeout(pending.get(button));
			button.classList.add("is-pressed");
			active.set(event.pointerId, { element: button, start: performance.now() });
		};
		const up = (event: PointerEvent) => {
			const press = active.get(event.pointerId);
			if (!press) return;
			active.delete(event.pointerId);
			pending.set(
				press.element,
				setTimeout(
					() => {
						press.element.classList.remove("is-pressed");
						pending.delete(press.element);
					},
					Math.max(0, 150 - (performance.now() - press.start)),
				),
			);
		};
		element.addEventListener("pointerdown", down, { passive: true });
		document.addEventListener("pointerup", up, true);
		document.addEventListener("pointercancel", up, true);
		return () => {
			element.removeEventListener("pointerdown", down);
			document.removeEventListener("pointerup", up, true);
			document.removeEventListener("pointercancel", up, true);
			for (const [button, timer] of pending) {
				clearTimeout(timer);
				button.classList.remove("is-pressed");
			}
			for (const press of active.values()) press.element.classList.remove("is-pressed");
		};
	}, [root, disabled]);
}

export function SlidingButtonGroup({
	value,
	onValueChange,
	label,
	options,
	orientation = "horizontal",
	className = "",
	onKeyDown,
	onPointerLeave,
	...attributes
}: SlidingButtonGroupProps) {
	const root = useRef<HTMLDivElement>(null);
	const pill = useRef<HTMLSpanElement>(null);
	const measure = useRef<(animate: boolean) => void>(() => {});
	const disabledMotion = useMotionDisabled();
	const tooltipId = useId();
	const tooltip = useRef<HTMLSpanElement>(null);
	const [tip, setTip] = useState<{ label: string; visible: boolean }>({
		label: "",
		visible: false,
	});
	const selected =
		options.find((option) => option.value === value && !option.disabled) ??
		options.find((option) => !option.disabled);
	const structure = JSON.stringify(
		options.map(({ value, label, disabled, icon }) => [value, label, disabled, Boolean(icon)]),
	);
	useTouchPress(root, disabledMotion);

	useLayoutEffect(() => {
		const element = root.current;
		const indicator = pill.current;
		if (!element || !indicator) return;
		let restoreFrame = 0;
		let lastGeometry = "";
		const place = (animate: boolean) => {
			const target = element.querySelector<HTMLButtonElement>(
				'[role="radio"][aria-checked="true"]',
			);
			if (!target) {
				indicator.style.opacity = "0";
				return;
			}
			const { offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height } = target;
			const geometry = `${x},${y},${width},${height}`;
			if (geometry === lastGeometry) return;
			lastGeometry = geometry;
			cancelAnimationFrame(restoreFrame);
			if (!animate) indicator.style.transition = "none";
			else indicator.style.removeProperty("transition");
			indicator.style.transform = `translate(${x}px, ${y}px)`;
			indicator.style.width = `${width}px`;
			indicator.style.height = `${height}px`;
			indicator.style.opacity = "1";
			if (!animate) {
				void indicator.offsetWidth;
				restoreFrame = requestAnimationFrame(() => indicator.style.removeProperty("transition"));
			}
		};
		measure.current = place;
		place(false);
		const observer = new ResizeObserver(() => place(false));
		observer.observe(element);
		for (const button of element.querySelectorAll('[role="radio"]')) observer.observe(button);
		const directionObserver = new MutationObserver(() => place(false));
		for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
			directionObserver.observe(ancestor, {
				attributes: true,
				attributeFilter: ["dir", "class", "style"],
			});
		}
		return () => {
			cancelAnimationFrame(restoreFrame);
			observer.disconnect();
			directionObserver.disconnect();
			measure.current = () => {};
		};
	}, [structure, orientation]);

	useLayoutEffect(() => measure.current(!disabledMotion), [value, disabledMotion]);

	useLayoutEffect(() => {
		if (!tip.visible || !tooltip.current || !root.current) return;
		const element = root.current;
		const button = Array.from(element.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
			(candidate) => candidate.getAttribute("aria-label") === tip.label,
		);
		if (!button) return;
		const tipElement = tooltip.current;
		const text = tipElement.firstElementChild as HTMLElement;
		const styles = getComputedStyle(tipElement);
		const width = Math.ceil(
			text.scrollWidth + parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight),
		);
		const bounds = element.getBoundingClientRect();
		const buttonBounds = button.getBoundingClientRect();
		const x = Math.max(
			0,
			Math.min(
				bounds.width - width,
				buttonBounds.left - bounds.left + buttonBounds.width / 2 - width / 2,
			),
		);
		if (tipElement.dataset.show !== "true") tipElement.style.transition = "none";
		tipElement.style.width = `${width}px`;
		tipElement.style.setProperty("--tt-x", `${x}px`);
		void tipElement.offsetWidth;
		tipElement.style.removeProperty("transition");
		tipElement.dataset.show = "true";
	}, [tip]);

	const hideTip = () => {
		if (tooltip.current) tooltip.current.dataset.show = "false";
		setTip((previous) => ({ ...previous, visible: false }));
	};
	const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;
		if (event.key === "Escape") {
			hideTip();
			return;
		}
		const enabled = options.filter((option) => !option.disabled);
		if (!enabled.length) return;
		const current =
			event.target instanceof HTMLButtonElement ? event.target.dataset.value : selected?.value;
		const index = Math.max(
			0,
			enabled.findIndex((option) => option.value === current),
		);
		const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
		let next: number;
		if (event.key === "Home") next = 0;
		else if (event.key === "End") next = enabled.length - 1;
		else if (orientation === "vertical" && event.key === "ArrowDown") next = index + 1;
		else if (orientation === "vertical" && event.key === "ArrowUp") next = index - 1;
		else if (orientation === "horizontal" && event.key === "ArrowRight")
			next = index + (rtl ? -1 : 1);
		else if (orientation === "horizontal" && event.key === "ArrowLeft")
			next = index + (rtl ? 1 : -1);
		else return;
		event.preventDefault();
		const option = enabled[(next + enabled.length) % enabled.length];
		if (!option) return;
		onValueChange(option.value);
		Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])
			.find((button) => button.dataset.value === option.value)
			?.focus();
	};

	return (
		<div
			{...attributes}
			ref={root}
			role="radiogroup"
			aria-label={label}
			aria-orientation={orientation}
			data-sliding-button-group
			data-orientation={orientation}
			data-motion-press-root
			data-motion-disabled={disabledMotion}
			className={`proposed-motion sliding-button-group ${className}`}
			onKeyDown={keyDown}
			onPointerLeave={(event) => {
				onPointerLeave?.(event);
				hideTip();
			}}
		>
			<span ref={pill} data-sliding-pill className="sliding-button-pill" aria-hidden />
			{options.map((option, index) => (
				<button
					key={option.value}
					type="button"
					role="radio"
					data-value={option.value}
					data-testid={option.testId}
					aria-checked={selected?.value === option.value}
					aria-label={option.label}
					aria-describedby={`${tooltipId}-${index}`}
					disabled={option.disabled}
					tabIndex={selected?.value === option.value ? 0 : -1}
					className="sliding-button-option"
					data-icon-only={Boolean(option.icon)}
					onClick={() => onValueChange(option.value)}
					onPointerEnter={(event) => {
						if (event.pointerType === "mouse" && window.matchMedia("(hover: hover)").matches)
							setTip({ label: option.label, visible: true });
					}}
					onFocus={() => {
						if (root.current?.querySelector(":focus-visible"))
							setTip({ label: option.label, visible: true });
					}}
					onBlur={hideTip}
				>
					{option.icon ?? option.label}
					<span className="motion-visually-hidden" id={`${tooltipId}-${index}`}>
						{option.label}
					</span>
				</button>
			))}
			<span ref={tooltip} className="motion-tooltip" data-show="false" aria-hidden="true">
				<span>{tip.label}</span>
			</span>
		</div>
	);
}
