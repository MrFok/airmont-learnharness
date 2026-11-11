"use client";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { Bot, Keyboard, Network, Palette, Plug, Search, Settings, UserRound, X } from "lucide-react";
import { useDialogFocus } from "./connection-controls";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import {
	CURRENT_SETTINGS_VERSION,
	type AgentSettings,
	type AppearanceSettings,
	type CompactionSettings,
	type GraphSettings,
	type UserSettings,
} from "@/src/core";
import { useAppearance } from "./appearance.tsx";
import { SettingsSection } from "./controls.tsx";
import { UpdateSettings } from "./update-settings.tsx";
import { AgentSection } from "./agent-section.tsx";
import type { ModelsSettings } from "@/src/core";
import { MENU_CLOSE_EVENT, MENU_OPEN_EVENT } from "@/components/menu-shell";
import { notifySettingsSaved } from "@/components/settings-signal";
import { KeysSection } from "./keys-section.tsx";
import { Hint } from "@/components/ui/hint";
import { AppearanceSection, GraphSection } from "./appearance-section.tsx";
import { KeyboardSection } from "./keyboard-section.tsx";
import { ChatGPTUIProvider } from "./chatgpt-connection.tsx";
import { NativeSubscriptionUIProvider } from "./subscription-connections.tsx";
import { useProfile } from "@/components/profile";
import { ProfileSection } from "./profile-section";

