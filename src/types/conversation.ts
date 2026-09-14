import type { Post } from './post';
import type { Profile } from './profile';

export interface Conversation {
  id: string;
  postId: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
  lastMessageSenderId?: string;
}

export interface ConversationWithMeta extends Conversation {
  otherParticipant?: Profile | null;
  post?: Post | null;
  unread?: boolean;
}
