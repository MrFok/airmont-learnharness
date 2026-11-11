export function ViewerStyles() {
	return (
		<style href="learnharness-viewers" precedence="interface">
			{`
[data-interface-viewer] button {
	min-inline-size: 2.5rem;
	min-block-size: 2.5rem;
	border: 0;
	border-radius: .5rem;
}
[data-interface-viewer] button:focus-visible {
	outline: 2px solid var(--ring);
	outline-offset: 2px;
}
[data-interface-viewer] [data-viewer-stage] {
	border: 0;
	border-radius: .5rem;
}
@media (prefers-reduced-motion: reduce) {
	[data-interface-viewer] [data-viewer-transform] { transition: none !important; }
}
@media (max-width: 640px), (pointer: coarse) {
	[data-interface-viewer] button {
		min-inline-size: 2.75rem;
		min-block-size: 2.75rem;
	}
}
			`}
		</style>
	);
}
