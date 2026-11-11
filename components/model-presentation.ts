const acronyms: Record<string, string> = { gpt: "GPT", glm: "GLM", api: "API", vl: "VL" };

export function modelDisplayName(id: string, name?: string): string {
	const bare =
		id
			.slice(id.lastIndexOf(":") + 1)
			.split("/")
			.at(-1) ?? id;
	const candidate = name?.trim() || bare;
	return candidate
		.replace(/\b(claude[- ](?:sonnet|opus|haiku)[- ])(\d)[-](\d)(?=[- ]|$)/i, "$1$2.$3")
		.replace(/\b(claude[- ])(\d)[-](\d)(?=[- ](?:sonnet|opus|haiku))/i, "$1$2.$3")
		.replace(/[-_]+/g, " ")
		.split(/\s+/)
		.map(
			(part) =>
				acronyms[part.toLowerCase()] ??
				(/^o\d/i.test(part) ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1)),
		)
		.join(" ");
}

const providerAssets: Record<string, string> = {
	anthropic: "anthropic",
	"claude-code": "anthropic",
	openai: "openai",
	"openai-codex": "openai",
	openrouter: "openrouter",
	google: "google",
	"google-vertex": "google",
	"google-gemini-cli": "google",
	deepseek: "deepseek",
	ollama: "ollama",
	mistral: "mistral",
	zai: "zhipu",
	"zai-coding-plan": "zhipu",
	"azure-openai-responses": "azure",
	xai: "grok",
	"github-copilot": "copilot",
};

export function providerMarkSource(provider: string): string | null {
	const asset = providerAssets[provider];
	return asset ? `/provider-marks/${asset}.svg` : null;
}
