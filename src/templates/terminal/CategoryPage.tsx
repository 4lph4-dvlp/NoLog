import type { Post } from "@/types";
import { TerminalConsole } from "./components/TerminalConsole";

interface TerminalCategoryPageProps {
  posts: Post[];
  displayName: string;
  categories: string[];
}

export default function TerminalCategoryPage({ posts, displayName, categories }: TerminalCategoryPageProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl mx-auto h-[70vh]">
      <TerminalConsole 
        path={`~/${displayName.toLowerCase()}`} 
        posts={posts} 
        categories={categories} 
        initialCommand="ls"
      />
    </div>
  );
}
