import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
	EMPTY_PROFILE,
	PROFILE_AVATAR_MAX_BYTES,
	isProfileAvatar,
	resolveProfile,
	sanitizeProfile,
	validProfileUsername,
} from "../src/core/profile.ts";
import { CURRENT_SETTINGS_VERSION, sanitizeUserSettings } from "../src/core/settings.ts";
import { resolveSettings } from "../src/core/settings-resolution.ts";
import { SETTINGS_SECTIONS } from "../src/server/settings-body.ts";
import { readProfileSettings, saveProfileSettings } from "../components/profile-api.ts";
import { prepareProfileImage } from "../components/profile-image.ts";

const avatar =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZWsAAAAASUVORK5CYII=";

describe("profile settings validation", () => {
	it("keeps existing records on v1, resolves empty identity and preserves unknown keys", () => {
		assert.equal(CURRENT_SETTINGS_VERSION, 1);
		assert.deepEqual(resolveSettings(null).profile, EMPTY_PROFILE);
		const record = sanitizeUserSettings({
			version: 1,
			profile: { username: "  Ricky  ", avatar, future: { pronouns: "they" } },
			appearance: { mode: "light" },
			custom: [1, 2],
		});
		assert.deepEqual(record?.profile, { username: "Ricky", avatar, future: { pronouns: "they" } });
		assert.deepEqual(record?.custom, [1, 2]);
		assert.equal(record?.appearance?.mode, "light");
		assert.deepEqual(resolveSettings(record).profile, { username: "Ricky", avatar });
	});
	it("limits username length by Unicode characters and rejects controls", () => {
		assert.equal(validProfileUsername("字".repeat(64)), true);
		assert.equal(validProfileUsername("😀".repeat(64)), true);
		for (const invalid of ["x".repeat(65), "a\nb", "a\u0000b", 1, null])
			assert.equal(validProfileUsername(invalid), false);
		assert.deepEqual(
			sanitizeProfile({ username: "bad\nname", avatar: "https://example.com/image.png", future: true }),
			{ future: true },
		);
	});
	it("accepts bounded PNG data, rejects remote images, SVG, malformed and oversized raster payloads", () => {
		assert.equal(isProfileAvatar(avatar), true);
		const badDimension = Buffer.from(avatar.slice(22), "base64");
		badDimension.writeUInt32BE(100000, 16);
		for (const invalid of [
			"https://example.com/a.png",
			"data:image/svg+xml;base64,PHN2Zy8+",
			"data:image/png;base64,PHN2Zy8+",
			avatar.slice(0, -8),
			`${avatar}AAAA`,
			`data:image/png;base64,${badDimension.toString("base64")}`,
			`data:image/png;base64,${Buffer.alloc(PROFILE_AVATAR_MAX_BYTES + 1).toString("base64")}`,
		])
			assert.equal(isProfileAvatar(invalid), false, invalid.slice(0, 80));
	});
	it("rejects SVG and mislabeled uploads before trying to decode them", async () => {
		for (const type of ["image/svg+xml", "image/png", "image/jpeg", "image/webp"]) {
			await assert.rejects(
				prepareProfileImage(new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "image.png", { type })),
				/SVG/,
			);
		}
		await assert.rejects(
			prepareProfileImage(
				new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
			),
			/8 MB/,
		);
	});
	it("drops malformed known profile sections instead of preserving unsafe raw values", () => {
		for (const profile of [null, false, [], "unsafe"])
			assert.equal(sanitizeUserSettings({ version: 1, profile })?.profile, undefined);
		assert.deepEqual(resolveProfile({ username: 5, avatar: "data:image/svg+xml,<svg/>" }), EMPTY_PROFILE);
	});
	it("registers a strict profile PUT parser, supports clearing, and preserves future profile fields", () => {
		const parse = SETTINGS_SECTIONS.profile;
		assert.deepEqual(parse({ username: " Ricky ", avatar, future: "kept" }), {
			ok: true,
			settings: { username: "Ricky", avatar, future: "kept" },
		});
		assert.deepEqual(parse({ username: "", avatar: null }), {
			ok: true,
			settings: { username: "", avatar: null },
		});
		for (const invalid of [
			null,
			[],
			{ username: "a".repeat(65) },
			{ avatar: "https://example.com/a.png" },
			{ avatar: "data:image/svg+xml;base64,PHN2Zy8+" },
		])
			assert.equal(parse(invalid).ok, false);
	});
});

describe("profile persistence", () => {
	it("roundtrips profile, removal and unrelated settings through settings.json in an isolated data directory", () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "learnharness-profile-"));
		try {
			const source = `
				import assert from 'node:assert/strict';
				import { readSettings, writeSettings } from './src/store/settings.ts';
				import { SETTINGS_SECTIONS } from './src/server/settings-body.ts';
				const existing = {version:1,general:{autoUpdate:false},appearance:{mode:'light'},future:{keep:true}};
				writeSettings(existing);
				const parsed = SETTINGS_SECTIONS.profile({username:' Ricky ',avatar:${JSON.stringify(avatar)},futureProfile:42});
				assert.ok(parsed.ok);
				writeSettings({...readSettings(),profile:parsed.settings});
				assert.deepEqual(readSettings(),{...existing,profile:{username:'Ricky',avatar:${JSON.stringify(avatar)},futureProfile:42}});
				writeSettings({...readSettings(),profile:{...readSettings().profile,username:'',avatar:null}});
				assert.deepEqual(readSettings(),{...existing,profile:{username:'',avatar:null,futureProfile:42}});
			`;
			execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], {
				env: { ...process.env, LH_DATA_DIR: directory },
				encoding: "utf8",
			});
			assert.ok(fs.existsSync(path.join(directory, "settings.json")));
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});
	it("uses section PUT, retains future profile keys and trusts confirmed server values", async () => {
		const calls: { url: string; options?: RequestInit }[] = [];
		const fetcher: typeof fetch = async (input, options) => {
			calls.push({ url: String(input), options });
			return options?.method === "PUT"
				? Response.json({ settings: { profile: { username: "Ricky", avatar: null, future: "keep" } } })
				: Response.json({
						settings: { profile: { username: "Old", future: "keep" }, general: { autoUpdate: false } },
					});
		};
		assert.deepEqual(await saveProfileSettings({ username: " Ricky ", avatar: null }, fetcher), {
			username: "Ricky",
			avatar: null,
			future: "keep",
		});
		assert.equal(calls[1]?.url, "/api/settings/profile");
		assert.deepEqual(JSON.parse(String(calls[1]?.options?.body)), {
			username: " Ricky ",
			avatar: null,
			future: "keep",
		});
		assert.equal(calls.length, 2);
	});
	it("does not write after read failure or invalid input, and surfaces write failures", async () => {
		let calls = 0;
		const failed: typeof fetch = async () => {
			calls += 1;
			return Response.json({ error: "offline" }, { status: 500 });
		};
		await assert.rejects(saveProfileSettings({ username: "x".repeat(65), avatar: null }, failed), /Username/);
		assert.equal(calls, 0);
		await assert.rejects(
			saveProfileSettings({ username: "Ricky", avatar: null }, failed),
			/could not be loaded/,
		);
		assert.equal(calls, 1);
		await assert.rejects(readProfileSettings(failed), /could not be loaded/);
		const rejected: typeof fetch = async (_input, options) =>
			options?.method === "PUT"
				? Response.json({ error: "Disk is full" }, { status: 500 })
				: Response.json({ settings: null });
		await assert.rejects(saveProfileSettings({ username: "Ricky", avatar: null }, rejected), /Disk is full/);
	});
});
