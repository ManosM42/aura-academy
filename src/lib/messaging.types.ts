// src/lib/messaging.types.ts
import type { Profile } from "@/lib/database.types";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export type ConversationOtherUser = Pick<
  Profile,
  "id" | "full_name" | "avatar_url" | "role"
>;

export interface ConversationSummary {
  conversationId: string;
  otherUser: ConversationOtherUser | null;
  lastMessage: Message | null;
  unread: boolean;
}

export interface TypingBroadcastPayload {
  user_id: string;
  is_typing: boolean;
}