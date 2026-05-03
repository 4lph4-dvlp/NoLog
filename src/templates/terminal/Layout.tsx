import { Profile } from "@/components/Profile";
import { ThemeToggle } from "@/components/ThemeToggle";

interface TerminalLayoutProps {
  children: React.ReactNode;
}

/**
 * Terminal Template Layout.
 * Strips away standard navigation sidebars to emphasize the terminal console.
 * Uses a single column layout or a slight offset depending on the page.
 */
export default function TerminalLayout({ children }: TerminalLayoutProps) {
  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-300 font-mono flex flex-col selection:bg-emerald-900 selection:text-emerald-100">
      <div className="absolute top-4 right-4 md:top-6 md:right-8 z-50">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col w-full h-full">
        {children}
      </div>
    </div>
  );
}
