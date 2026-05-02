import { Octokit } from "@octokit/rest";
import type { Comment } from "@/types/comments";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const owner = process.env.GITHUB_OWNER as string;
const repo = process.env.GITHUB_REPO as string;

export async function getComments(postId: string): Promise<Comment[]> {
  // Return empty array if GitHub is not configured
  if (!owner || !repo) {
    return [];
  }

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: `data/comments/${postId}.json`,
    });

    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return JSON.parse(content) as Comment[];
    }
    return [];
  } catch (error: any) {
    // If the file doesn't exist, return empty array
    if (error.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function addComment(postId: string, comment: Comment): Promise<Comment> {
  const path = `data/comments/${postId}.json`;
  let comments: Comment[] = [];
  let sha: string | undefined;

  // 1. Fetch existing file to get the current content and SHA
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ("content" in data) {
      sha = data.sha;
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      comments = JSON.parse(content) as Comment[];
    }
  } catch (error: any) {
    if (error.status !== 404) {
      throw error;
    }
  }

  // 2. Append new comment
  comments.push(comment);

  // 3. Serialize and commit back to GitHub
  const newContent = Buffer.from(JSON.stringify(comments, null, 2)).toString("base64");

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `Add comment to post: ${postId}`,
    content: newContent,
    sha, // required if updating an existing file
  });

  return comment;
}
