"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import type { Comment } from "@/types/comments";
import { CommentForm } from "./CommentForm";

export type CommentNode = Comment & {
  children: CommentNode[];
  isPending?: boolean; // Used for optimistic UI
};

interface CommentItemProps {
  node: CommentNode;
  onReply: (parentId: string, content: string) => Promise<void>;
}

export function CommentItem({ node, onReply }: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);

  const handleReplySubmit = async (content: string) => {
    await onReply(node.id, content);
    setIsReplying(false);
  };

  return (
    <div className="mt-6 flex gap-3 text-sm sm:text-base">
      <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0">
        <Image src={node.author.avatar} alt={node.author.name} fill className="object-cover" />
      </div>

      <div className="flex-1">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-text-primary">{node.author.name}</span>
          <span className="text-xs text-text-tertiary">
            {formatDistanceToNow(new Date(node.createdAt), { addSuffix: true })}
          </span>
          {node.isPending && (
            <span className="text-xs text-accent italic">(Posting...)</span>
          )}
        </div>

        <div className="text-text-secondary whitespace-pre-wrap leading-relaxed">
          {node.content}
        </div>

        <div className="mt-2">
          <button
            onClick={() => setIsReplying(!isReplying)}
            className="text-xs font-medium text-text-tertiary hover:text-accent transition-colors"
          >
            Reply
          </button>
        </div>

        {isReplying && (
          <div className="mt-4">
            <CommentForm
              onSubmit={handleReplySubmit}
              placeholder={`Replying to ${node.author.name}...`}
              autoFocus
            />
          </div>
        )}

        {/* Recursive Children Rendering */}
        {node.children && node.children.length > 0 && (
          <div className="mt-2 pl-4 sm:pl-6 border-l border-border/50">
            {node.children.map((child) => (
              <CommentItem key={child.id} node={child} onReply={onReply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
