// ΠΡΟΣΟΧΗ: προσάρμοσε αυτό το import στο supabase client του project σου.
import { supabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Types & constants (κράτα τα συγχρονισμένα με το seminars.sql)       */
/* ------------------------------------------------------------------ */

export type SeminarFormat = "group" | "private";
export type BookingStatus = "new" | "read" | "verified" | "cancelled";
export type Experience = "beginner" | "intermediate" | "professional";

export const SLOTS = ["10:00", "14:00", "18:00"] as const;
export type Slot = (typeof SLOTS)[number];

export const GROUP_CAPACITY = 8;
export const MIN_GROUP = 2;

export interface AvailabilityRow {
  seminar_date: string;
  slot: string | null;
  group_people: number;
  has_private: boolean;
  blocked: boolean;
}

export interface SeminarBooking {
  id: string;
  reference: string;
  user_id: string | null;
  format: SeminarFormat;
  seminar_date: string;
  slot: string;
  participants: number;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  experience_level: Experience;
  group_name: string | null;
  participant_names: string | null;
  goals: string | null;
  notes: string | null;
  terms_accepted: boolean;
  terms_accepted_at: string;
  status: BookingStatus;
  read_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlockedDate {
  id: string;
  blocked_date: string;
  slot: string | null;
  reason: string | null;
  created_at: string;
}

export interface NewBooking {
  format: SeminarFormat;
  date: string;
  slot: string;
  participants: number;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  experience: Experience;
  groupName: string;
  participantNames: string;
  goals: string;
  notes: string;
  terms: boolean;
}

/* ------------------------------------------------------------------ */
/* Date helpers (τοπική ώρα, χωρίς UTC μετατοπίσεις)                   */
/* ------------------------------------------------------------------ */

const p2 = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/* ------------------------------------------------------------------ */
/* Availability logic (κοινή για το public page και το admin)          */
/* ------------------------------------------------------------------ */

export interface SlotInfo {
  people: number;
  priv: boolean;
  blocked: boolean;
}
export interface DayInfo {
  dayBlocked: boolean;
  slots: Record<string, SlotInfo>;
}
export type AvailabilityIndex = Map<string, DayInfo>;

export function indexAvailability(rows: AvailabilityRow[]): AvailabilityIndex {
  const map: AvailabilityIndex = new Map();
  for (const r of rows) {
    const day = map.get(r.seminar_date) ?? { dayBlocked: false, slots: {} };
    if (r.blocked && r.slot === null) {
      day.dayBlocked = true;
    } else if (r.slot) {
      const s = day.slots[r.slot] ?? { people: 0, priv: false, blocked: false };
      s.people += r.group_people;
      s.priv = s.priv || r.has_private;
      s.blocked = s.blocked || r.blocked;
      day.slots[r.slot] = s;
    }
    map.set(r.seminar_date, day);
  }
  return map;
}

/** Χρησιμοποιείται από το admin: χτίζει το ίδιο index από τα πραγματικά rows. */
export function rowsFromBookings(
  bookings: SeminarBooking[],
  blocked: BlockedDate[],
): AvailabilityRow[] {
  const rows: AvailabilityRow[] = [];
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    rows.push({
      seminar_date: b.seminar_date,
      slot: b.slot,
      group_people: b.format === "group" ? b.participants : 0,
      has_private: b.format === "private",
      blocked: false,
    });
  }
  for (const d of blocked) {
    rows.push({
      seminar_date: d.blocked_date,
      slot: d.slot,
      group_people: 0,
      has_private: false,
      blocked: true,
    });
  }
  return rows;
}

export type SlotStatus = "open" | "few" | "full" | "blocked";

export function getSlotStatus(
  day: DayInfo | undefined,
  slot: string,
  format: SeminarFormat,
  participants: number,
): { status: SlotStatus; remaining: number } {
  if (day?.dayBlocked) return { status: "blocked", remaining: 0 };
  const s = day?.slots[slot];
  if (s?.blocked) return { status: "blocked", remaining: 0 };

  const taken = s?.priv ? GROUP_CAPACITY : (s?.people ?? 0);
  const remaining = Math.max(0, GROUP_CAPACITY - taken);

  if (format === "private") {
    return taken > 0
      ? { status: "full", remaining: 0 }
      : { status: "open", remaining: GROUP_CAPACITY };
  }
  if (remaining < participants) return { status: "full", remaining };
  return { status: remaining <= 3 ? "few" : "open", remaining };
}

export type DayStatus = "open" | "full" | "blocked";

/** Η μέρα κλείνει αυτόματα όταν δεν έχει κανένα διαθέσιμο slot. */
export function getDayStatus(
  day: DayInfo | undefined,
  format: SeminarFormat,
  participants: number,
): DayStatus {
  if (day?.dayBlocked) return "blocked";
  const states = SLOTS.map((s) => getSlotStatus(day, s, format, participants).status);
  if (states.every((s) => s === "blocked")) return "blocked";
  if (states.every((s) => s === "full" || s === "blocked")) return "full";
  return "open";
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getAvailability(from: string, to: string): Promise<AvailabilityRow[]> {
  const { data, error } = await supabase.rpc("get_seminar_availability", {
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AvailabilityRow[];
}

export async function createSeminarBooking(b: NewBooking): Promise<string> {
  const { data, error } = await supabase.rpc("create_seminar_booking", {
    p_format: b.format,
    p_date: b.date,
    p_slot: b.slot,
    p_participants: b.participants,
    p_full_name: b.fullName,
    p_email: b.email,
    p_phone: b.phone,
    p_city: b.city,
    p_experience: b.experience,
    p_group_name: b.groupName,
    p_participant_names: b.participantNames,
    p_goals: b.goals,
    p_notes: b.notes,
    p_terms: b.terms,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/* ------------------------------------------------------------------ */
/* Admin API (προστατεύεται από RLS)                                   */
/* ------------------------------------------------------------------ */

export async function adminGetBookings(): Promise<SeminarBooking[]> {
  const { data, error } = await supabase
    .from("seminar_bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SeminarBooking[];
}

export async function adminGetBlocked(): Promise<BlockedDate[]> {
  const { data, error } = await supabase
    .from("seminar_blocked_dates")
    .select("*")
    .order("blocked_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BlockedDate[];
}

export async function adminSetBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.from("seminar_bookings").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminBlockDate(
  date: string,
  slot: string | null,
  reason: string,
  adminId: string,
): Promise<void> {
  const { error } = await supabase.from("seminar_blocked_dates").insert({
    blocked_date: date,
    slot,
    reason: reason.trim() || null,
    created_by: adminId,
  });
  if (error) throw new Error(error.message);
}

export async function adminUnblock(id: string): Promise<void> {
  const { error } = await supabase.from("seminar_blocked_dates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}