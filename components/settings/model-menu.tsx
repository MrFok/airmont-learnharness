"use client";
/**
 * The model menu (extracted 2026-09-20 from model-picker.tsx, owner ask:
 * the agent settings' role selects use the EXACT same dropdown as the
 * chat model selector — same look, same machine). The fuzzy search +
 * arrow-walk + Enter pick machine lives here once; each mount owns only
 * the popover shell (positioning, outside-click, Esc — the chat control
 * opens UP from the bottom bar, the settings rows open DOWN inside the
 * dialog).
 *
 * The appearance wave (2026-09-26) added the reading-font picker over the
 * same machine: FontMenuList (families instead of models, plus the
 * always-offerable DEFAULT row and a custom-family escape input).
 *
 * Keyboard machine (owner polish, 2026-09-17): focus STAYS in the search
 * field — ↑/↓ walk the filtered results (clamped, no wrap), Enter picks
 * the walked row (or the first result when nothing is walked).
 * stopPropagation keeps these keys out of every other listener while the
 * menu is open.
 */

import { useEffect, useId, useRef, useState } from "react";
import type { ModelCatalogEntry } from "@/src/core";
import { fuzzyScore, subscriptionLabel } from "@/src/core";
import { formatTokens } from "@/components/usage-format";
import { modelDisplayName } from "@/components/model-presentation";
import { ProviderMark } from "@/components/provider-mark";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";

function priceLabel(cost: ModelCatalogEntry["cost"]): string {
	const fmt = (n: number) => `$${n < 1 ? n.toFixed(2).replace(/0$/, "") : n.toFixed(2)}`;
	return `${fmt(cost.input)}/${fmt(cost.output)}`;
}

function usePickerSemantics(label: string, keys: string[], activeIndex: number | null, busy = false) {
	const proposed = useInterfaceAnimations() !== null;
	const id = useId();
	const optionId = (key: string) => `${id}-option-${encodeURIComponent(key)}`;
	const activeKey = activeIndex === null ? undefined : keys[activeIndex];
	return {
		input: proposed ? {
			role: "combobox" as const,
			"aria-label": `Search ${label.toLowerCase()}`,
			"aria-autocomplete": "list" as const,
			"aria-expanded": true,
			"aria-controls": id,
			"aria-activedescendant": activeKey === undefined ? undefined : optionId(activeKey),
		} : {},
		list: proposed ? { id, role: "listbox" as const, "aria-label": label, "aria-busy": busy } : {},
		item: proposed ? { role: "presentation" as const } : {},
		option: (key: string, selected: boolean) => proposed ? {
			id: optionId(key),
			role: "option" as const,
			"aria-selected": selected,
			"data-menu-selected": selected,
			tabIndex: -1,
		} : {},
	};
}

/** The model dropdown body — fuzzy search + ranked list. `models ===
 *  undefined` is the catalog-loading state; an empty result list gets
 *  its own quiet line. */
