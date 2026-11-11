"use client";

import { useEffect, useState } from "react";
import { useInterfaceAnimations, type LoadingIndicatorProps } from "@/components/ui/interface-animations";
import { CYCLE_MS, STEP_COUNT, dotOpacity, isWithinCircularMask } from "./dot-pattern";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export function DotmCircular3({ className, label = "Loading" }: LoadingIndicatorProps) {
	const reducedMotion = usePrefersReducedMotion();
	const animations = useInterfaceAnimations();
	const idle = reducedMotion || Boolean(animations?.paused);
	const [step, setStep] = useState(6);
	useEffect(() => {
		if (idle) return;
		const timer = window.setInterval(
			() => setStep((value) => (value + 1) % STEP_COUNT),
			CYCLE_MS / STEP_COUNT,
		);
		return () => window.clearInterval(timer);
	}, [idle]);
	return (
		<svg
			className={`h-4 w-auto shrink-0 text-foreground ${className ?? ""}`}
			viewBox="0 0 20 20"
			fill="currentColor"
			role="status"
			aria-label={label}
			data-proposed-loader="circular3"
			data-motion={idle ? "idle" : "running"}
		>
			{Array.from({ length: 25 }, (_, index) => {
				const row = Math.floor(index / 5);
				const col = index % 5;
				return isWithinCircularMask(row, col) ? (
					<circle
						key={index}
						cx={2 + col * 4}
						cy={2 + row * 4}
						r="1.2"
						opacity={dotOpacity(index, step, idle)}
					/>
				) : null;
			})}
		</svg>
	);
}
