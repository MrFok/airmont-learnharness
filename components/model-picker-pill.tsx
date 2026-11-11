"use client";

import type { ComponentProps, ReactNode } from "react";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";
import { MotionTriggerLabel } from "@/components/ui/proposed-dropdown";
import { cn } from "@/lib/utils";

/** The core and controlled plugin pickers share the very same trigger renderer. */
export function ModelPickerPill({ children, className, leading, muted = false, ...props }: ComponentProps<"button"> & { leading?: ReactNode; muted?: boolean }) {
	const proposed = useInterfaceAnimations() !== null;
	return <button type="button" {...props} data-dropdown-trigger={proposed ? "" : undefined}
		className={cn("model-picker-pill flex items-center gap-1.5 rounded-full bg-card/85 px-2.5 py-1 font-ui text-xs shadow-lg backdrop-blur transition-colors hover:bg-muted", className)}>
		{leading}
		<span className={cn("flex min-w-0 items-center gap-1.5", muted ? "text-muted-foreground" : "text-card-foreground")}>{proposed && typeof children === "string" ? <MotionTriggerLabel text={children} /> : children}</span>
		<span aria-hidden className="text-xs text-muted-foreground">▾</span>
	</button>;
}
