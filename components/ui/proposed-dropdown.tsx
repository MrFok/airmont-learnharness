"use client";

import { Children, Fragment, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, PointerEvent, ReactNode, RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";
import { motionTokens } from "@/lib/motion-tokens";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

type Highlight = { top: number; height: number; danger: boolean; glide: boolean };
const rowSelector = 'button:not(:disabled), [role="menuitem"]:not([data-disabled]), [role="menuitemradio"]:not([data-disabled])';

export function useDropdownInstant() {
	const reduced = usePrefersReducedMotion();
	const animations = useInterfaceAnimations();
	return Boolean(reduced || animations?.paused);
}

export function MotionTriggerLabel({ text }: { text: string }) {
	const instant = useDropdownInstant();
	const measure = useRef<HTMLSpanElement>(null);
	const measuredText = useRef<string | null>(null);
	const [size, setSize] = useState<{ width: number | "auto"; animate: boolean }>({ width: "auto", animate: false });
	useLayoutEffect(() => {
		const node = measure.current;
		if (!node) return;
		const update = () => {
			const current = node.textContent;
			const animate = measuredText.current !== null && measuredText.current !== current;
			measuredText.current = current;
			const width = Math.ceil(node.getBoundingClientRect().width);
			setSize((previous) => previous.width === width && !animate ? previous : { width, animate });
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(node);
		return () => observer.disconnect();
	}, [instant, text]);
	if (instant) return <span className="proposed-dropdown-label"><span ref={measure} className="proposed-dropdown-label-measure" aria-hidden="true">{text}</span><span className="proposed-dropdown-label-text">{text}</span></span>;
	return (
		<motion.span className="proposed-dropdown-label" initial={false} animate={{ width: size.width }} transition={size.animate ? motionTokens.spring.morph : { duration: 0 }}>
			<span className="sr-only">{text}</span>
			<span ref={measure} className="proposed-dropdown-label-measure" aria-hidden="true">{text}</span>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span key={text} className="proposed-dropdown-label-text" aria-hidden="true" initial={{ opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }} transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}>{text}</motion.span>
			</AnimatePresence>
		</motion.span>
	);
}

export function useMovingMenuHighlight(ref: RefObject<HTMLDivElement | null>, enabled = true) {
	const instant = useDropdownInstant();
	const [highlight, setHighlight] = useState<Highlight | null>(null);
	const pointer = useRef(false);
	const activeRow = useRef<HTMLElement | null>(null);
	const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const clear = useCallback(() => {
		if (clearTimer.current !== null) clearTimeout(clearTimer.current);
		clearTimer.current = null;
	}, []);
	const place = useCallback((item: HTMLElement | null) => {
		clear();
		const container = ref.current;
		if (!enabled || !container) return;
		if (!item || !container.contains(item)) {
			clearTimer.current = setTimeout(() => {
				activeRow.current = null;
				setHighlight(null);
			}, pointer.current ? 70 : 0);
			return;
		}
		activeRow.current = item;
		const rect = item.getBoundingClientRect();
		const top = rect.top - container.getBoundingClientRect().top - container.clientTop + container.scrollTop;
		const danger = item.dataset.tone === "danger" || item.dataset.destructive === "true";
		setHighlight((previous) => ({ top, height: rect.height, danger, glide: pointer.current && previous !== null }));
	}, [clear, enabled, ref]);
	useEffect(() => {
		if (!enabled || !ref.current) return;
		const container = ref.current;
		const sync = () => {
			const walked = container.querySelector<HTMLElement>('[data-menu-active="true"]');
			place(pointer.current ? activeRow.current : walked ?? (container.contains(document.activeElement) ? document.activeElement?.closest<HTMLElement>(rowSelector) ?? null : null));
		};
		const observer = new MutationObserver(sync);
		observer.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-menu-active"] });
		const resize = new ResizeObserver(sync);
		resize.observe(container);
		container.addEventListener("scroll", sync, true);
		return () => {
			clear();
			observer.disconnect();
			resize.disconnect();
			container.removeEventListener("scroll", sync, true);
		};
	}, [clear, enabled, place, ref]);
	const onFocus = (event: FocusEvent<HTMLDivElement>) => {
		place(event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(rowSelector) : null);
	};
	const onPointerMoveCapture = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "touch") return;
		pointer.current = true;
		place(event.target instanceof Element ? event.target.closest<HTMLElement>(rowSelector) : null);
	};
	return {
		highlight,
		instant,
		handlers: {
			onFocus,
			onPointerMoveCapture,
			onPointerLeave: () => place(null),
			onKeyDownCapture: () => { pointer.current = false; clear(); },
		},
	};
}

