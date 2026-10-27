// src/lib/call-logs.ts
import { supabase } from "@/lib/supabase";

export type CallStatus = "ringing" | "answered" | "declined" | "missed" | "cancelled" | "ended";

export interface CallLog {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  kind: "audio" | "video";
  status: CallStatus;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
}

export async function getCallLogs(conversationId: string): Promise<CallLog[]> {
  const { data, error } = await supabase
    .from("call_logs")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return []; // table missing before the SQL is applied: show no calls
  return (data ?? []) as CallLog[];
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** The line shown inside the chat for a call. */
export function describeCall(log: CallLog, myId: string): { label: string; missed: boolean } {
  const kind = log.kind === "video" ? "Βιντεοκλήση" : "Ηχητική κλήση";
  const iCalled = log.caller_id === myId;

  if (log.answered_at) {
    if (!log.ended_at) return { label: `${kind} σε εξέλιξη`, missed: false };
    const secs = (new Date(log.ended_at).getTime() - new Date(log.answered_at).getTime()) / 1000;
    return { label: `${kind} · ${formatDuration(secs)}`, missed: false };
  }
  if (log.status === "declined") {
    return { label: iCalled ? "Η κλήση απορρίφθηκε" : "Απέρριψες την κλήση", missed: false };
  }
  // still "ringing" after a minute = nobody picked up
  const stale = log.status === "ringing" && Date.now() - new Date(log.created_at).getTime() < 60_000;
  if (stale) return { label: `${kind}…`, missed: false };
  return { label: iCalled ? "Δεν απάντησε" : "Αναπάντητη κλήση", missed: !iCalled };
}