export function ModelMenuList({
	models,
	effectiveId,
	effectiveProvider,
	onPick,
	footer,
}: {
	/** The full catalog — undefined while it loads. */
	models: ModelCatalogEntry[] | undefined;
	/** Currently effective id (the row gets the quiet highlight). */
	effectiveId: string | undefined;
	/** The effective id's provider (model-slots wave: the catalog
	 *  federates multiple providers and ids can collide across them —
	 *  the highlight must match BOTH coordinates or it lands on the
	 *  wrong row). */
	effectiveProvider?: string;
	/** Receives the chosen entry. */
	onPick: (entry: ModelCatalogEntry) => void;
	/** Quiet footer note under the list (context-specific). */
	footer?: string;
}) {
	const [query, setQuery] = useState("");
	const [menuIdx, setMenuIdx] = useState<number | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	// Keep the arrow-walked result visible in the scrolling list.
	useEffect(() => {
		if (menuIdx === null) return;
		listRef.current?.querySelector(`[data-idx="${menuIdx}"]`)?.scrollIntoView({ block: "nearest" });
	}, [menuIdx]);

	// The filtered, ranked model list.
	const results = (models ?? [])
		.map((m) => ({ m, s: fuzzyScore(query, m.provider, m.id, m.name) }))
		.filter((r) => r.s !== null)
		.sort((a, b) => b.s! - a.s! || a.m.id.localeCompare(b.m.id))
		.map((r) => r.m);
	const optionKey = (model: ModelCatalogEntry) => JSON.stringify([model.provider, model.id]);
	const semantics = usePickerSemantics("Models", results.map(optionKey), menuIdx, !models);

	return (
		<>
			<input
				{...semantics.input}
				ref={searchRef}
				data-testid="model-search"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setMenuIdx(null); // new query → the walk restarts on Enter/↓
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						e.stopPropagation();
						if (results.length === 0) return;
						setMenuIdx((i) =>
							e.key === "ArrowDown"
								? Math.min((i ?? -1) + 1, results.length - 1)
								: Math.max((i ?? results.length) - 1, 0),
						);
					} else if (e.key === "Enter") {
						const chosen = results[menuIdx ?? 0];
						if (chosen) {
							e.preventDefault();
							e.stopPropagation();
							onPick(chosen);
						}
					}
				}}
				placeholder="Search models…"
				className="lh-input mb-1.5 w-full rounded-lg border bg-background px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
			/>
			{!models && <div className="px-2 py-3 text-center text-muted-foreground">Loading models…</div>}
			{models && results.length === 0 && (
				<div className="px-2 py-3 text-center text-muted-foreground">No models match.</div>
			)}
			<ul {...semantics.list} ref={listRef} data-testid="model-list" className="flex max-h-72 flex-col overflow-y-auto px-1">
				{results.map((m, i) => (
					<li {...semantics.item} key={`${m.provider}/${m.id}`}>
						<button
							{...semantics.option(optionKey(m), m.id === effectiveId && m.provider === (effectiveProvider ?? m.provider))}
							type="button"
							data-testid={`model-option-${m.id.replace(/[^a-z0-9-]/gi, "_")}`}
							data-idx={i}
							data-menu-active={i === menuIdx}
							onClick={() => onPick(m)}
							className={`flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted ${
								i === menuIdx ? "bg-accent/40 ring-1 ring-inset ring-border" : ""
							}${m.id === effectiveId && m.provider === (effectiveProvider ?? m.provider) && i !== menuIdx ? " bg-muted/60" : ""}`}
						>
							<span className="flex items-center justify-between gap-2">
								<span className="flex min-w-0 items-center gap-1.5 text-card-foreground">
									<ProviderMark provider={m.provider} />
									<span className="truncate">{modelDisplayName(m.id, m.name)}</span>
								</span>
								<span className="shrink-0 tabular-nums text-muted-foreground" title={subscriptionLabel(`${m.provider}:${m.id}`) ? "Subscription connection" : "USD per 1M tokens in/out"}>
									{subscriptionLabel(`${m.provider}:${m.id}`) ?? priceLabel(m.cost)}
								</span>
							</span>
							<span className="flex items-center justify-between gap-2 text-muted-foreground">
								<span className="truncate">{subscriptionLabel(`${m.provider}:${m.id}`) ? `${subscriptionLabel(`${m.provider}:${m.id}`)} (subscription)` : m.provider} · {m.id}</span>
								<span className="shrink-0 tabular-nums">{formatTokens(m.contextWindow)}</span>
							</span>
						</button>
					</li>
				))}
			</ul>
			{footer && (
				<div className="mt-1 border-t px-2 pt-1.5 text-xs text-muted-foreground">{footer}</div>
			)}
		</>
	);
}

/** The thinking-level dropdown body — the levels this model actually
 *  supports, ✓ on the effective one. Same shape as the chat selector's. */
