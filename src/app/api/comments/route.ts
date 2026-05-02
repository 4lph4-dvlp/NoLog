import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { addComment } from "@/lib/github";
import { v4 as uuidv4 } from "uuid";
import type { Comment } from "@/types/comments";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { postId, parentId, content } = body;

    if (!postId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newComment: Comment = {
      id: uuidv4(),
      postId,
      parentId: parentId || null,
      author: {
        name: session.user.name || "Anonymous",
        avatar: session.user.image || "",
      },
      content,
      createdAt: new Date().toISOString(),
    };

    // Note: This API call can take 1-3 seconds as it reads and commits to GitHub
    const savedComment = await addComment(postId, newComment);

    return NextResponse.json(savedComment, { status: 201 });
  } catch (error: any) {
    console.error("[Comments API Error]", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
