"use client";

import type { Post } from "@/types";
import { TerminalConsole } from "./components/TerminalConsole";
import { useEffect } from "react";

interface TerminalCategoryPageProps {
  posts: Post[];
  displayName: string;
  categories: string[];
}

export default function TerminalCategoryPage({ posts, displayName, categories }: TerminalCategoryPageProps) {
  const path = `~/${displayName.toLowerCase()}`;

  useEffect(() => {
    // Store the last visited category path for smart 'clear' redirection
    if (typeof window !== "undefined") {
      sessionStorage.setItem("nolog_last_path", `/category/${displayName.toLowerCase().replace(/\s+/g, "-")}`);
    }
  }, [displayName]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-6xl mx-auto h-[70vh]">
      <TerminalConsole 
        path={path} 
        posts={posts} 
        categories={categories} 
        initialCommand="ls"
      />
    </div>
  );
}