export function ThinkingMenuList({
	levels,
	effectiveLevel,
	onPick,
	empty,
	footer,
}: {
	levels: string[];
	effectiveLevel: string | undefined;
	onPick: (level: string) => void;
	/** Shown instead of the list when there are no levels. */
	empty?: string;
	footer?: string;
}) {
	const proposed = useInterfaceAnimations() !== null;
	const [focusedLevel, setFocusedLevel] = useState<string | null>(null);
	const selectedIndex = Math.max(0, levels.indexOf(effectiveLevel ?? ""));
	const focusIndex = focusedLevel === null ? selectedIndex : Math.max(0, levels.indexOf(focusedLevel));
	const content = (
		<>
			{levels.length === 0 ? (
				<div className="px-2 py-3 text-center text-muted-foreground">{empty ?? "No thinking levels."}</div>
			) : (
				levels.map((level, index) => (
					<button
						key={level}
						role={proposed ? "menuitemradio" : undefined}
						aria-checked={proposed ? level === effectiveLevel : undefined}
						data-menu-selected={proposed ? level === effectiveLevel : undefined}
						tabIndex={proposed ? index === focusIndex ? 0 : -1 : undefined}
						onFocus={proposed ? () => setFocusedLevel(level) : undefined}
						type="button"
						data-testid={`thinking-option-${level}`}
						onClick={() => onPick(level)}
						className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted ${
							level === effectiveLevel ? "bg-muted/60 text-card-foreground" : "text-card-foreground"
						}`}
					>
						<span>{level}</span>
						{level === effectiveLevel && <span aria-hidden>✓</span>}
					</button>
				))
			)}
			{footer && (
				<div className="mt-1 border-t px-2 pt-1.5 text-xs text-muted-foreground">{footer}</div>
			)}
		</>
	);
	if (!proposed) return content;
	return (
		<div
			role="menu"
			aria-label="Thinking level"
			aria-orientation="vertical"
			className="flex flex-col"
			onKeyDown={(event) => {
				const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
				if (!buttons.length) return;
				const index = buttons.indexOf(event.target as HTMLButtonElement);
				let next: number;
				if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
				else if (event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
				else if (event.key === "Home") next = 0;
				else if (event.key === "End") next = buttons.length - 1;
				else return;
				event.preventDefault();
				event.stopPropagation();
				setFocusedLevel(levels[next]!);
				buttons[next]?.focus();
			}}
		>
			{content}
		</div>
	);
}

/** The provider-picker dropdown body (keys wave-5 polish, 2026-09-21:
 *  the owner wanted the Add-provider control to match the app's dropdown
 *  language) — the same fuzzy-search + arrow-walk + Enter machine over
 *  the pi-ai provider table. Rows read: provider label, its env var in
 *  quiet mono on the right. */
export function ProviderMenuList({
	providers,
	onPick,
}: {
	providers: { id: string; envVar: string; label: string }[];
	onPick: (provider: { id: string; envVar: string; label: string }) => void;
}) {
	const proposed = useInterfaceAnimations() !== null;
	const [query, setQuery] = useState("");
	const [menuIdx, setMenuIdx] = useState<number | null>(null);
	const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	useEffect(() => {
		if (menuIdx === null) return;
		listRef.current?.querySelector(`[data-idx="${menuIdx}"]`)?.scrollIntoView({ block: "nearest" });
	}, [menuIdx]);

	const results = providers
		.map((p) => ({ p, s: fuzzyScore(query, p.id, p.envVar, p.label) }))
		.filter((r) => r.s !== null)
		.sort((a, b) => b.s! - a.s! || a.p.id.localeCompare(b.p.id))
		.map((r) => r.p);
	const semantics = usePickerSemantics("Providers", results.map((provider) => provider.id), menuIdx);
	const pick = (provider: (typeof providers)[number]) => {
		if (proposed) setSelectedProvider(provider.id);
		onPick(provider);
	};

	return (
		<>
			<input
				{...semantics.input}
				ref={searchRef}
				data-testid="provider-search"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setMenuIdx(null);
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						e.stopPropagation();
						if (results.length === 0) return;
						setMenuIdx((i) =>
							e.key === "ArrowDown"
								? Math.min((i ?? -1) + 1, results.length - 1)
								: Math.max((i ?? results.length) - 1, 0),
						);
					} else if (e.key === "Enter") {
						const chosen = results[menuIdx ?? 0];
						if (chosen) {
							e.preventDefault();
							e.stopPropagation();
							pick(chosen);
						}
					}
				}}
				placeholder="Search providers…"
				className="lh-input mb-1.5 w-full rounded-lg border bg-background px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
			/>
			{results.length === 0 && (
				<div className="px-2 py-3 text-center text-muted-foreground">No providers match.</div>
			)}
			<ul {...semantics.list} ref={listRef} data-testid="provider-list" className="flex max-h-72 flex-col overflow-y-auto px-1">
				{results.map((p, i) => (
					<li {...semantics.item} key={p.id}>
						<button
							{...semantics.option(p.id, p.id === selectedProvider)}
							type="button"
							data-testid={`provider-option-${p.id.replace(/[^a-z0-9-]/gi, "_")}`}
							data-idx={i}
							data-menu-active={i === menuIdx}
							onClick={() => pick(p)}
							className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted ${
								i === menuIdx ? "bg-accent/40 ring-1 ring-inset ring-border" : ""
							}`}
						>
							{proposed ? (
								<span className="proposed-provider-label">
									<span className="proposed-picker-provider-mark" aria-hidden="true"><ProviderMark provider={p.id} /></span>
									<span className="truncate">{p.label}</span>
								</span>
							) : <span className="truncate text-card-foreground">{p.label}</span>}
							<span className="shrink-0 font-mono text-[11px] text-muted-foreground">{p.envVar}</span>
						</button>
					</li>
				))}
			</ul>
		</>
	);
}

