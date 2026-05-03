import type { Post } from "@/types";
import { TerminalConsole } from "./components/TerminalConsole";

interface TerminalHomePageProps {
  posts: Post[];
  categories: string[];
}

export default function TerminalHomePage({ posts, categories }: TerminalHomePageProps) {
  return (
    <div className="flex flex-col flex-1 w-full h-full max-w-6xl mx-auto">
      <TerminalConsole 
        path="~" 
        posts={posts} 
        categories={categories} 
        initialCommand="neofetch"
      />
    </div>
  );
}
