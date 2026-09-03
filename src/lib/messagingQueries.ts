// src/lib/messagingQueries.ts
import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/queries";
import type { Profile } from "@/lib/database.types";
import type { ConversationOtherUser, ConversationSummary, Message } from "@/lib/messaging.types";

// --- Profile lookup (για το UserProfileModal) ----------------

export async function getProfileById(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

// --- Δημιουργία / εύρεση 1:1 συνομιλίας -----------------------

export async function getOrCreateDirectConversation(
  otherUserId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "get_or_create_direct_conversation",
    { other_user_id: otherUserId },
  );
  if (error) throw error;
  return data as string;
}

// --- Λίστα συνομιλιών (δεξί panel στο /messages) --------------

export async function getMyConversations(): Promise<ConversationSummary[]> {
  const uid = await getCurrentUserId();

  const { data: myRows, error: myErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", uid);
  if (myErr) throw myErr;

  const convIds = (myRows ?? []).map((r) => r.conversation_id as string);
  if (convIds.length === 0) return [];

  const [{ data: others, error: othErr }, { data: msgs, error: msgErr }] =
    await Promise.all([
      supabase
        .from("conversation_participants")
        .select("conversation_id, profiles(id, full_name, avatar_url, role)")
        .in("conversation_id", convIds)
        .neq("user_id", uid),
      supabase
        .from("messages")
        .select("*")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false }),
    ]);
  if (othErr) throw othErr;
  if (msgErr) throw msgErr;

  const lastReadByConv = new Map<string, string | null>(
    (myRows ?? []).map((r) => [
      r.conversation_id as string,
      r.last_read_at as string | null,
    ]),
  );

  const otherByConv = new Map<string, ConversationOtherUser>();
  for (const row of (others ?? []) as unknown as {
    conversation_id: string;
    profiles: ConversationOtherUser | null;
  }[]) {
    if (row.profiles) otherByConv.set(row.conversation_id, row.profiles);
  }

  const lastMsgByConv = new Map<string, Message>();
  for (const m of (msgs ?? []) as Message[]) {
    if (!lastMsgByConv.has(m.conversation_id)) {
      lastMsgByConv.set(m.conversation_id, m);
    }
  }

  return convIds
    .map((id) => {
      const lastMessage = lastMsgByConv.get(id) ?? null;
      const lastRead = lastReadByConv.get(id);
      const unread =
        !!lastMessage &&
        lastMessage.sender_id !== uid &&
        (!lastRead || new Date(lastMessage.created_at) > new Date(lastRead));
      return {
        conversationId: id,
        otherUser: otherByConv.get(id) ?? null,
        lastMessage,
        unread,
      };
    })
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ?? "";
      const bt = b.lastMessage?.created_at ?? "";
      return bt.localeCompare(at);
    });
}

// --- Μηνύματα μιας συνομιλίας ---------------------------------

export async function getConversationMessages(
  conversationId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<Message> {
  const uid = await getCurrentUserId();
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Το μήνυμα είναι κενό.");
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: uid,
      content: trimmed,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", uid);
  if (error) throw error;
}