export function fontMenuResults(query: string, families: string[], defaultFamily = "Source Sans 3"): Array<string | null> {
	const scored = families
		.map((f) => ({ f, s: fuzzyScore(query, f) }))
		.filter((r) => r.s !== null)
		.sort((a, b) => b.s! - a.s! || a.f.localeCompare(b.f))
		.map((r) => r.f);
	const defaultScore = fuzzyScore(query, defaultFamily, "default");
	if (query.trim() === "" || defaultScore !== null) return [null, ...scored];
	return scored;
}

/** The custom-family action row's decision (pure, 2026-09-26): a typed
 *  query that matches NO family becomes the "Use '<query>'" custom pick —
 *  a matching family is the better pick, so the action row only exists
 *  when there is nothing else to pick. Exported for tests. */
export function customFamilyFor(query: string, families: string[], defaultFamily = "Source Sans 3"): string | null {
	const trimmed = query.trim();
	if (trimmed === "") return null;
	return fontMenuResults(query, families, defaultFamily).length === 0 ? trimmed : null;
}

/** The reading-font dropdown body — ONE search field (owner ask
 *  2026-09-26: "why two?"): the fuzzy machine filters the families, and
 *  when nothing matches, a "Use '<query>'" action row commits the typed
 *  text as a custom family — the old separate custom input is gone, the
 *  search field absorbed its job. `families === undefined` is the
 *  enumerating state; the curated fallback arrives as plain families with
 *  a footer that says so honestly. */
