"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CONFIG } from "@/site.config";
import type { Post } from "@/types";

interface TerminalConsoleProps {
  path: string;
  posts: Post[];
  categories: string[];
  initialCommand?: string;
  onClear?: () => void;
}

interface CommandHistory {
  command: string;
  output: React.ReactNode;
}

export function TerminalConsole({
  path,
  posts,
  categories,
  initialCommand,
  onClear,
}: TerminalConsoleProps) {
  const router = useRouter();
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Keep focus on input when clicking the terminal area
  const handleTerminalClick = () => {
    if (!isTyping) {
      inputRef.current?.focus();
    }
  };

  // Auto-typing effect for initial command
  useEffect(() => {
    if (!initialCommand) return;

    // Prevent 'find' recursion on search page
    if (path === "~/search" && initialCommand.startsWith("find")) {
      setHistory([{ command: initialCommand, output: printLs() }]);
      return;
    }

    let currentIndex = 0;
    setIsTyping(true);

    const typeChar = () => {
      if (currentIndex < initialCommand.length) {
        setInput(initialCommand.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(typeChar, 50); // Typing speed
      } else {
        setTimeout(() => {
          handleCommand(initialCommand);
          setInput("");
          setIsTyping(false);
        }, 300); // Wait before executing
      }
    };

    setTimeout(typeChar, 400); // Initial delay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCommand]);

  const printHelp = () => (
    <div className="text-terminal-dim">
      <p>Available commands:</p>
      <ul className="mt-1 ml-4 space-y-1">
        <li><span className="text-terminal-accent">neofetch</span>: Display system info</li>
        <li><span className="text-terminal-accent">help</span>    : Show this help message</li>
        <li><span className="text-terminal-accent">ls</span>      : List posts in current directory</li>
        <li><span className="text-terminal-accent">tree</span>    : Show category and post structure</li>
        <li><span className="text-terminal-accent">cd</span>      : Change directory (e.g., cd [category], cd ~)</li>
        <li><span className="text-terminal-accent">cat</span>     : Read a post by index (e.g., cat 1)</li>
        <li><span className="text-terminal-accent">find</span>    : Search posts (e.g., find "keyword")</li>
        <li><span className="text-terminal-accent">clear</span>   : Clear terminal output</li>
      </ul>
    </div>
  );

  const printNeofetch = () => {
    const { profile } = CONFIG;
    return (
      <div className="flex flex-col sm:flex-row gap-6 items-start text-terminal-text my-4">
        {/* ASCII Art / Image */}
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 shrink-0 border border-terminal-border bg-terminal-bg rounded-md overflow-hidden">
          <Image
            src={profile.avatarUrl}
            alt={profile.name}
            fill
            className="object-cover opacity-90"
            sizes="(max-width: 768px) 128px, 160px"
          />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 w-full">
          <p className="text-terminal-prompt font-bold text-lg mb-1">guest@{profile.name.toLowerCase()}-bl0g</p>
          <div className="w-full max-w-sm h-px bg-terminal-border mb-2"></div>
          <p><span className="text-terminal-prompt font-semibold w-24 inline-block">OS:</span> NoLog (Terminal Theme)</p>
          <p><span className="text-terminal-prompt font-semibold w-24 inline-block">Host:</span> 4lph4</p>
          <p><span className="text-terminal-prompt font-semibold w-24 inline-block">Uptime:</span> Always on</p>
          <p><span className="text-terminal-prompt font-semibold w-24 inline-block">Packages:</span> {posts.length} (posts)</p>
          <p><span className="text-terminal-prompt font-semibold w-24 inline-block">Bio:</span> {profile.bio}</p>
          {profile.greeting && (
            <p className="mt-2 text-terminal-dim italic">"{profile.greeting}"</p>
          )}
          <div className="flex gap-2 mt-3">
            <div className="w-4 h-4 bg-zinc-950"></div>
            <div className="w-4 h-4 bg-red-500"></div>
            <div className="w-4 h-4 bg-green-500"></div>
            <div className="w-4 h-4 bg-yellow-500"></div>
            <div className="w-4 h-4 bg-blue-500"></div>
            <div className="w-4 h-4 bg-purple-500"></div>
            <div className="w-4 h-4 bg-cyan-500"></div>
            <div className="w-4 h-4 bg-zinc-100"></div>
          </div>
          <p className="mt-4 text-terminal-dim text-xs">Type <span className="text-terminal-accent">help</span> to see available commands.</p>
        </div>
      </div>
    );
  };

  const printLs = () => {
    if (posts.length === 0) {
      return <div className="text-terminal-dim">No posts found.</div>;
    }
    return (
      <ul className="space-y-1">
        {posts.map((post, index) => (
          <li key={post.id} className="flex gap-2">
            <span className="text-terminal-dim w-8">[{index + 1}]</span>
            <Link
              href={`/post/${post.id}`}
              className="text-terminal-text hover:text-terminal-accent hover:underline decoration-terminal-accent/50 underline-offset-4"
            >
              {post.title}
            </Link>
            <span className="text-terminal-dim text-xs self-center hidden sm:inline">
              ({new Date(post.createDate).toISOString().split("T")[0]})
            </span>
          </li>
        ))}
      </ul>
    );
  };

  const printTree = () => {
    return (
      <div className="text-terminal-text">
        <div>.</div>
        {categories.map((cat, catIndex) => {
          const isLastCat = catIndex === categories.length - 1;
          const catPrefix = isLastCat ? "└── " : "├── ";
          const childPrefix = isLastCat ? "    " : "│   ";
          const catPosts = posts.filter((p) => p.category === cat);

          return (
            <div key={cat}>
              <div className="flex gap-2">
                <span className="text-terminal-dim">{catPrefix}</span>
                <Link
                  href={`/category/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-terminal-accent font-semibold hover:underline"
                >
                  {cat}
                </Link>
              </div>
              {catPosts.map((post, postIndex) => {
                const isLastPost = postIndex === catPosts.length - 1;
                const postPrefix = isLastPost ? "└── " : "├── ";
                return (
                  <div key={post.id} className="flex gap-2">
                    <span className="text-terminal-dim whitespace-pre">{childPrefix}{postPrefix}</span>
                    <Link
                      href={`/post/${post.id}`}
                      className="text-terminal-text hover:text-terminal-accent hover:underline truncate max-w-[calc(100%-4rem)]"
                    >
                      {post.title}
                    </Link>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const handleCommand = (cmdStr: string) => {
    const trimmedCmd = cmdStr.trim();
    if (!trimmedCmd) return;

    let output: React.ReactNode = null;
    const args = trimmedCmd.split(" ").filter(Boolean);
    const command = args[0].toLowerCase();

    switch (command) {
      case "help":
        output = printHelp();
        break;
      case "neofetch":
        output = printNeofetch();
        break;
      case "clear":
        setHistory([]);
        onClear?.();
        return;
      case "ls":
        output = printLs();
        break;
      case "tree":
        output = printTree();
        break;
      case "cd":
        const target = args[1];
        if (!target || target === "~") {
          router.push("/");
          output = <div className="text-terminal-dim">Navigating to ~ ...</div>;
        } else if (target === "..") {
          router.push("/");
          output = <div className="text-terminal-dim">Navigating to ~ ...</div>;
        } else {
          const catSlug = target.toLowerCase();
          const exists = categories.some(
            (c) => c.toLowerCase().replace(/\s+/g, "-") === catSlug || c.toLowerCase() === catSlug
          );
          if (exists) {
            router.push(`/category/${catSlug}`);
            output = <div className="text-terminal-dim">Navigating to category: {target} ...</div>;
          } else {
            output = <div className="text-error">cd: no such file or directory: {target}</div>;
          }
        }
        break;
      case "cat":
        const indexStr = args[1];
        if (!indexStr) {
          output = <div className="text-error">cat: missing index. Usage: cat [number]</div>;
        } else {
          const index = parseInt(indexStr, 10);
          if (isNaN(index) || index < 1 || index > posts.length) {
            output = <div className="text-error">cat: invalid index: {indexStr}</div>;
          } else {
            const post = posts[index - 1];
            router.push(`/post/${post.id}`);
            output = <div className="text-terminal-dim">Reading {post.title}.md ...</div>;
          }
        }
        break;
      case "find":
        const query = args.slice(1).join(" ").replace(/["']/g, "");
        if (!query) {
          output = <div className="text-error">find: missing keyword. Usage: find "keyword"</div>;
        } else {
          router.push(`/search?q=${encodeURIComponent(query)}`);
          output = <div className="text-terminal-dim">Searching for "{query}" ...</div>;
        }
        break;
      default:
        output = <div className="text-error">bash: command not found: {command}</div>;
    }

    setHistory((prev) => [...prev, { command: trimmedCmd, output }]);
  };

  return (
    <div
      className="w-full flex-1 bg-transparent text-terminal-text font-mono text-sm sm:text-base cursor-text overflow-hidden flex flex-col"
      onClick={handleTerminalClick}
    >
      {/* Output History */}
      <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-8">
        {history.map((h, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 text-terminal-dim">
              <span className="text-terminal-prompt font-bold">~{path}</span>
              <span className="text-terminal-dim">$</span>
              <span className="text-terminal-text">{h.command}</span>
            </div>
            <div className="mt-1">{h.output}</div>
          </div>
        ))}

        {/* Active Input Line */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-terminal-prompt font-bold shrink-0">~{path}</span>
          <span className="text-terminal-dim shrink-0">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isTyping) {
                handleCommand(input);
                setInput("");
              }
            }}
            disabled={isTyping}
            className="flex-1 bg-transparent outline-none border-none text-terminal-text focus:ring-0 p-0 disabled:bg-transparent disabled:opacity-100"
            autoFocus
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
