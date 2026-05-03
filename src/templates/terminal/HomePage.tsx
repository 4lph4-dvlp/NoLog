import type { Post } from "@/types";
import { TerminalConsole } from "./components/TerminalConsole";
import Image from "next/image";
import { CONFIG } from "@/site.config";

interface TerminalHomePageProps {
  posts: Post[];
  categories: string[];
}

export default function TerminalHomePage({ posts, categories }: TerminalHomePageProps) {
  const { profile } = CONFIG;

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start justify-center flex-1 w-full max-w-6xl mx-auto">
      {/* Neofetch-style Profile (Left side on desktop) */}
      <div className="w-full md:w-1/3 flex flex-col items-center md:items-start text-zinc-300 font-mono text-sm shrink-0">
        <div className="relative w-40 h-40 md:w-48 md:h-48 mb-6 overflow-hidden rounded-lg shadow-lg border border-zinc-700 bg-zinc-800 p-2">
           <div className="relative w-full h-full rounded-md overflow-hidden bg-zinc-900">
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 160px, 192px"
                priority
              />
           </div>
        </div>
        
        <div className="flex flex-col gap-1 w-full max-w-sm">
          <p className="text-emerald-400 font-bold text-lg mb-2">guest@{profile.name}-os</p>
          <div className="w-full h-px bg-zinc-700 mb-2"></div>
          <p><span className="text-emerald-400 font-semibold">OS:</span> NoLog (Terminal Edition)</p>
          <p><span className="text-emerald-400 font-semibold">Host:</span> Vercel</p>
          <p><span className="text-emerald-400 font-semibold">Uptime:</span> Always on</p>
          <p><span className="text-emerald-400 font-semibold">Packages:</span> {posts.length} (posts)</p>
          <p><span className="text-emerald-400 font-semibold">Bio:</span> {profile.bio}</p>
          {profile.greeting && (
            <p className="mt-2 text-zinc-400 italic">"{profile.greeting}"</p>
          )}
        </div>
      </div>

      {/* Terminal Console (Right side on desktop) */}
      <div className="w-full md:w-2/3 h-[60vh] md:h-[70vh] flex">
        <TerminalConsole 
          path="~" 
          posts={posts} 
          categories={categories} 
          initialCommand="help"
        />
      </div>
    </div>
  );
}
