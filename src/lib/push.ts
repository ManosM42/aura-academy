// src/lib/push.ts  — browser side of the admin push notifications
import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = "unsupported" | "insecure" | "denied" | "enabled" | "disabled";

export interface AdminNotification {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Notifications need HTTPS (or localhost): plain http sites cannot use them. */
export function pushState(): PushState | "check" {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "check";
}

/** Is THIS browser currently subscribed? */
export async function getPushState(): Promise<PushState> {
  const quick = pushState();
  if (quick !== "check") return quick;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "enabled" : "disabled";
  } catch {
    return "disabled";
  }
}

export async function enablePush(): Promise<void> {
  const quick = pushState();
  if (quick === "insecure") throw new Error("Οι ειδοποιήσεις χρειάζονται HTTPS. Το site τρέχει σε http.");
  if (quick === "unsupported") throw new Error("Ο browser δεν υποστηρίζει push ειδοποιήσεις.");
  if (quick === "denied") {
    throw new Error("Οι ειδοποιήσεις είναι μπλοκαρισμένες. Επίτρεψέ τες από το εικονίδιο κλειδαριάς δίπλα στη διεύθυνση.");
  }
  if (!VAPID_PUBLIC_KEY) throw new Error("Λείπει το VITE_VAPID_PUBLIC_KEY.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Δεν δόθηκε άδεια για ειδοποιήσεις.");

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Η εγγραφή στις ειδοποιήσεις δεν ολοκληρώθηκε.");
  }

  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error(error.message);
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc("unregister_push_subscription", { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** Creates a test row: the database webhook then pushes it like a real event. */
export async function sendTestNotification(): Promise<void> {
  const { error } = await supabase.from("admin_notifications").insert({
    type: "test",
    title: "Δοκιμαστική ειδοποίηση",
    body: "Οι ειδοποιήσεις του AURA λειτουργούν σωστά.",
    url: "/admin/notifications",
  });
  if (error) throw new Error(error.message);
}

export async function getRecentNotifications(limit = 30): Promise<AdminNotification[]> {
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("id, created_at, type, title, body, url")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminNotification[];
}