import type { Post } from "@/types";
import { TerminalConsole } from "./components/TerminalConsole";

interface TerminalSearchPageProps {
  posts: Post[];
  query: string;
  categories: string[];
}

export default function TerminalSearchPage({ posts, query, categories }: TerminalSearchPageProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl mx-auto h-[70vh]">
      <TerminalConsole 
        path={`~/search`} 
        posts={posts} 
        categories={categories} 
        initialCommand={`find "${query}"`}
      />
    </div>
  );
}
