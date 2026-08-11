import { Profile } from "@/components/Profile";
import { SearchBar } from "@/components/SearchBar";
import { CategoryList } from "@/components/CategoryList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SubscribeSection } from "@/components/subscribe/SubscribeSection";
import { SidebarShell } from "@/components/layout/SidebarShell";

interface DefaultLayoutProps {
  children: React.ReactNode;
  categories: string[];
}

/**
 * Default Template Layout implementing the responsive 3-column grid.
 *
 * Desktop:  Category Sidebar | Main Feed | Profile Sidebar (collapsible)
 * Mobile:   Profile → Search → Category (horizontal) → Feed
 *
 * Stays a Server Component (D-06, stop-ship): it constructs leftSlot/
 * rightSlot itself, including <SubscribeSection variant="default">, and
 * hands them to SidebarShell as already-rendered elements. SidebarShell
 * must never import SubscribeSection directly.
 */
export default function DefaultLayout({ children, categories }: DefaultLayoutProps) {
  return (
    <div className="relative max-w-[var(--max-content-width)] mx-auto px-4 pt-16 pb-6 md:pt-6 md:pb-8">
      {/* Mobile-only Theme Toggle (Top Right). The md+ instance lives inside
          SidebarShell's pinned toggle row, paired with the (plan 10-02)
          avatar toggle. Planning resolution R-1: two single-viewport
          renders keep ThemeToggle visible at every viewport — moving it
          entirely into the desktop-only pinned row would delete the mobile
          theme toggle, a regression against SIDE-08. */}
      <div className="absolute top-4 right-4 z-50 md:hidden">
        <ThemeToggle />
      </div>

      {/* ─── Mobile Layout ──────────────────────────────── */}
        <div className="md:hidden flex flex-col gap-4 relative">
          {/* 1. Profile */}
          <Profile />

          <SubscribeSection variant="default" />

          {/* 2. Search */}
          <SearchBar />

          {/* 3. Categories (horizontal scroll) */}
          <CategoryList categories={categories} />
        </div>

        {/* ─── Desktop Layout (3-column grid, collapsible) ─── */}
        <SidebarShell
          leftSlot={
            <>
              <SearchBar />
              <div className="mt-4">
                <CategoryList categories={categories} />
              </div>
            </>
          }
          rightSlot={
            <>
              <Profile />
              <div className="mt-4">
                <SubscribeSection variant="default" />
              </div>
            </>
          }
        >
          {children}
        </SidebarShell>
      </div>
  );
}
