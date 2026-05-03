import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NextAuthProvider } from "@/components/NextAuthProvider";
import { Profile } from "@/components/Profile";
import { SearchBar } from "@/components/SearchBar";
import { CategoryList } from "@/components/CategoryList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCategories } from "@/lib/notion";
import { CONFIG } from "@/site.config";
import { Analytics } from "@vercel/analytics/react";
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
 * Root layout implementing the responsive 3-column grid.
 *
 * Desktop:  Category Sidebar | Main Feed | Profile Sidebar
 * Mobile:   Profile → Search → Category (horizontal) → Feed
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

  return (
    <html
      lang={CONFIG.site.locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script async defer src="https://cusdis.com/js/cusdis.es.js" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <NextAuthProvider>
          <Analytics />
          <ThemeProvider>
            <div className="max-w-[var(--max-content-width)] mx-auto px-4 py-6 md:py-8">
            {/* ─── Mobile Layout ──────────────────────────────── */}
            <div className="md:hidden flex flex-col gap-4 relative">
              {/* Theme Toggle (Mobile Top Right) */}
              <div className="absolute top-2 right-2 z-10">
                <ThemeToggle />
              </div>

              {/* 1. Profile */}
              <Profile />

              {/* 2. Search */}
              <SearchBar />

              {/* 3. Categories (horizontal scroll) */}
              <CategoryList categories={categories} />

              {/* 4. Feed */}
              <main className="min-w-0">{children}</main>
            </div>

            {/* ─── Desktop Layout (3-column grid) ────────────── */}
            <div className="hidden md:grid md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)] gap-8">
              {/* Left: Category Sidebar */}
              <aside className="sticky top-8 self-start">
                <SearchBar />
                <div className="mt-4">
                  <CategoryList categories={categories} />
                </div>
              </aside>

              {/* Center: Main Feed */}
              <main className="min-w-0">{children}</main>

              {/* Right: Profile Sidebar */}
              <aside className="sticky top-8 self-start">
                <Profile />
              </aside>
            </div>
          </div>
          </ThemeProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
