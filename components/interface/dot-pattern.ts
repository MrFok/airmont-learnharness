export const STEP_COUNT = 24;
export const CYCLE_MS = 1650;
export const RING_PATH = [1, 2, 3, 9, 14, 19, 23, 22, 21, 15, 10, 5] as const;
const COMET_TAIL = [1, 0.78, 0.56, 0.36, 0.22] as const;

export function isWithinCircularMask(row: number, col: number) {
	return Math.hypot(row - 2, col - 2) <= 2.5;
}

export function dotOpacity(index: number, step: number, idle = false) {
	const pathOrder = RING_PATH.indexOf(index as (typeof RING_PATH)[number]);
	if (pathOrder === -1) return index === 12 ? 0.16 : 0.08;
	if (idle) return 0.2 + (pathOrder / (RING_PATH.length - 1)) * 0.56;
	const leadA = Math.floor((step / STEP_COUNT) * RING_PATH.length) % RING_PATH.length;
	const leadB = (leadA + RING_PATH.length / 2) % RING_PATH.length;
	let opacity = 0.08;
	for (let i = 0; i < COMET_TAIL.length; i += 1) {
		const weight = COMET_TAIL[i] ?? 0;
		if (pathOrder === (leadA - i + RING_PATH.length) % RING_PATH.length) opacity = Math.max(opacity, weight);
		if (pathOrder === (leadB - i + RING_PATH.length) % RING_PATH.length)
			opacity = Math.max(opacity, weight * 0.72);
	}
	return Math.min(1, opacity);
}
