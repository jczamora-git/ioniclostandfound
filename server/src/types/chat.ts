export interface Conversation {
  id: string;
  postId?: string | null;
  type?: 'post' | 'direct';
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
  lastMessageSenderId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
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
  otherUserId: string;
}

export interface SendMessagePayload {
  conversationId: string;
  text: string;
}
