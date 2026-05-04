"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONFIG } from "@/site.config";

interface CategoryListProps {
  categories: string[];
}

/**
 * Category navigation component.
 * - Desktop: Vertical list in the left sidebar.
 * - Mobile: Horizontal scrollable row under the search bar.
 */
export function CategoryList({ categories }: CategoryListProps) {
  const isKo = CONFIG.site.locale === "ko";
  const pathname = usePathname();

  // Automatically determine active category from the URL
  const activeCategory = pathname?.startsWith("/category/")
    ? pathname.split("/category/")[1]
    : undefined;

  return (
    <nav aria-label={isKo ? "카테고리" : "Categories"}>
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
          {isKo ? "전체" : "All"}
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
          {isKo ? "카테고리" : "Categories"}
        </h3>
        <Link
          href="/"
          className={`px-2 py-1.5 text-sm rounded-md transition-colors ${
            !activeCategory
              ? "bg-accent-light text-accent font-medium"
              : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          {isKo ? "전체 포스트" : "All Posts"}
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
