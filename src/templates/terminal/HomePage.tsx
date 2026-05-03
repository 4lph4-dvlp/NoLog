"use client";

import type { Post } from "@/types";
import { TerminalConsole } from "./components/TerminalConsole";
import { useEffect } from "react";

interface TerminalHomePageProps {
  posts: Post[];
  categories: string[];
}

export default function TerminalHomePage({ posts, categories }: TerminalHomePageProps) {
  useEffect(() => {
    // Reset last path when at home
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("nolog_last_path");
    }
  }, []);

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
