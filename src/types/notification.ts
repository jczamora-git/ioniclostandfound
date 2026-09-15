export interface AppNotification {
  id: string;
  type: 'comment' | 'reply';
  actorId: string;
  actorName: string;
  actorUsername?: string;
  actorAvatarUrl?: string | null;
  postId: string;
  postTitle?: string;
  commentId?: string;
  text: string;
  createdAt: number;
  read: boolean;
}
