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
    <>
      <div className="absolute top-4 right-4 md:top-6 md:right-8 z-50">
        <ThemeToggle />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 min-h-screen flex flex-col">
        {children}
      </div>
    </>
  );
}
