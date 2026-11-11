const METER_FLOOR_DB = -50;
const METER_CEILING_DB = -10;
export const METER_TICK_MS = 60;
export const METER_CELLS = 48;

export function rmsToMeter(rms: number): number {
	if (!Number.isFinite(rms) || rms <= 0) return 0;
	const db = 20 * Math.log10(rms);
	return Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / (METER_CEILING_DB - METER_FLOOR_DB)));
}

export function meterLevelHeight(level: number, peakHeight = 16): number {
	if (!Number.isFinite(level)) return 0;
	return Math.round(Math.max(0, Math.min(1, level)) * peakHeight);
}
