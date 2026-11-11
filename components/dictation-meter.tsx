"use client";

import { useEffect, useRef, useState } from "react";
import { METER_CELLS, METER_TICK_MS, meterLevelHeight, rmsToMeter } from "./dictation-level";
import { useInterfaceAnimations } from "./ui/interface-animations";

export function DictationMeter({ levelRef }: { levelRef: { current: number } }) {
	const proposed = useInterfaceAnimations() !== null;
	const [levels, setLevels] = useState<number[]>(() => new Array(METER_CELLS).fill(0));
	const [cellCount, setCellCount] = useState(METER_CELLS);
	const meterRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const id = setInterval(() => {
			setLevels((history) => [...history.slice(1), rmsToMeter(levelRef.current)]);
		}, METER_TICK_MS);
		return () => clearInterval(id);
	}, [levelRef]);

	useEffect(() => {
		const element = meterRef.current;
		if (!element) return;
		const fit = () => setCellCount(Math.max(8, Math.min(METER_CELLS, Math.floor(element.clientWidth / 4))));
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={meterRef}
			className="flex h-4 min-w-0 flex-1 items-center gap-[2px]"
			data-testid="dictation-meter"
			data-meter-appearance={proposed ? "proposed" : undefined}
			aria-hidden
		>
			{proposed && <span data-meter-baseline />}
			{levels.slice(-cellCount).map((level, index) => (
				<span
					key={index}
					data-meter-cell
					className="min-w-0 flex-1 rounded-[1px] bg-muted-foreground"
					style={{ height: `${meterLevelHeight(level, proposed ? 24 : 16)}px` }}
				/>
			))}
		</div>
	);
}
