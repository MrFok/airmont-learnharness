import type { Metadata } from "next";
import { Geist_Mono, JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import "@/components/interface/styles/index.css";
import { AppShell, SidebarProvider } from "@/components/sidebar";
import { ActivityProvider } from "@/components/activity-dock";
import { ServerEventsProvider } from "@/components/server-events";
import { AppearanceProvider } from "@/components/settings/appearance";
import UpdateBanner from "@/components/update-banner";
import { ProfileProvider } from "@/components/profile";
import { DesignProvider } from "@/components/interface/design-provider";

const ui = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const prose = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans3" });
const code = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
	title: "Learning Harness",
	description: "A teacher agent with a memory — sessions, quizzes, and a knowledge graph of what you know.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" data-design-system="canonical" className={`dark ${ui.variable} ${prose.variable} ${code.variable}`}>
			<body data-app-interface className="min-h-dvh antialiased">
			<DesignProvider>
			<ServerEventsProvider>
				<AppearanceProvider>
					<ProfileProvider>
						<SidebarProvider>
							<ActivityProvider>
								<AppShell>{children}</AppShell>
							</ActivityProvider>
						</SidebarProvider>
					</ProfileProvider>
				</AppearanceProvider>
			</ServerEventsProvider>
			<UpdateBanner />
			</DesignProvider>
		</body>
		</html>
	);
}
