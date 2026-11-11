"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ArrowRightIcon, ArrowUpIcon, CornerDownLeftIcon, SquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PathInput } from "@/components/path-input";
import { AttachFilesButton } from "@/components/attach-files-button";
import { useOptionalInteractionLayers } from "./interaction-layers";
import { isInteractionScopeEligible } from "./plugin-input-focus";
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

/**
 * Session composer with local keystroke state. The owning Chat keeps the
 * current draft in a ref for send/dictation, so typing doesn't rerender the
 * transcript; revision signals explicit parent-driven draft resets.
 */
export function ChatSessionComposer({
	busy,
	value,
	revision,
	onChange,
	onSend,
	onStop,
	sendAllowed,
	dictationActive,
	autoFocus,
	inputRef,
	onEscape,
	placeholder,
	nextProblem,
	onNext,
	pendingInput = false,
}: {
	busy: boolean;
	value: string;
	revision: number;
	onChange: (value: string) => void;
	onSend: () => void;
	onStop: () => void;
	sendAllowed: boolean;
	dictationActive: boolean;
	autoFocus?: boolean;
	inputRef?: React.RefObject<HTMLDivElement | null>;
	onEscape?: () => void;
	placeholder?: string;
	nextProblem?: boolean;
	onNext?: () => void;
	pendingInput?: boolean;
}) {
	const [draft, setDraft] = useState(value);
	useLayoutEffect(() => { setDraft(value); }, [revision, value]);
	const canSend = sendAllowed && (draft.trim().length > 0 || dictationActive || pendingInput);
	const applyDraft = useCallback((next: string) => {
		setDraft(next);
		onChange(next);
	}, [onChange]);

	return (
		<Composer
			busy={busy}
			value={draft}
			onChange={applyDraft}
			onSend={onSend}
			onStop={onStop}
			canSend={canSend}
			autoFocus={autoFocus}
			inputRef={inputRef}
			onEscape={onEscape}
			placeholder={placeholder}
			nextProblem={nextProblem}
			onNext={onNext}
		/>
	);
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
	defaultDropTarget = true,
	fileInsertion = true,
}: {
	busy: boolean;
	value: string;
	onChange: (v: string) => void;
	onSend: () => void;
	onStop: () => void;
	canSend: boolean;
	autoFocus?: boolean;
	inputRef?: React.RefObject<HTMLDivElement | null>;
	onEscape?: () => void;
	placeholder?: string;
	nextProblem?: boolean;
	onNext?: () => void;
	/** Neutral plugin composers opt out without changing core defaults. */
	defaultDropTarget?: boolean;
	fileInsertion?: boolean;
}) {
	const proposed = useInterfaceAnimations() !== null;
	const controller = useOptionalInteractionLayers();
	const act = () => {
		const action = enterAction({ busy, canSend, nextProblem });
		if (action === "stop") onStop();
		else if (action === "send") onSend();
		else if (action === "next") onNext?.();
	};
	const ownInputRef = useRef<HTMLDivElement>(null);
	const editorRef = inputRef ?? ownInputRef;
	return (
		<form
			data-testid="composer"
			className={proposed ? "proposed-conversation-composer" : "flex items-end gap-1.5 p-1.5"}
			onSubmit={(e) => {
				e.preventDefault();
				act();
			}}
		>
			<PathInput
				ref={editorRef}
				value={value}
				aria-label={placeholder}
				onValueChange={onChange}
				defaultDropTarget={defaultDropTarget}
				fileInsertion={fileInsertion}
				onKeyDown={(e) => {
					if (!isInteractionScopeEligible(e.currentTarget, controller)) return;
					// Esc ends dictation before anything else Esc might someday mean
					// here (the dictate decisions: click-again or Esc to stop).
					// stopPropagation claims the Esc (keyboard wave A): the
					// window-level chain must not also abort a turn under us.
					if (e.key === "Escape" && onEscape) {
						controller?.claimEscape(e);
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
				className="field-sizing-content lh-input max-h-48 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 outline-none placeholder:text-muted-foreground"
			/>
			<AttachFilesButton editorRef={editorRef} />
			{nextProblem && !busy && !canSend ? (
				<button
					type="submit"
					data-testid="next-problem-button"
					aria-label="Next problem"
					className={proposed ? "proposed-conversation-next" : "flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-success px-4 font-ui text-xs font-medium uppercase tracking-wide text-background transition-colors hover:bg-success/85"}
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
