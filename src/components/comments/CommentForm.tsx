"use client";

import { useSession, signIn } from "next-auth/react";
import { useState } from "react";
import Image from "next/image";
import { CONFIG } from "@/site.config";

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CommentForm({
  onSubmit,
  placeholder,
  autoFocus,
}: CommentFormProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isKo = CONFIG.site.locale === "ko";
  const finalPlaceholder =
    placeholder || (isKo ? "댓글을 입력하세요..." : "Leave a comment...");

  if (!session) {
    return (
      <div className="p-6 border border-border rounded-lg bg-surface text-center">
        <p className="text-text-secondary mb-4">
          {isKo
            ? "GitHub로 로그인하여 댓글을 남겨보세요."
            : "Log in with GitHub to leave a comment."}
        </p>
        <button
          onClick={() => signIn("github")}
          className="px-4 py-2 bg-text-primary text-surface font-medium rounded hover:opacity-90 transition-opacity"
        >
          {isKo ? "GitHub로 로그인" : "Log in with GitHub"}
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content);
      setContent("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-4 items-start">
      {session.user?.image && (
        <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 mt-1">
          <Image
            src={session.user.image}
            alt={session.user.name || "Avatar"}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className="flex-1">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={finalPlaceholder}
          autoFocus={autoFocus}
          className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-shadow"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="px-4 py-2 bg-text-primary text-surface font-medium rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting
              ? isKo
                ? "작성 중..."
                : "Posting..."
              : isKo
              ? "댓글 작성"
              : "Post Comment"}
          </button>
        </div>
      </div>
    </form>
  );
}
