export const motionTokens = {
	duration: { instant: 0, fast: 0.1, standard: 0.16 },
	ease: {
		standard: [0.22, 1, 0.36, 1],
		enter: [0.16, 1, 0.3, 1],
	},
	blur: { subtle: 2, soft: 3 },
	spring: {
		smooth: { type: "spring", stiffness: 380, damping: 40, mass: 1 },
		snappy: { type: "spring", stiffness: 550, damping: 48, mass: 0.8 },
		morph: { type: "spring", stiffness: 480, damping: 44, mass: 0.9 },
	},
} as const;
