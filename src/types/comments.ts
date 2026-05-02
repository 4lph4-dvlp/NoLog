export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  author: {
    name: string;
    avatar: string;
  };
  content: string;
  createdAt: string; // ISO 8601 string
}