export function FontMenuList({
	families,
	effectiveFamily,
	onPick,
	footer,
}: {
	/** Enumerated font families (already deduped/sorted by the caller);
	 *  undefined while the enumeration runs. */
	families: string[] | undefined;
	/** The stored override; null selects the preview's default family. */
	effectiveFamily: string | null;
	/** Receives the pick: a family string, or null for the default. */
	onPick: (family: string | null) => void;
	/** Quiet footer note under the list. */
	footer?: string;
}) {
	const proposed = useInterfaceAnimations() !== null;
	const [query, setQuery] = useState("");
	const [menuIdx, setMenuIdx] = useState<number | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	useEffect(() => {
		if (menuIdx === null) return;
		listRef.current?.querySelector(`[data-idx="${menuIdx}"]`)?.scrollIntoView({ block: "nearest" });
	}, [menuIdx]);

	const defaultFamily = proposed ? "Segoe UI" : "Source Sans 3";
	const availableFamilies = proposed ? families?.filter((family) => family !== defaultFamily) : families;
	const results = fontMenuResults(query, availableFamilies ?? [], defaultFamily);
	// The custom-family action row: only when a typed query matches
	// nothing (a matching family is the better pick). Enter picks it.
	const customFamily = customFamilyFor(query, availableFamilies ?? [], defaultFamily);
	const walkable: Array<string | null> = proposed && !families ? [] : customFamily !== null ? ["__custom__"] : results;
	const optionKey = (family: string | null) => JSON.stringify(family);
	const optionKeys = !families ? [] : customFamily !== null ? ["custom"] : results.map(optionKey);
	const semantics = usePickerSemantics("Fonts", optionKeys, menuIdx, !families);

	return (
		<>
			<input
				{...semantics.input}
				ref={searchRef}
				data-testid="font-search"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setMenuIdx(null); // new query → the walk restarts on Enter/↓
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						e.stopPropagation();
						if (walkable.length === 0) return;
						setMenuIdx((i) =>
							e.key === "ArrowDown"
								? Math.min((i ?? -1) + 1, walkable.length - 1)
								: Math.max((i ?? walkable.length) - 1, 0),
						);
					} else if (e.key === "Enter") {
						const chosen = walkable[menuIdx ?? 0];
						if (chosen !== undefined) {
							e.preventDefault();
							e.stopPropagation();
							onPick(chosen === "__custom__" ? customFamily : chosen);
						}
					}
				}}
				placeholder="Search fonts…"
				className="lh-input mb-1.5 w-full rounded-lg border bg-background px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
			/>
			{!families && <div className="px-2 py-3 text-center text-muted-foreground">Loading fonts…</div>}
			<ul {...semantics.list} ref={listRef} data-testid="font-list" className="flex max-h-72 flex-col overflow-y-auto px-1">
				{families &&
					results.map((family, i) => {
						const isDefault = family === null;
						const effective = isDefault ? effectiveFamily === null || (proposed && effectiveFamily === defaultFamily) : family === effectiveFamily;
						return (
							<li {...semantics.item} key={family ?? "__default"}>
								<button
									{...semantics.option(optionKey(family), effective)}
									type="button"
									data-testid={isDefault ? "font-option-default" : `font-option-${family.replace(/[^a-z0-9-]/gi, "_")}`}
									data-idx={i}
									data-menu-active={i === menuIdx}
									onClick={() => onPick(family)}
									className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted ${
										i === menuIdx ? "bg-accent/40 ring-1 ring-inset ring-border" : ""
									}${effective && i !== menuIdx ? " bg-muted/60" : ""}`}
								>
									<span className="truncate text-card-foreground">{family ?? defaultFamily}</span>
									<span className="shrink-0 text-muted-foreground">{isDefault ? "default" : effective && <span aria-hidden>✓</span>}</span>
								</button>
							</li>
						);
					})}
				{families && customFamily !== null && (
					<li {...semantics.item}>
						<button
							{...semantics.option("custom", customFamily === effectiveFamily)}
							type="button"
							data-testid="font-option-custom"
							data-idx={0}
							data-menu-active={menuIdx === 0}
							onClick={() => onPick(customFamily)}
							className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted ${
								menuIdx === 0 ? "bg-accent/40 ring-1 ring-inset ring-border" : ""
							}`}
						>
							<span className="truncate text-card-foreground">Use “{customFamily}”</span>
							<span className="shrink-0 text-muted-foreground">custom</span>
						</button>
					</li>
				)}
			</ul>
			{footer && <div className="px-2 pt-1.5 text-xs text-muted-foreground">{footer}</div>}
		</>
	);
}
