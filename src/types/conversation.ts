import type { Post } from './post';
import type { Profile } from './profile';

export interface ConversationThread {
  id: string; // 'general' | 'post_<postId>'
  conversationId: string;
  type: 'general' | 'post';
  postId?: string | null;
  title: string;
  postSubtitle?: string;
  postType?: 'lost' | 'found';
  postLocation?: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
  lastMessageSenderId?: string;
  unreadCounts?: Record<string, number>;
}

export interface Conversation {
  id: string;
  postId?: string | null;
  type?: 'post' | 'direct';
  participantIds: string[];
  participantDetails?: Record<
    string,
    {
      name: string;
      username: string;
      avatarUrl?: string | null;
    }
  >;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
  lastMessageSenderId?: string;
  lastMessageThreadId?: string;
  lastMessageThreadTitle?: string;
  unreadCounts?: Record<string, number>;
  threads?: Record<string, ConversationThread>;
}

export interface ConversationWithMeta extends Conversation {
  otherParticipant?: Profile | null;
  post?: Post | null;
  unread?: boolean;
  unreadCount?: number;
  threadsList?: ConversationThread[];
}
