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

export interface Message {
  id: string;
  conversationId: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: number;
  status?: 'sent' | 'delivered' | 'read';
}

export interface SocketUser {
  uid: string;
}

export interface CreateConversationPayload {
  postId?: string | null;
  type?: 'post' | 'direct';
  threadId?: string;
  threadType?: 'general' | 'post';
  postTitle?: string;
  postSubtitle?: string;
  postLocation?: string;
  otherUserId: string;
  senderProfile?: {
    name: string;
    username: string;
    avatarUrl?: string | null;
  };
  otherUserProfile?: {
    name: string;
    username: string;
    avatarUrl?: string | null;
  };
}

export interface SendMessagePayload {
  conversationId: string;
  threadId: string;
  text: string;
}

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


