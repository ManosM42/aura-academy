// src/lib/useEliteChat.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";

// The new tables are not in the generated types yet, so use an untyped client.
const sb = db as unknown as SupabaseClient;

export const BUCKET = "elite-chat";
export const PAGE_SIZE = 40;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SELECT = "*, reactions:elite_reactions(user_id, emoji)";
const TYPING_TTL_MS = 4000;

export interface Reaction {
  user_id: string;
  emoji: string;
}

export interface EliteMessage {
  id: string;
  user_id: string;
  body: string;
  reply_to: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reactions: Reaction[];
  pending?: boolean;
  fresh?: boolean;
}

export interface Member {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export function displayName(m?: Member | null): string {
  return m?.full_name?.trim() || m?.username || "Member";
}

function sortMessages(list: EliteMessage[]): EliteMessage[] {
  return [...list].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string") {
    return (e as any).message as string;
  }
  return fallback;
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
}

export function useEliteChat(meId: string) {
  const [messages, setMessages] = useState<EliteMessage[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [reads, setReads] = useState<Record<string, string>>({});
  const [initialRead, setInitialRead] = useState<string | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [typing, setTyping] = useState<Record<string, { name: string; at: number }>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const messagesRef = useRef<EliteMessage[]>([]);
  const membersRef = useRef<Record<string, Member>>({});
  const urlsRef = useRef<Record<string, string>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);
  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  /* ------------------------------ helpers ------------------------------ */

  const ensureProfiles = useCallback(async (ids: string[]) => {
    const missing = Array.from(new Set(ids)).filter(
      (id) => !membersRef.current[id] && !requestedRef.current.has(id),
    );
    if (missing.length === 0) return;
    missing.forEach((id) => requestedRef.current.add(id));
    const { data } = await sb.rpc("elite_profiles", { p_ids: missing });
    if (!data) return;
    setMembers((prev) => {
      const next = { ...prev };
      for (const row of data as Member[]) next[row.id] = row;
      return next;
    });
  }, []);

  const ensureUrls = useCallback(async (list: EliteMessage[]) => {
    const paths = Array.from(
      new Set(
        list
          .map((m) => m.attachment_path)
          .filter((p): p is string => Boolean(p) && !urlsRef.current[p as string]),
      ),
    );
    if (paths.length === 0) return;
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (!data) return;
    setUrls((prev) => {
      const next = { ...prev };
      for (const row of data) {
        if (row.path && row.signedUrl) next[row.path] = row.signedUrl;
      }
      return next;
    });
  }, []);

  /* ----------------------------- initial load ---------------------------- */

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      const [msgRes, memRes, readRes] = await Promise.all([
        sb
          .from("elite_messages")
          .select(SELECT)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE),
        sb.rpc("elite_members"),
        sb.from("elite_reads").select("user_id, last_read_at"),
      ]);
      if (cancelled) return;

      if (msgRes.error) {
        setError(msgRes.error.message);
        setLoading(false);
        return;
      }

      const rows = ((msgRes.data ?? []) as EliteMessage[]).slice().reverse();
      setMessages(rows);
      setHasMore((msgRes.data ?? []).length === PAGE_SIZE);

      const memberRows = (memRes.data ?? []) as Member[];
      const map: Record<string, Member> = {};
      for (const m of memberRows) map[m.id] = m;
      memberRows.forEach((m) => requestedRef.current.add(m.id));
      setMembers(map);
      setMemberIds(memberRows.map((m) => m.id));

      const readMap: Record<string, string> = {};
      for (const r of (readRes.data ?? []) as { user_id: string; last_read_at: string }[]) {
        readMap[r.user_id] = r.last_read_at;
      }
      setReads(readMap);
      setInitialRead(readMap[meId] ?? null);

      membersRef.current = map;
      void ensureProfiles(rows.map((m) => m.user_id));
      void ensureUrls(rows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [meId, ensureProfiles, ensureUrls]);

  /* ----------------------- realtime: database changes ---------------------- */

  useEffect(() => {
    const channel = sb
      .channel(`elite-db-${meId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "elite_messages" }, (p: any) => {
        const row = p.new as EliteMessage;
        setMessages((prev) =>
          prev.some((m) => m.id === row.id)
            ? prev
            : sortMessages([...prev, { ...row, reactions: [], fresh: true }]),
        );
        setTyping((t) => {
          if (!t[row.user_id]) return t;
          const next = { ...t };
          delete next[row.user_id];
          return next;
        });
        void ensureProfiles([row.user_id]);
        void ensureUrls([row]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "elite_messages" }, (p: any) => {
        const row = p.new as EliteMessage;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === row.id
              ? {
                  ...m,
                  body: row.body,
                  edited_at: row.edited_at,
                  deleted_at: row.deleted_at,
                  attachment_path: row.attachment_path,
                  attachment_name: row.attachment_name,
                  attachment_type: row.attachment_type,
                  attachment_size: row.attachment_size,
                  reactions: row.deleted_at ? [] : m.reactions,
                  fresh: false,
                }
              : m,
          ),
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "elite_reactions" }, (p: any) => {
        if (p.eventType === "DELETE") {
          const old = p.old as { message_id?: string; user_id?: string };
          if (!old.message_id || !old.user_id) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === old.message_id
                ? { ...m, reactions: m.reactions.filter((r) => r.user_id !== old.user_id) }
                : m,
            ),
          );
          return;
        }
        const r = p.new as { message_id: string; user_id: string; emoji: string };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === r.message_id
              ? {
                  ...m,
                  reactions: [
                    ...m.reactions.filter((x) => x.user_id !== r.user_id),
                    { user_id: r.user_id, emoji: r.emoji },
                  ],
                }
              : m,
          ),
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "elite_reads" }, (p: any) => {
        const r = p.new as { user_id?: string; last_read_at?: string };
        if (!r?.user_id || !r.last_read_at) return;
        setReads((prev) => ({ ...prev, [r.user_id as string]: r.last_read_at as string }));
      })
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [meId, ensureProfiles, ensureUrls]);

  /* -------------- realtime: typing + presence (private channel) ------------- */

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    void (async () => {
      try {
        await sb.realtime.setAuth();
      } catch {
        /* supabase-js sets auth itself on most versions */
      }
      if (cancelled) return;

      channel = sb.channel("elite-community", {
        config: { private: true, broadcast: { self: false }, presence: { key: meId } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          setOnline(Object.keys(channel?.presenceState() ?? {}));
        })
        .on("broadcast", { event: "typing" }, ({ payload }: any) => {
          const id = payload?.user_id as string | undefined;
          if (!id || id === meId) return;
          setTyping((t) => ({
            ...t,
            [id]: { name: String(payload?.name || "Someone"), at: Date.now() },
          }));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel?.track({ at: Date.now() });
          }
        });

      channelRef.current = channel;
    })();

    const sweep = window.setInterval(() => {
      const now = Date.now();
      setTyping((t) => {
        const entries = Object.entries(t);
        const alive = entries.filter(([, v]) => now - v.at < TYPING_TTL_MS);
        return alive.length === entries.length ? t : Object.fromEntries(alive);
      });
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(sweep);
      if (channel) void sb.removeChannel(channel);
      channelRef.current = null;
    };
  }, [meId]);

  /* ------------------------------- read / seen ------------------------------ */

  const lastMark = useRef(0);
  const markTimer = useRef<number | undefined>(undefined);

  const markRead = useCallback(() => {
    const run = async () => {
      lastMark.current = Date.now();
      const { error: e } = await sb.rpc("mark_elite_read");
      if (!e) setReads((r) => ({ ...r, [meId]: new Date().toISOString() }));
    };
    const since = Date.now() - lastMark.current;
    if (since >= 1500) {
      void run();
    } else if (markTimer.current === undefined) {
      markTimer.current = window.setTimeout(() => {
        markTimer.current = undefined;
        void run();
      }, 1500 - since);
    }
  }, [meId]);

  useEffect(
    () => () => {
      if (markTimer.current !== undefined) window.clearTimeout(markTimer.current);
    },
    [],
  );

  /* -------------------------------- typing --------------------------------- */

  const lastTyping = useRef(0);
  const notifyTyping = useCallback(
    (name: string) => {
      const now = Date.now();
      if (now - lastTyping.current < 2500) return;
      lastTyping.current = now;
      void channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: meId, name },
      });
    },
    [meId],
  );

  /* -------------------------------- actions --------------------------------- */

  const send = useCallback(
    async (opts: { body: string; replyTo?: string | null; file?: File | null }): Promise<boolean> => {
      const body = opts.body.trim();
      const file = opts.file ?? null;
      if (!body && !file) return false;
      if (file && file.size > MAX_FILE_BYTES) {
        setActionError("Files can be up to 10 MB.");
        return false;
      }

      setSending(true);
      setActionError(null);

      const tempId = `tmp-${crypto.randomUUID()}`;
      const temp: EliteMessage = {
        id: tempId,
        user_id: meId,
        body,
        reply_to: opts.replyTo ?? null,
        attachment_path: null,
        attachment_name: file?.name ?? null,
        attachment_type: file?.type ?? null,
        attachment_size: file?.size ?? null,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        reactions: [],
        pending: true,
        fresh: true,
      };
      setMessages((prev) => [...prev, temp]);

      let uploadedPath: string | null = null;
      try {
        if (file) {
          uploadedPath = `${meId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeFileName(file.name)}`;
          const up = await sb.storage.from(BUCKET).upload(uploadedPath, file, {
            contentType: file.type || undefined,
            upsert: false,
          });
          if (up.error) throw up.error;
        }

        const { data, error: insertError } = await sb
          .from("elite_messages")
          .insert({
            user_id: meId,
            body,
            reply_to: opts.replyTo ?? null,
            attachment_path: uploadedPath,
            attachment_name: file?.name ?? null,
            attachment_type: file?.type ?? null,
            attachment_size: file?.size ?? null,
          })
          .select(SELECT)
          .single();
        if (insertError) throw insertError;

        const real = { ...(data as EliteMessage), fresh: true };
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== tempId);
          return without.some((m) => m.id === real.id) ? without : sortMessages([...without, real]);
        });
        void ensureUrls([real]);
        return true;
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (uploadedPath) void sb.storage.from(BUCKET).remove([uploadedPath]);
        setActionError(errMessage(e, "Your message could not be sent."));
        return false;
      } finally {
        setSending(false);
      }
    },
    [meId, ensureUrls],
  );

  const edit = useCallback(async (id: string, body: string): Promise<boolean> => {
    const text = body.trim();
    const before = messagesRef.current.find((m) => m.id === id);
    if (!before) return false;
    if (!text && !before.attachment_path) return false;
    if (text === before.body) return true;

    setActionError(null);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, body: text, edited_at: new Date().toISOString() } : m)),
    );
    const { error: e } = await sb.rpc("edit_elite_message", { p_id: id, p_body: text });
    if (e) {
      setMessages((prev) => prev.map((m) => (m.id === id ? before : m)));
      setActionError(errMessage(e, "Could not edit the message."));
      return false;
    }
    return true;
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const before = messagesRef.current.find((m) => m.id === id);
    if (!before) return false;

    setActionError(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, body: "", deleted_at: new Date().toISOString(), attachment_path: null, reactions: [] }
          : m,
      ),
    );
    const { data, error: e } = await sb.rpc("delete_elite_message", { p_id: id });
    if (e) {
      setMessages((prev) => prev.map((m) => (m.id === id ? before : m)));
      setActionError(errMessage(e, "Could not delete the message."));
      return false;
    }
    if (typeof data === "string" && data) {
      void sb.storage.from(BUCKET).remove([data]);
    }
    return true;
  }, []);

  const react = useCallback(
    async (id: string, emoji: string) => {
      const before = messagesRef.current.find((m) => m.id === id);
      if (!before || before.deleted_at || id.startsWith("tmp-")) return;

      const mine = before.reactions.find((r) => r.user_id === meId);
      const removing = mine?.emoji === emoji;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                reactions: removing
                  ? m.reactions.filter((r) => r.user_id !== meId)
                  : [...m.reactions.filter((r) => r.user_id !== meId), { user_id: meId, emoji }],
              }
            : m,
        ),
      );

      const res = removing
        ? await sb.from("elite_reactions").delete().eq("message_id", id).eq("user_id", meId)
        : await sb
            .from("elite_reactions")
            .upsert({ message_id: id, user_id: meId, emoji }, { onConflict: "message_id,user_id" });

      if (res.error) {
        setMessages((prev) => prev.map((m) => (m.id === id ? before : m)));
        setActionError(errMessage(res.error, "Could not save your reaction."));
      }
    },
    [meId],
  );

  const loadOlder = useCallback(async (): Promise<boolean> => {
    if (loadingMore || !hasMore) return false;
    const oldest = messagesRef.current.find((m) => !m.id.startsWith("tmp-"));
    if (!oldest) return false;

    setLoadingMore(true);
    const { data, error: e } = await sb
      .from("elite_messages")
      .select(SELECT)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (e) {
      setActionError(e.message);
      setLoadingMore(false);
      return false;
    }

    const rows = ((data ?? []) as EliteMessage[]).slice().reverse();
    setHasMore((data ?? []).length === PAGE_SIZE);
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      return [...rows.filter((r) => !known.has(r.id)), ...prev];
    });
    void ensureProfiles(rows.map((m) => m.user_id));
    void ensureUrls(rows);
    setLoadingMore(false);
    return rows.length > 0;
  }, [loadingMore, hasMore, ensureProfiles, ensureUrls]);

  const clearFresh = useCallback(() => {
    setMessages((prev) => (prev.some((m) => m.fresh) ? prev.map((m) => (m.fresh ? { ...m, fresh: false } : m)) : prev));
  }, []);

  const typingNames = useMemo(() => Object.values(typing).map((t) => t.name), [typing]);

  return {
    messages,
    members,
    memberIds,
    reads,
    initialRead,
    online,
    typingNames,
    urls,
    loading,
    loadingMore,
    hasMore,
    error,
    actionError,
    setActionError,
    sending,
    send,
    edit,
    remove,
    react,
    loadOlder,
    markRead,
    notifyTyping,
    clearFresh,
  };
}