export function MovingMenuHighlight({ highlight, instant }: { highlight: Highlight | null; instant: boolean }) {
	if (instant) return <span className="proposed-dropdown-highlight" data-dropdown-highlight="" aria-hidden="true" data-tone={highlight?.danger ? "danger" : undefined} data-highlight-motion="instant" style={{ transform: `translateY(${highlight?.top ?? 0}px)`, height: highlight?.height ?? 0, opacity: highlight ? 1 : 0 }} />;
	return <motion.span className="proposed-dropdown-highlight" data-dropdown-highlight="" aria-hidden="true" data-tone={highlight?.danger ? "danger" : undefined} data-highlight-motion={highlight?.glide ? "glide" : "instant"} initial={false} animate={highlight ? { y: highlight.top, height: highlight.height, opacity: 1 } : { opacity: 0 }} transition={{ default: highlight?.glide ? motionTokens.spring.snappy : { duration: 0 }, opacity: { duration: 0.08 } }} />;
}

function DropdownSurface({ children, label }: { children: ReactNode; label?: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const { highlight, instant, handlers } = useMovingMenuHighlight(ref);
	useEffect(() => {
		window.dispatchEvent(new CustomEvent("lh:menu-open"));
		return () => { window.dispatchEvent(new CustomEvent("lh:menu-close")); };
	}, []);
	return (
		<DropdownMenu.Content ref={ref} className="proposed-dropdown-menu" data-proposed-dropdown="" data-dropdown-motion={instant ? "instant" : "animated"} aria-label={label} sideOffset={6} align="end" collisionPadding={12} loop onEscapeKeyDown={(event) => event.stopPropagation()} {...handlers}>
			<MovingMenuHighlight highlight={highlight} instant={instant} />
			{children}
		</DropdownMenu.Content>
	);
}

export interface ProposedDropdownItem {
	label: string;
	onSelect?: () => void;
	disabled?: boolean;
	icon?: ReactNode;
	destructive?: boolean;
	separatorBefore?: boolean;
}

export function ProposedDropdown({ label, items, icon }: { label: string; items: ProposedDropdownItem[]; icon?: ReactNode }) {
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger type="button" className="proposed-dropdown-trigger" data-dropdown-trigger="">
				{icon && <span className="proposed-dropdown-icon" aria-hidden="true">{icon}</span>}
				<MotionTriggerLabel text={label} /><ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownSurface label={label}>
					{items.map((item, index) => (
						<Fragment key={`${item.label}-${index}`}>
							{item.separatorBefore && <DropdownMenu.Separator className="proposed-dropdown-separator" />}
							<DropdownMenu.Item className="proposed-dropdown-item" data-tone={item.destructive ? "danger" : undefined} disabled={item.disabled} onSelect={item.onSelect}>
								{item.icon && <span className="proposed-dropdown-icon" aria-hidden="true">{item.icon}</span>}<span className="proposed-dropdown-item-label">{item.label}</span>
							</DropdownMenu.Item>
						</Fragment>
					))}
				</DropdownSurface>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

type SelectOption = { value: string; label: string; disabled: boolean; group?: string };

function optionText(children: ReactNode): string {
	return Children.toArray(children).map((child) => isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child)).join("");
}

function selectOptions(children: ReactNode, disabled = false, group?: string): SelectOption[] {
	return Children.toArray(children).flatMap((child): SelectOption[] => {
		if (!isValidElement<{ value?: string | number; label?: string; disabled?: boolean; children?: ReactNode }>(child)) return [];
		if (child.type === "option") {
			const text = optionText(child.props.children);
			return [{ value: String(child.props.value ?? text), label: child.props.label ?? text, disabled: disabled || Boolean(child.props.disabled), group }];
		}
		return selectOptions(child.props.children, disabled || Boolean(child.props.disabled), child.type === "optgroup" ? child.props.label : group);
	});
}

export function ProposedSelect({ value, onChange, children, ariaLabel, testid, disabled }: { value: string; onChange: (value: string) => void; children: ReactNode; ariaLabel: string; testid?: string; disabled?: boolean }) {
	const options = selectOptions(children);
	const current = options.find((option) => option.value === value)?.label ?? value;
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger type="button" className="proposed-dropdown-trigger proposed-select-trigger" aria-label={`${ariaLabel}: ${current}`} data-testid={testid} data-dropdown-trigger="" disabled={disabled}>
				<MotionTriggerLabel text={current} /><ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownSurface label={ariaLabel}>
					<DropdownMenu.RadioGroup value={value} onValueChange={onChange} aria-label={ariaLabel}>
						{options.map((option, index) => (
							<Fragment key={`${option.value}-${index}`}>
								{option.group && option.group !== options[index - 1]?.group && <DropdownMenu.Label className="proposed-dropdown-group-label">{option.group}</DropdownMenu.Label>}
								<DropdownMenu.RadioItem className="proposed-dropdown-item" value={option.value} disabled={option.disabled} textValue={option.label}>
									<span className="proposed-dropdown-item-label">{option.label}</span><DropdownMenu.ItemIndicator className="proposed-dropdown-check"><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator>
								</DropdownMenu.RadioItem>
							</Fragment>
						))}
					</DropdownMenu.RadioGroup>
				</DropdownSurface>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
