import { Profile } from "@/components/Profile";
import { SearchBar } from "@/components/SearchBar";
import { CategoryList } from "@/components/CategoryList";
import { ThemeToggle } from "@/components/ThemeToggle";

interface DefaultLayoutProps {
  children: React.ReactNode;
  categories: string[];
}

/**
 * Default Template Layout implementing the responsive 3-column grid.
 *
 * Desktop:  Category Sidebar | Main Feed | Profile Sidebar
 * Mobile:   Profile → Search → Category (horizontal) → Feed
 */
export default function DefaultLayout({ children, categories }: DefaultLayoutProps) {
  return (
    <div className="relative max-w-[var(--max-content-width)] mx-auto px-4 pt-16 pb-6 md:pt-16 md:pb-8">
      {/* Global Theme Toggle (Top Right) */}
      <div className="absolute top-4 right-4 md:top-6 md:right-4 z-50">
        <ThemeToggle />
      </div>

      {/* ─── Mobile Layout ──────────────────────────────── */}
        <div className="md:hidden flex flex-col gap-4 relative">
          {/* 1. Profile */}
          <Profile />

          {/* 2. Search */}
          <SearchBar />

          {/* 3. Categories (horizontal scroll) */}
          <CategoryList categories={categories} />
        </div>

        {/* ─── Desktop Layout (3-column grid) ────────────── */}
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)] md:gap-8">
          {/* Left: Category Sidebar */}
          <aside className="hidden md:block sticky top-8 self-start">
            <SearchBar />
            <div className="mt-4">
              <CategoryList categories={categories} />
            </div>
          </aside>

          {/* Center: Main Feed */}
          <main className="min-w-0">{children}</main>

          {/* Right: Profile Sidebar */}
          <aside className="hidden md:block sticky top-8 self-start">
            <Profile />
          </aside>
        </div>
      </div>
  );
}
