"use client";

import { ArrowRightIcon, ArrowUpIcon, CornerDownLeftIcon, SquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";

export function enterAction(state: {
	busy: boolean;
	canSend: boolean;
	nextProblem?: boolean;
}): "stop" | "send" | "next" | "none" {
	if (state.busy) return state.canSend ? "send" : "stop";
	if (state.canSend) return "send";
	if (state.nextProblem) return "next";
	return "none";
}

export function Composer({
	busy,
	value,
	onChange,
	onSend,
	onStop,
	canSend,
	autoFocus,
	inputRef,
	onEscape,
	placeholder = "Ask, answer, or steer the lesson…",
	nextProblem = false,
	onNext,
}: {
	busy: boolean;
	value: string;
	onChange: (v: string) => void;
	onSend: () => void;
	onStop: () => void;
	canSend: boolean;
	autoFocus?: boolean;
	inputRef?: React.RefObject<HTMLTextAreaElement | null>;
	onEscape?: () => void;
	placeholder?: string;
	nextProblem?: boolean;
	onNext?: () => void;
}) {
	const proposed = useInterfaceAnimations() !== null;
	const act = () => {
		const action = enterAction({ busy, canSend, nextProblem });
		if (action === "stop") onStop();
		else if (action === "send") onSend();
		else if (action === "next") onNext?.();
	};
	return (
		<form
			data-testid="composer"
			className={proposed ? "proposed-conversation-composer" : "flex items-end gap-1.5 p-1.5"}
			onSubmit={(e) => {
				e.preventDefault();
				act();
			}}
		>
			<textarea
				ref={inputRef}
				value={value}
				aria-label={placeholder}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape" && onEscape) {
						e.preventDefault();
						e.stopPropagation();
						onEscape();
						return;
					}

					if (e.key === "Enter" && !e.nativeEvent.isComposing && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
						e.preventDefault();
						act();
					}
				}}
				placeholder={placeholder}
				autoFocus={autoFocus}
				rows={1}
				className="field-sizing-content lh-input max-h-48 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 outline-none placeholder:text-muted-foreground"
			/>
			{nextProblem && !busy && !canSend ? (
				<button
					type="submit"
					data-testid="next-problem-button"
					aria-label="Next problem"
					className={proposed ? "proposed-conversation-next" : "flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-green-600 px-4 font-ui text-xs font-medium uppercase tracking-wide text-white transition-colors hover:bg-green-500"}
				>
					Next problem
					<ArrowRightIcon aria-hidden="true" className="size-4" />
				</button>
			) : (
				<ComposerSubmitButton stopping={busy && !canSend} disabled={!busy && !canSend} />
			)}
		</form>
	);
}

export function ComposerSubmitButton({ stopping = false, disabled = false, label = stopping ? "Stop" : "Send" }: {
	stopping?: boolean;
	disabled?: boolean;
	label?: string;
}) {
	const proposed = useInterfaceAnimations() !== null;
	return (
		<button type="submit" aria-label={label} disabled={disabled} data-stopping={proposed && stopping || undefined}
			className={proposed ? "proposed-conversation-send" : cn(
				"flex size-10 shrink-0 items-center justify-center rounded-[10px] transition-colors",
				stopping ? "bg-secondary text-foreground hover:bg-accent" : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40",
			)}>
			{stopping ? <SquareIcon aria-hidden="true" className="size-4" /> : proposed ? <ArrowUpIcon aria-hidden="true" className="size-5" /> : <CornerDownLeftIcon aria-hidden="true" className="size-5" />}
		</button>
	);
}
