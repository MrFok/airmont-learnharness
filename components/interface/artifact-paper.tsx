"use client";

import type { ReactNode } from "react";
import { LhMark } from "@/components/lh-mark";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";

export const ARTIFACT_PAPER_FOOTER_HEIGHT = 52;

export function ArtifactPaper({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) {
	const canonical = useInterfaceAnimations() !== null;
	if (!canonical) return children;
	return (
		<div
			data-interface-artifact-paper
			className="overflow-hidden bg-white text-black"
			style={{
				borderRadius: 2,
				colorScheme: "light",
				fontFamily: '"Iowan Old Style", "Iowan", Georgia, serif',
				filter: inverted ? "invert(1) hue-rotate(180deg)" : undefined,
			}}
		>
			{children}
			<div className="flex justify-end px-5 pb-5 pt-2" aria-hidden="true">
				<LhMark className="size-6 shrink-0 brightness-0 opacity-45" />
			</div>
		</div>
	);
}
