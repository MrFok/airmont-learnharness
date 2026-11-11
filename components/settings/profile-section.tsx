"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
	PROFILE_USERNAME_MAX_LENGTH,
	profileValidationError,
	validProfileUsername,
	type LearnerProfile,
} from "@/src/core";
import { LearnerIdentity } from "@/components/profile";
import { prepareProfileImage } from "@/components/profile-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileSection({
	profile,
	onSave,
	saving = false,
	error = null,
	saved = false,
	disabled = false,
}: {
	profile: LearnerProfile;
	onSave: (profile: LearnerProfile) => Promise<void> | void;
	saving?: boolean;
	error?: string | null;
	saved?: boolean;
	disabled?: boolean;
}) {
	const id = useId();
	const [draft, setDraft] = useState(profile);
	const [localError, setLocalError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [didSave, setDidSave] = useState(false);
	const uploadRevision = useRef(0);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			uploadRevision.current += 1;
		};
	}, []);
	useEffect(() => {
		setDraft({ username: profile.username, avatar: profile.avatar });
	}, [profile.username, profile.avatar]);
	const busy = saving || submitting || uploading;
	const dirty = draft.username.trim() !== profile.username || draft.avatar !== profile.avatar;
	const message = localError ?? error;
	return (
		<form
			data-testid="profile-settings"
			className="max-w-lg space-y-5"
			onSubmit={async (event) => {
				event.preventDefault();
				if (busy || disabled) return;
				const validation = profileValidationError(draft);
				if (validation) {
					setLocalError(validation);
					document
						.getElementById(`${id}-${validProfileUsername(draft.username) ? "image" : "username"}`)
						?.focus();
					return;
				}
				setLocalError(null);
				setDidSave(false);
				setSubmitting(true);
				try {
					await onSave({ ...draft, username: draft.username.trim() });
					if (mounted.current) setDidSave(true);
				} catch (error) {
					if (mounted.current)
						setLocalError(error instanceof Error ? error.message : "Profile could not be saved. Try again.");
				} finally {
					if (mounted.current) setSubmitting(false);
				}
			}}
		>
			<div className="space-y-3">
				<LearnerIdentity profile={draft} className="text-base" avatarClassName="size-12" />
				<div className="flex flex-wrap items-center gap-2">
					<label htmlFor={`${id}-image`} className="text-sm font-medium">
						Profile image
					</label>
					<input
						id={`${id}-image`}
						data-testid="profile-image-input"
						type="file"
						accept="image/png,image/jpeg,image/webp"
						disabled={disabled || busy}
						aria-describedby={`${id}-image-hint${message ? ` ${id}-error` : ""}`}
						className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						onChange={async (event) => {
							const file = event.currentTarget.files?.[0];
							event.currentTarget.value = "";
							if (!file) return;
							const request = ++uploadRevision.current;
							setUploading(true);
							setLocalError(null);
							setDidSave(false);
							try {
								const avatar = await prepareProfileImage(file);
								if (mounted.current && request === uploadRevision.current)
									setDraft((current) => ({ ...current, avatar }));
							} catch (error) {
								if (mounted.current && request === uploadRevision.current)
									setLocalError(error instanceof Error ? error.message : "Image could not be loaded.");
							} finally {
								if (mounted.current && request === uploadRevision.current) setUploading(false);
							}
						}}
					/>
					{draft.avatar && (
						<Button
							type="button"
							variant="outline"
							disabled={disabled || busy}
							onClick={() => {
								setDraft((current) => ({ ...current, avatar: null }));
								setDidSave(false);
								setLocalError(null);
							}}
						>
							Remove image
						</Button>
					)}
				</div>
				<p id={`${id}-image-hint`} className="text-xs text-muted-foreground">
					PNG, JPEG or WebP, up to 8 MB.
				</p>
			</div>
			<div className="space-y-2">
				<label htmlFor={`${id}-username`} className="text-sm font-medium">
					Username
				</label>
				<Input
					id={`${id}-username`}
					data-testid="profile-username"
					value={draft.username}
					autoComplete="nickname"
					disabled={disabled || busy}
					aria-describedby={`${id}-username-hint${message ? ` ${id}-error` : ""}`}
					aria-invalid={!validProfileUsername(draft.username) || undefined}
					onChange={(event) => {
						setDraft((current) => ({ ...current, username: event.target.value }));
						setLocalError(null);
						setDidSave(false);
					}}
				/>
				<p id={`${id}-username-hint`} className="text-xs text-muted-foreground">
					Up to {PROFILE_USERNAME_MAX_LENGTH} characters.
				</p>
			</div>
			{message && (
				<p id={`${id}-error`} role="alert" className="text-sm text-destructive">
					{message}
				</p>
			)}
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={disabled || busy || !dirty}>
					{saving || submitting ? "Saving…" : "Save profile"}
				</Button>
				<p role="status" className="text-sm text-muted-foreground">
					{uploading ? "Preparing image…" : saved || didSave ? "Profile saved." : ""}
				</p>
			</div>
		</form>
	);
}
