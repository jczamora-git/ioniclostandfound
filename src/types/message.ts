export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: number;
  status?: 'sent' | 'delivered' | 'read';
}
