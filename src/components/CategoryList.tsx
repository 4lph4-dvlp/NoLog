import Link from "next/link";

interface CategoryListProps {
  categories: string[];
  /** Currently active category slug (optional) */
  activeCategory?: string;
}

/**
 * Category navigation component.
 * - Desktop: Vertical list in the left sidebar.
 * - Mobile: Horizontal scrollable row under the search bar.
 */
export function CategoryList({
  categories,
  activeCategory,
}: CategoryListProps) {
  return (
    <nav aria-label="Categories">
      {/* ─── Mobile: Horizontal scroll ──────────────────────────── */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <Link
          href="/"
          className={`shrink-0 px-3 py-1.5 text-sm rounded-full transition-colors ${
            !activeCategory
              ? "bg-accent text-text-on-accent"
              : "bg-surface text-text-secondary hover:bg-surface-hover"
          }`}
        >
          All
        </Link>
        {categories.map((cat) => {
          const slug = cat.toLowerCase().replace(/\s+/g, "-");
          const isActive = activeCategory === slug;
          return (
            <Link
              key={cat}
              href={`/category/${slug}`}
              className={`shrink-0 px-3 py-1.5 text-sm rounded-full transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-accent text-text-on-accent"
                  : "bg-surface text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {cat}
            </Link>
          );
        })}
      </div>

      {/* ─── Desktop: Vertical list ─────────────────────────────── */}
      <div className="hidden md:flex flex-col gap-0.5">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-2">
          Categories
        </h3>
        <Link
          href="/"
          className={`px-2 py-1.5 text-sm rounded-md transition-colors ${
            !activeCategory
              ? "bg-accent-light text-accent font-medium"
              : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          All Posts
        </Link>
        {categories.map((cat) => {
          const slug = cat.toLowerCase().replace(/\s+/g, "-");
          const isActive = activeCategory === slug;
          return (
            <Link
              key={cat}
              href={`/category/${slug}`}
              className={`px-2 py-1.5 text-sm rounded-md transition-colors ${
                isActive
                  ? "bg-accent-light text-accent font-medium"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              }`}
            >
              {cat}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
