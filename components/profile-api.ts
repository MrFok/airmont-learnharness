import {
	profileValidationError,
	resolveProfile,
	sanitizeProfile,
	type LearnerProfile,
	type ProfileSettings,
} from "@/src/core";

export async function readProfileSettings(fetcher: typeof fetch = fetch): Promise<ProfileSettings> {
	const response = await fetcher("/api/settings", { cache: "no-store" });
	if (!response.ok) throw new Error("Profile could not be loaded. Try again.");
	const body = await response.json();
	if (!body || typeof body !== "object" || !("settings" in body))
		throw new Error("Profile could not be loaded. Try again.");
	return sanitizeProfile(body.settings?.profile) ?? {};
}

export async function saveProfileSettings(
	profile: LearnerProfile,
	fetcher: typeof fetch = fetch,
): Promise<ProfileSettings> {
	const error = profileValidationError(profile);
	if (error) throw new Error(error);
	const stored = await readProfileSettings(fetcher);
	const response = await fetcher("/api/settings/profile", {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ ...stored, ...profile }),
	});
	const body = await response.json().catch(() => null);
	if (!response.ok) throw new Error(body?.error ?? "Profile could not be saved. Try again.");
	if (!body?.settings || !body.settings.profile)
		throw new Error("The server did not confirm the saved profile. Try again.");
	return { ...sanitizeProfile(body.settings.profile), ...resolveProfile(body.settings.profile) };
}
