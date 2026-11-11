"use client";

import type { ReactNode } from "react";
import { InterfaceAnimationsContext } from "@/components/ui/interface-animations";
import { DotmCircular3 } from "./dotm-circular3";
import { ThinkingHighlight } from "./thinking-highlight";

const animations = { LoadingIndicator: DotmCircular3, ThinkingText: ThinkingHighlight };

export function DesignProvider({ children }: { children: ReactNode }) {
	return <InterfaceAnimationsContext value={animations}>{children}</InterfaceAnimationsContext>;
}
