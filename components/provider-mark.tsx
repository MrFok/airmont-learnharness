import { ServerIcon } from "lucide-react";
import { providerMarkSource } from "./model-presentation";

export function ProviderMark({ provider }: { provider: string }) {
	const source = providerMarkSource(provider === "chatgpt" ? "openai" : provider === "grok" ? "xai" : provider);
	if (!source)
		return <ServerIcon role="img" aria-label={`${provider} source`} className="size-3.5 shrink-0 text-muted-foreground" />;
	return (
		<span
			role="img"
			aria-label={`${provider} source`}
			data-provider-mark={provider}
			className="inline-block size-3.5 shrink-0 bg-current text-muted-foreground"
			style={{ mask: `url("${source}") center / contain no-repeat` }}
		/>
	);
}
