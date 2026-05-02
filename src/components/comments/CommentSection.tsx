"use client";

import { useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSession } from "next-auth/react";
import type { Comment } from "@/types/comments";
import { CommentNode, CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";

interface CommentSectionProps {
  postId: string;
  initialComments: Comment[];
}

export function CommentSection({ postId, initialComments }: CommentSectionProps) {
  const { data: session } = useSession();
  const [pendingComments, setPendingComments] = useState<Comment[]>([]);

  // Load pending comments from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`pending_comments_${postId}`);
    if (stored) {
      try {
        setPendingComments(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse pending comments", e);
      }
    }
  }, [postId]);

  // Merge server comments and pending comments, then build tree
  const tree = useMemo(() => {
    // 1. Remove pending comments that have already been confirmed by the server
    const serverIds = new Set(initialComments.map((c) => c.id));
    const activePending = pendingComments.filter((pc) => !serverIds.has(pc.id));

    // Update localStorage if pending comments were resolved
    if (activePending.length !== pendingComments.length) {
      if (activePending.length === 0) {
        localStorage.removeItem(`pending_comments_${postId}`);
      } else {
        localStorage.setItem(`pending_comments_${postId}`, JSON.stringify(activePending));
      }
      setPendingComments(activePending);
    }

    // 2. Combine them
    const allComments: CommentNode[] = [
      ...initialComments.map((c) => ({ ...c, children: [] })),
      ...activePending.map((c) => ({ ...c, children: [], isPending: true })),
    ];

    // 3. Build tree
    const rootNodes: CommentNode[] = [];
    const map = new Map<string, CommentNode>();

    allComments.forEach((c) => map.set(c.id, c));

    allComments.forEach((c) => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(c);
      } else {
        rootNodes.push(c);
      }
    });

    // Sort root nodes chronologically (newest first or oldest first? let's do oldest first)
    rootNodes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return rootNodes;
  }, [initialComments, pendingComments, postId]);

  const handlePostComment = async (parentId: string | null, content: string) => {
    if (!session || !session.user) return;

    // 1. Optimistic UI insertion
    const optimisticComment: Comment = {
      id: uuidv4(),
      postId,
      parentId,
      content,
      author: {
        name: session.user.name || "Anonymous",
        avatar: session.user.image || "",
      },
      createdAt: new Date().toISOString(),
    };

    const newPending = [...pendingComments, optimisticComment];
    setPendingComments(newPending);
    localStorage.setItem(`pending_comments_${postId}`, JSON.stringify(newPending));

    // 2. Fire actual API request
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, parentId, content }),
      });

      if (!res.ok) {
        throw new Error("Failed to post comment");
      }
      
      // Note: We don't remove from pending here because the server response 
      // doesn't trigger an ISR page refresh. The pending comment will stay in 
      // localStorage (showing "(Posting...)") until the page is naturally revalidated 
      // or the user refreshes later.
    } catch (error) {
      console.error(error);
      // Rollback optimistic update
      const rollback = pendingComments.filter((c) => c.id !== optimisticComment.id);
      setPendingComments(rollback);
      localStorage.setItem(`pending_comments_${postId}`, JSON.stringify(rollback));
      alert("Failed to post comment. Please try again.");
    }
  };

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <h3 className="text-2xl font-bold text-text-primary mb-8">Comments</h3>

      <div className="mb-10">
        <CommentForm onSubmit={(content) => handlePostComment(null, content)} />
      </div>

      <div className="space-y-6">
        {tree.length > 0 ? (
          tree.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              onReply={(parentId, content) => handlePostComment(parentId, content)}
            />
          ))
        ) : (
          <p className="text-text-tertiary text-center py-8">
            No comments yet. Be the first to share your thoughts!
          </p>
        )}
      </div>
    </section>
  );
}
