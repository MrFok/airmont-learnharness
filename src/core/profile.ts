export const PROFILE_USERNAME_MAX_LENGTH = 64;
export const PROFILE_AVATAR_MAX_BYTES = 512 * 1024;
export const PROFILE_AVATAR_MAX_DIMENSION = 1024;

export interface ProfileSettings {
	username?: string;
	avatar?: string | null;
	[key: string]: unknown;
}

export interface LearnerProfile {
	username: string;
	avatar: string | null;
}

export const EMPTY_PROFILE: Readonly<LearnerProfile> = { username: "", avatar: null };

export function validProfileUsername(value: unknown): value is string {
	return (
		typeof value === "string" &&
		Array.from(value.trim()).length <= PROFILE_USERNAME_MAX_LENGTH &&
		!/[\u0000-\u001f\u007f-\u009f]/u.test(value)
	);
}

export function isProfileAvatar(value: unknown): value is string {
	if (typeof value !== "string" || !value.startsWith("data:image/png;base64,")) return false;
	const encoded = value.slice(22);
	if (
		!encoded ||
		encoded.length > Math.ceil(PROFILE_AVATAR_MAX_BYTES / 3) * 4 ||
		encoded.length % 4 !== 0 ||
		!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
	)
		return false;
	let binary: string;
	try {
		binary = atob(encoded);
	} catch {
		return false;
	}
	if (
		binary.length > PROFILE_AVATAR_MAX_BYTES ||
		btoa(binary) !== encoded ||
		binary.slice(0, 8) !== "\x89PNG\r\n\x1a\n"
	)
		return false;
	const uint32 = (offset: number) =>
		binary.charCodeAt(offset) * 0x1000000 +
		(binary.charCodeAt(offset + 1) << 16) +
		(binary.charCodeAt(offset + 2) << 8) +
		binary.charCodeAt(offset + 3);
	let offset = 8;
	let hasImageData = false;
	while (offset + 12 <= binary.length) {
		const length = uint32(offset);
		const type = binary.slice(offset + 4, offset + 8);
		if (length > binary.length - offset - 12) return false;
		if (offset === 8) {
			if (type !== "IHDR" || length !== 13) return false;
			const width = uint32(offset + 8);
			const height = uint32(offset + 12);
			if (
				width < 1 ||
				height < 1 ||
				width > PROFILE_AVATAR_MAX_DIMENSION ||
				height > PROFILE_AVATAR_MAX_DIMENSION
			)
				return false;
		}
		if (type === "IDAT" && length > 0) hasImageData = true;
		if (type === "IEND") return length === 0 && hasImageData && offset + 12 === binary.length;
		offset += length + 12;
	}
	return false;
}

export function sanitizeProfile(raw: unknown): ProfileSettings | undefined {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
	const out = { ...raw } as ProfileSettings;
	if (validProfileUsername(out.username)) out.username = out.username.trim();
	else delete out.username;
	if (out.avatar !== null && !isProfileAvatar(out.avatar)) delete out.avatar;
	return out;
}

export function resolveProfile(raw?: unknown): LearnerProfile {
	const profile = sanitizeProfile(raw);
	return { username: profile?.username ?? "", avatar: profile?.avatar ?? null };
}

export function profileValidationError(raw: unknown): string | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Profile must be an object.";
	const profile = raw as ProfileSettings;
	if (profile.username !== undefined && !validProfileUsername(profile.username))
		return `Username must be ${PROFILE_USERNAME_MAX_LENGTH} characters or fewer, without control characters.`;
	if (profile.avatar !== undefined && profile.avatar !== null && !isProfileAvatar(profile.avatar))
		return "Profile image must be a PNG up to 512 KB and 1024 × 1024 pixels.";
	return null;
}
