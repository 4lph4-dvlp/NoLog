import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getCategories } from "@/lib/notion";
import {
  SIDEBAR_ATTR_PREFIX,
  SIDEBAR_BREAKPOINT_PX,
  SIDEBAR_STORAGE_KEY_PREFIX,
  initSidebarState,
} from "@/lib/sidebar";
import { CONFIG } from "@/site.config";
import { Analytics } from "@vercel/analytics/react";
import DefaultLayout from "@/templates/default/Layout";
import TerminalLayout from "@/templates/terminal/Layout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(CONFIG.site.url),
  title: CONFIG.site.title,
  description: CONFIG.site.description,
  robots: CONFIG.seo.allowIndexing
    ? { index: true, follow: true }
    : { index: false, follow: false },
  verification: {
    ...(CONFIG.seo.googleVerification
      ? { google: CONFIG.seo.googleVerification }
      : {}),
    ...(CONFIG.seo.naverVerification
      ? { other: { "naver-site-verification": CONFIG.seo.naverVerification } }
      : {}),
  },
};

/**
 * Root layout connecting Next.js App Router to the selected Template Layout.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch categories from Notion at build/revalidation time
  let categories: string[] = [];
  try {
    categories = await getCategories();
  } catch {
    // Gracefully degrade if Notion API is not configured yet
    categories = [];
  }

  // Template routing
  let TemplateLayout = DefaultLayout;
  if (CONFIG.template === "default") {
    TemplateLayout = DefaultLayout;
  } else if (CONFIG.template === "terminal") {
    TemplateLayout = TerminalLayout;
  }

  return (
    <html
      lang={CONFIG.site.locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground relative">
        {/* Blocking pre-hydration correction of <html>'s data-sidebar-*
            attributes, modeled on the installed next-themes bundle's own
            script-injection technique — a plain inline <script>, never
            next/script strategy="beforeInteractive" (10-RESEARCH.md rejected
            the latter explicitly: it does not reliably block hydration/
            paint in App Router). Only a numeric constant and two build-time
            string constants are interpolated (threat T-10-03) — nothing
            that could originate from a visitor. Rendered before
            <ThemeProvider> so it runs at least as early as next-themes'
            own script. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(${initSidebarState.toString()})(${SIDEBAR_BREAKPOINT_PX}, ${JSON.stringify(
              SIDEBAR_STORAGE_KEY_PREFIX
            )}, ${JSON.stringify(SIDEBAR_ATTR_PREFIX)})`,
          }}
        />
        <Analytics />
        <ThemeProvider>
          <TemplateLayout categories={categories}>
            {children}
          </TemplateLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
