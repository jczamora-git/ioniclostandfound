export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
