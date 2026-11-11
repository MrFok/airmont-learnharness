"use client";

import { createContext, useContext, type ComponentType } from "react";
import type { TextShimmerProps } from "@/components/ai-elements/shimmer";

export interface LoadingIndicatorProps {
	className?: string;
	label?: string;
}

export interface InterfaceAnimations {
	paused?: boolean;
	LoadingIndicator: ComponentType<LoadingIndicatorProps>;
	ThinkingText: ComponentType<TextShimmerProps>;
}

export const InterfaceAnimationsContext = createContext<InterfaceAnimations | null>(null);

export function useInterfaceAnimations() {
	return useContext(InterfaceAnimationsContext);
}
