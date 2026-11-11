"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, Copy } from "lucide-react";
import { blurAfterPointerClick } from "@/components/focus-hygiene";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";
import { useCopyFeedback, type CopyState } from "@/lib/use-copy-feedback";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const ease = [0.22, 1, 0.36, 1] as const;
const show = { duration: 0.16, ease };
const hide = { duration: 0.1, ease };

function FeedbackIcon({ state, instant }: { state: CopyState; instant: boolean }) {
	if (state === "error") return <CircleAlert size={16} strokeWidth={1.75} />;
	if (state !== "copied") return <Copy size={16} strokeWidth={1.75} />;
	return (
		<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
			{instant ? <path d="M4 12l5 5L20 6" /> : (
				<motion.path d="M4 12l5 5L20 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22, ease, delay: 0.04 }} />
			)}
		</svg>
	);
}

export function CopyFeedback({
	getText,
	label,
	className,
	disabled,
	onCopied,
}: {
	getText: () => string;
	label: string;
	className?: string;
	disabled?: boolean;
	onCopied?: () => void;
}) {
	const { state, copy } = useCopyFeedback();
	const reduced = usePrefersReducedMotion();
	const animations = useInterfaceAnimations();
	const instant = Boolean(reduced || animations?.paused);
	return (
		<span className={cn("proposed-copy-feedback relative inline-flex", className)}>
			<button
				type="button"
				aria-label={label}
				data-testid="md-copy"
				data-copy-state={state}
				data-copy-motion={instant ? "instant" : "animated"}
				className="proposed-copy-button"
				disabled={disabled}
				onClick={(event) => {
					blurAfterPointerClick(event);
					void copy(getText).then((copied) => {
						if (copied) onCopied?.();
					});
				}}
			>
				<span className="proposed-copy-icon" aria-hidden="true">
					{instant ? <span className="proposed-copy-icon-inner"><FeedbackIcon state={state} instant /></span> : (
						<AnimatePresence initial={false}>
							<motion.span key={state} className="proposed-copy-icon-inner" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: hide }} transition={show}>
								<FeedbackIcon state={state} instant={false} />
							</motion.span>
						</AnimatePresence>
					)}
				</span>
			</button>
			<span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
				{state === "idle" ? "" : state === "error" ? `${label}: Could not copy` : `${label}: Copied`}
			</span>
		</span>
	);
}
