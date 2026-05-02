"use client";

import { Search as SearchIcon } from "lucide-react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Search bar component.
 * On mobile it appears between Profile and Category list.
 * Currently performs client-side navigation to a search results page.
 */
export function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (trimmed) {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [query, router]
  );

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search posts..."
        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg
          bg-surface border border-border
          text-text-primary placeholder:text-text-tertiary
          focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
          transition-all"
      />
    </form>
  );
}