const SECTIONS = [
	{ id: "keys", label: "Providers", icon: Plug, terms: "connections accounts api keys anthropic openai deepgram" },
	{ id: "profile", label: "Profile", icon: UserRound, terms: "username avatar image" },
	{ id: "agent", label: "Agent", icon: Bot, terms: "tools models research demo visual pdf prompts context compaction" },
	{ id: "appearance", label: "Appearance", icon: Palette, terms: "reading font typography size serif mode colors" },
	{ id: "graph", label: "Graph", icon: Network, terms: "knowledge extraction rendering chunk budget" },
	{ id: "keyboard", label: "Keyboard", icon: Keyboard, terms: "bindings shortcuts keys" },
	{ id: "general", label: "General", icon: Settings, terms: "automatic updates version" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** `open(section?, row?)` — the optional ROW deep-links into the Keys
 *  section with that row unfolded (zero-keys wave: the dictation error's
 *  click lands on the Deepgram row). `row` is the KEY ID (the env-var
 *  name, e.g. DEEPGRAM_API_KEY — KeysSection's openRow state), not the
 *  row's testid. */
const DialogContext = createContext<{ open: (section?: string, row?: string) => void }>({ open: () => {} });

/** AppShell-level mount: the sidebar row and the mod+, chord call this.
 *  `open(section)` lands the dialog on a specific section (the first-run
 *  setup flow deep-links to Keys when no provider key exists yet). */
export function SettingsDialogProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [show, setShow] = useState(false);
	const [landOn, setLandOn] = useState<SectionId>("keys");
	const [landOnRow, setLandOnRow] = useState<string | null>(null);
	const open = useCallback((section?: string, row?: string) => {
		setLandOn(section ? section as SectionId : "keys");
		setLandOnRow(row ?? null);
		setShow(true);
	}, []);
	useEffect(() => window.lh?.onOpenSettings?.((section) => open(section)), [open]);
	return (
		<ChatGPTUIProvider><NativeSubscriptionUIProvider><DialogContext.Provider value={{ open }}>
			{children}
			{show && (
				<SettingsDialog onClose={() => setShow(false)} initialSection={landOn} initialRow={landOnRow} />
			)}
		</DialogContext.Provider></NativeSubscriptionUIProvider></ChatGPTUIProvider>
	);
}

export function useSettingsDialog() {
	return useContext(DialogContext);
}

function SettingsDialog({
	onClose,
	initialSection,
	initialRow,
}: {
	onClose: () => void;
	initialSection: SectionId;
	/** The keys-section row to unfold (see DialogContext above). */
	initialRow: string | null;
}) {
	const backdropDismiss = useBackdropDismiss(onClose);
	return createPortal(
		<div
			className="settings-live-backdrop fixed inset-0 z-50 flex items-center justify-center bg-background/80"
			data-testid="settings-backdrop"
			{...backdropDismiss}
		>
			<SettingsDialogBody onClose={onClose} initialSection={initialSection} initialRow={initialRow} />
		</div>,
		document.body,
	);
}

/** The dialog without the portal/backdrop — the SSR-testable frame
 *  (portals render nothing under renderToStaticMarkup). */
export function SettingsDialogBody({
	onClose,
	initialSection = "keys",
	initialRow = null,
}: {
	onClose: () => void;
	initialSection?: SectionId;
	/** The keys row to unfold on arrival (null = none). While-open
	 *  retargets follow it exactly like initialSection below. */
	initialRow?: string | null;
}) {
	const id = useId();
	const dialogRef = useRef<HTMLDivElement>(null);
	useDialogFocus(dialogRef, true, '[data-testid="settings-close"]');
	const [query, setQuery] = useState("");
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	const sections = SECTIONS.filter((section) => terms.every((term) => `${section.label} ${section.terms}`.toLowerCase().includes(term)));
	const { onAppearanceChange } = useAppearance();
	const profileState = useProfile();
	const [record, setRecord] = useState<UserSettings | null | undefined>(
		undefined,
	);
	const [error, setError] = useState<string | null>(null);
	const [openMenus, setOpenMenus] = useState(0);
	const contentRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		const el = contentRef.current;
		if (!el || openMenus === 0) return;
		const block = (e: Event) => e.preventDefault();
		el.addEventListener("wheel", block, { passive: false });
		el.addEventListener("touchmove", block, { passive: false });
		return () => {
			el.removeEventListener("wheel", block);
			el.removeEventListener("touchmove", block);
		};
	}, [openMenus]);

	useEffect(() => {
		const onOpen = () => setOpenMenus((n) => n + 1);
		const onClose = () => setOpenMenus((n) => Math.max(0, n - 1));
		window.addEventListener(MENU_OPEN_EVENT, onOpen);
		window.addEventListener(MENU_CLOSE_EVENT, onClose);
		return () => {
			window.removeEventListener(MENU_OPEN_EVENT, onOpen);
			window.removeEventListener(MENU_CLOSE_EVENT, onClose);
		};
	}, []);
	const [active, setActive] = useState<SectionId>(initialSection);
	useEffect(() => {
		setActive(initialSection);
	}, [initialSection]);

	useEffect(() => {
		fetch("/api/settings")
			.then((r) =>
				r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)),
			)
			.then((body: { settings: UserSettings | null }) =>
				setRecord(body.settings ?? { version: CURRENT_SETTINGS_VERSION }),
			)
			.catch(() => setRecord(null));
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !e.defaultPrevented && !dialogRef.current?.closest("[inert]")) {
				if (e.target instanceof Element && e.target.closest('[data-lh-menu], [data-proposed-dropdown]')) return;
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	/** ONE writer for the whole dialog: PUT the whole section, keep the
	 *  record mirror in sync, surface route errors inline (a 400 is a
	 *  schema mistake caught by the validation surface). */
	const write = useCallback(
		async (
			section: "general" | "agent" | "models" | "appearance" | "graph" | "compaction",
			body: object,
		) => {
			setError(null);
			const res = await fetch(`/api/settings/${section}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				const detail = (await res.json().catch(() => ({}))) as {
					error?: string;
				};
				setError(`${section}: ${detail.error ?? res.status}`);
				return;
			}
			const stored = (
				(await res.json().catch(() => null)) as { settings?: UserSettings } | null
			)?.settings;
			setRecord(
				(prev) =>
					stored ?? ({ ...(prev ?? {}), [section]: body }) as UserSettings,
			);
			notifySettingsSaved(section);
			if (section === "appearance")
				onAppearanceChange(body as AppearanceSettings);
		},
		[onAppearanceChange],
	);

	return (
		<div
			ref={dialogRef}
			tabIndex={-1}
			role="dialog"
			aria-modal="true"
			aria-labelledby={`${id}-title`}
			data-testid="settings-dialog"
			className="settings-dialog-pop settings-live-shell"
			onClick={(e) => e.stopPropagation()}
		>
			<aside className="settings-live-sidebar">
				<header className="settings-live-header">
					<h2 id={`${id}-title`}>Settings</h2>
					<Hint label="Close" binding="escape" side="left">
						<button type="button" aria-label="Close settings" data-testid="settings-close" className="settings-live-close" onClick={onClose}>
							<X size={18} aria-hidden="true" />
						</button>
					</Hint>
				</header>
				<label className="settings-live-search">
					<Search size={16} aria-hidden="true" />
					<input type="search" aria-label="Search settings sections" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
				</label>
				<p className="settings-live-eyebrow">LearnHarness</p>
				<nav aria-label="Settings sections" data-testid="settings-nav" className="settings-live-navigation">
					{sections.map(({ id: section, label, icon: Icon }) => (
						<button key={section} type="button" data-testid={`settings-nav-${section}`} aria-current={active === section ? "true" : undefined} aria-controls={`${id}-content`} onClick={() => setActive(section)}>
							<Icon size={16} aria-hidden="true" />{label}
						</button>
					))}
				</nav>
				<p role="status" className="settings-live-search-status">{sections.length === 0 ? "No matching sections." : query.trim() ? `${sections.length} matching sections` : ""}</p>
			</aside>
			<div
				ref={contentRef}
				id={`${id}-content`}
				className="settings-live-content"
				data-testid="settings-content"
			>
				{error && (
					<p
						role="alert"
						className="m-4 rounded-sm border border-red-500/40 px-3 py-2 text-xs text-red-500"
						data-testid="settings-error"
					>
						{error}
					</p>
				)}
				{record === undefined ? (
					<p className="px-6 py-5 text-xs text-muted-foreground/70">
						Loading settings…
					</p>
				) : record === null ? (
					<p className="px-6 py-5 text-xs text-muted-foreground/70">
						Settings could not be loaded — refresh to retry.
					</p>
				) : (
					<div>
						{active === "profile" && (
							<SettingsSection title="Profile" testid="section-profile">
								{profileState.loading && (
									<p role="status" className="mb-3 text-sm text-muted-foreground">Loading profile…</p>
								)}
								<ProfileSection
									profile={profileState.profile}
									onSave={profileState.saveProfile}
									saving={profileState.saving}
									error={profileState.error}
									disabled={profileState.loading}
								/>
								{profileState.error && !profileState.saving && (
									<button type="button" className="mt-3 text-sm underline underline-offset-4" onClick={() => void profileState.reloadProfile()}>
										Reload profile
									</button>
								)}
							</SettingsSection>
						)}
						{active === "general" && (
							<SettingsSection
								title="General"
								testid="section-general"
							>
								<UpdateSettings
									autoUpdate={record.general?.autoUpdate ?? true}
									onAutoUpdateChange={(on) =>
										void write("general", { ...record.general, autoUpdate: on })
									}
								/>
							</SettingsSection>
						)}
						{active === "keys" && (
							<SettingsSection title="Providers" testid="section-keys">
								<KeysSection initialRow={initialRow ?? undefined} />
							</SettingsSection>
						)}
						{active === "agent" && (
							<SettingsSection
								title="Agent"
								testid="section-agent"
							>
								<AgentSection
									agent={record.agent}
									models={record.models}
									graph={record.graph}
									compaction={record.compaction}
									onModelsChange={(next: ModelsSettings) =>
										void write("models", next)
									}
									onSectionChange={(next: AgentSettings) =>
										void write("agent", next)
									}
									onCompactionChange={(next: CompactionSettings) =>
										void write("compaction", next)
									}
								/>
							</SettingsSection>
						)}
						{active === "appearance" && (
							<SettingsSection
								title="Appearance"
								testid="section-appearance"
							>
								<AppearanceSection
									appearance={record.appearance}
									onSectionChange={(next: AppearanceSettings) =>
										void write("appearance", next)
									}
								/>
							</SettingsSection>
						)}
						{active === "graph" && (
							<SettingsSection
								title="Graph"
								testid="section-graph"
							>
								<GraphSection
									graph={record.graph}
									onSectionChange={(next: GraphSettings) =>
										void write("graph", next)
									}
								/>
							</SettingsSection>
						)}
						{active === "keyboard" && (
							<SettingsSection
								title="Keyboard"
								hint="Stored on this device"
								testid="section-keyboard"
							>
								<KeyboardSection />
							</SettingsSection>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
