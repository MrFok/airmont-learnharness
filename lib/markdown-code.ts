import { bundledLanguages, bundledLanguagesInfo, createHighlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { CodeHighlighterPlugin, HighlightOptions, ThemeInput } from "streamdown";

type HighlightResult = NonNullable<ReturnType<CodeHighlighterPlugin["highlight"]>>;

const aliases = new Map(bundledLanguagesInfo.flatMap(({ id, aliases }) => (aliases ?? []).map(alias => [alias, id])));
const languages = Object.keys(bundledLanguages) as HighlightOptions["language"][];
const supported = new Set<string>(languages);
const normalizeLanguage = (language: string) => aliases.get(language.trim().toLowerCase()) ?? language.trim().toLowerCase();
const customThemes = new WeakMap<object, ThemeInput>();
let nextThemeId = 0;

function resolveTheme(theme: ThemeInput): ThemeInput {
	if (typeof theme === "string") return theme;
	let resolved = customThemes.get(theme);
	if (!resolved) {
		resolved = { ...theme, name: `learnharness-theme-${++nextThemeId}` };
		customThemes.set(theme, resolved);
	}
	return resolved;
}

let highlighter: ReturnType<typeof createHighlighter> | undefined;

function getHighlighter() {
	return highlighter ??= createHighlighter({
		langs: [],
		themes: [],
		engine: createJavaScriptRegexEngine({ forgiving: true }),
	}).catch(error => {
		highlighter = undefined;
		throw error;
	});
}

export function createMarkdownCodePlugin({
	maxEntries = 500,
	maxBytes = 50 * 1024 * 1024,
}: { maxEntries?: number; maxBytes?: number } = {}): CodeHighlighterPlugin {
	const themes: [ThemeInput, ThemeInput] = ["github-light", "github-dark"];
	const cache = new Map<string, { result: HighlightResult; bytes: number }>();
	const pending = new Map<string, Promise<HighlightResult>>();
	let retainedBytes = 0;
	const remember = (key: string, result: HighlightResult) => {
		const bytes = 2 * (key.length + JSON.stringify(result).length);
		if (bytes > maxBytes || maxEntries <= 0) return;
		cache.set(key, { result, bytes });
		retainedBytes += bytes;
		while (cache.size > maxEntries || retainedBytes > maxBytes) {
			const oldest = cache.entries().next().value!;
			cache.delete(oldest[0]);
			retainedBytes -= oldest[1].bytes;
		}
	};

	return {
		name: "shiki",
		type: "code-highlighter",
		getThemes: () => themes,
		getSupportedLanguages: () => languages,
		supportsLanguage: language => supported.has(normalizeLanguage(language)),
		highlight(options, callback) {
			const language = normalizeLanguage(options.language);
			const resolvedThemes = options.themes.map(resolveTheme);
			const themeNames = resolvedThemes.map(theme => typeof theme === "string" ? theme : theme.name);
			const key = JSON.stringify([language, ...themeNames, options.code]);
			const cached = cache.get(key);
			if (cached) {
				cache.delete(key);
				cache.set(key, cached);
				return cached.result;
			}
			let request = pending.get(key);
			if (!request) {
				request = getHighlighter().then(async instance => {
					const lang = supported.has(language) ? language as HighlightOptions["language"] : "text";
					await Promise.all([
						...(lang === "text" ? [] : [instance.loadLanguage(lang)]),
						instance.loadTheme(...resolvedThemes),
					]);
					return instance.codeToTokens(options.code, {
						lang,
						themes: {
							light: themeNames[0]!,
							dark: themeNames[1]!,
						},
					});
				}).then(result => {
					remember(key, result);
					return result;
				}).catch(error => {
					console.error("[markdown] Code highlighting failed:", error);
					return { tokens: options.code.split("\n").map(content => [{ content }]) };
				}).finally(() => pending.delete(key));
				pending.set(key, request);
			}
			if (callback) void request.then(callback).catch(error => console.error("[markdown] Highlight delivery failed:", error));
			return null;
		},
	};
}

export const markdownCode = createMarkdownCodePlugin();
