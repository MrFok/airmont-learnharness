"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { UserRoundIcon } from "lucide-react";
import Image from "next/image";
import { EMPTY_PROFILE, resolveProfile, type LearnerProfile } from "@/src/core";
import { cn } from "@/lib/utils";
import { readProfileSettings, saveProfileSettings } from "./profile-api";
import { notifySettingsSaved, useSettingsSaved } from "./settings-signal";

interface ProfileContextValue {
	profile: LearnerProfile;
	loading: boolean;
	saving: boolean;
	error: string | null;
	saveProfile: (profile: LearnerProfile) => Promise<void>;
	reloadProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
	profile: EMPTY_PROFILE,
	loading: false,
	saving: false,
	error: null,
	saveProfile: async () => {
		throw new Error("Profile settings are unavailable.");
	},
	reloadProfile: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
	const [profile, setProfile] = useState<LearnerProfile>(EMPTY_PROFILE);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const revision = useRef(0);
	const mounted = useRef(false);
	const inFlightSave = useRef(false);
	const channel = useRef<BroadcastChannel | null>(null);
	const reloadProfile = useCallback(async () => {
		const request = ++revision.current;
		setLoading(true);
		try {
			const stored = await readProfileSettings();
			if (mounted.current && revision.current === request) {
				setProfile(resolveProfile(stored));
				setError(null);
			}
		} catch (error) {
			if (mounted.current && revision.current === request)
				setError(error instanceof Error ? error.message : "Profile could not be loaded.");
		} finally {
			if (mounted.current && revision.current === request) setLoading(false);
		}
	}, []);
	useEffect(() => {
		mounted.current = true;
		void reloadProfile();
		return () => {
			mounted.current = false;
			revision.current += 1;
		};
	}, [reloadProfile]);
	useEffect(() => {
		if (typeof BroadcastChannel === "undefined") return;
		const connection = new BroadcastChannel("lh:profile-settings");
		channel.current = connection;
		connection.onmessage = () => {
			if (!inFlightSave.current) void reloadProfile();
		};
		return () => {
			channel.current = null;
			connection.close();
		};
	}, [reloadProfile]);
	useSettingsSaved((section) => {
		if (section === "profile" && !inFlightSave.current) void reloadProfile();
	});
	const saveProfile = useCallback(async (next: LearnerProfile) => {
		if (inFlightSave.current) throw new Error("A profile save is already in progress.");
		inFlightSave.current = true;
		revision.current += 1;
		setSaving(true);
		setError(null);
		try {
			const stored = await saveProfileSettings(next);
			if (mounted.current) {
				setProfile(resolveProfile(stored));
				notifySettingsSaved("profile");
				channel.current?.postMessage("saved");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Profile could not be saved.";
			if (mounted.current) setError(message);
			throw new Error(message);
		} finally {
			inFlightSave.current = false;
			if (mounted.current) {
				setSaving(false);
				setLoading(false);
			}
		}
	}, []);
	const value = useMemo(
		() => ({ profile, loading, saving, error, saveProfile, reloadProfile }),
		[profile, loading, saving, error, saveProfile, reloadProfile],
	);
	return <ProfileContext value={value}>{children}</ProfileContext>;
}

export function useProfile() {
	return useContext(ProfileContext);
}

export function LearnerIdentity({
	profile: override,
	className,
	avatarClassName,
	showName = true,
}: {
	profile?: LearnerProfile;
	className?: string;
	avatarClassName?: string;
	showName?: boolean;
}) {
	const { profile: stored } = useProfile();
	const profile = override ? resolveProfile(override) : stored;
	const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
	const imageClass = cn(
		"size-7 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-foreground/10",
		avatarClassName,
	);
	return (
		<span
			data-learner-identity
			aria-hidden={!showName || undefined}
			className={cn(
				"inline-flex min-w-0 items-center gap-2 font-prose text-sm normal-case tracking-normal",
				className,
			)}
		>
			{profile.avatar && profile.avatar !== failedAvatar ? (
				<Image
					src={profile.avatar}
					alt=""
					unoptimized
					className={imageClass}
					width={28}
					height={28}
					onError={() => setFailedAvatar(profile.avatar)}
				/>
			) : (
				<span
					className={cn(imageClass, "inline-flex items-center justify-center bg-muted text-muted-foreground")}
					aria-hidden="true"
				>
					{profile.username ? (
						<span>{Array.from(profile.username)[0]?.toLocaleUpperCase()}</span>
					) : (
						<UserRoundIcon className="size-4" />
					)}
				</span>
			)}
			{showName && <span className="min-w-0 truncate">{profile.username || "You"}</span>}
		</span>
	);
}
