"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Dark / Light mode toggle button.
 * Renders a Sun (light) or Moon (dark) icon from lucide-react.
 * Uses useEffect + mounted guard to avoid hydration mismatches.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Prevent hydration mismatch — render a placeholder with matching dimensions
    return (
      <button
        className="p-2 rounded-md bg-surface hover:bg-surface-hover transition-colors"
        aria-label="Toggle theme"
      >
        <div className="w-[18px] h-[18px]" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-md bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-[18px] h-[18px] text-text-secondary" />
      ) : (
        <Moon className="w-[18px] h-[18px] text-text-secondary" />
      )}
    </button>
  );
}
