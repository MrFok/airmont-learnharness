"use client";

import type { TextShimmerProps } from "@/components/ai-elements/shimmer";

export function ThinkingHighlight({ children, as: Component = "p", className }: TextShimmerProps) {
	return (
		<Component className={`proposed-thinking-highlight ${className ?? ""}`} data-proposed-thinking>
			{children}
		</Component>
	);
}
