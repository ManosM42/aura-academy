// supabase/functions/<το-chat-function-σου>/index.ts
// AURA AI: chat + αναζήτηση στη βάση (βίντεο, σεμινάρια, πλάνα) + έλεγχος πλάνου στον server.
// Secrets (νέα, προαιρετικά): AI_FREE_LIMIT (default 10), AI_MEMBER_LIMIT (default 300)
// Υπάρχοντα: OPENROUTER_API_KEY, OPENROUTER_MODEL, GUEST_SALT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SYSTEM_PROMPT } from "./prompt.ts";

const FREE_LIMIT = Number(Deno.env.get("AI_FREE_LIMIT") ?? 10);
const MEMBER_LIMIT = Number(Deno.env.get("AI_MEMBER_LIMIT") ?? 300);
const BUDGET_MS = 40000; // συνολικός χρόνος για όλες τις προσπάθειες
const MAX_ATTEMPTS = 6;
const MAX_VIDEO_CARDS = 4;
const SLOTS = ["10:00", "14:00", "18:00"]; // ίδια με το create_seminar_booking
const GROUP_CAP = 8;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const FALLBACKS = [
  "Συγγνώμη, δεν κατάφερα να σου απαντήσω αυτή τη στιγμή. Δοκίμασε να ξαναστείλεις το μήνυμά σου σε λίγο.",
  "Είχα ένα μικρό πρόβλημα με τη σύνδεση. Στείλε μου ξανά την ερώτησή σου και θα σε βοηθήσω.",
  "Δεν μπόρεσα να απαντήσω αυτή τη φορά. Ξαναδοκίμασε και θα το δούμε μαζί.",
];
const pick = () => FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractText(data: any): string {
  let c = data?.choices?.[0]?.message?.content;
  if (Array.isArray(c)) c = c.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("");
  if (typeof c !== "string") return "";
  c = c.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (/<think>/i.test(c)) return "";
  return c.trim();
}

/* ------------------------------------------------------------------ */
/* Πλάνα και πρόσβαση (ίδιοι κανόνες με το front-end: low=1, mid=2, high=3) */
/* ------------------------------------------------------------------ */

const STAFF_ROLES = new Set(["content_manager", "operations", "admin", "super_admin"]);
const RANK: Record<string, number> = { low: 1, starter: 1, mid: 2, core: 2, high: 3, full: 3 };
const rank = (p?: string | null) => RANK[(p ?? "").toLowerCase()] ?? 0;
// άγνωστο required_plan => θεωρείται το χαμηλότερο πληρωμένο (ποτέ «ανοιχτό σε όλους»)
const requiredRank = (p?: string | null) => rank(p) || 1;
const DEFAULT_NAMES: Record<string, string> = { low: "AURA BASIC", mid: "AURA PRO", high: "AURA ELITE" };

type Viewer = { userId: string | null; role: string | null; planId: string | null; isStaff: boolean };
type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  badge: string | null;
  slogan: string;
  features: string[];
};

async function getViewer(admin: any, token?: string): Promise<Viewer> {
  let userId: string | null = null;
  if (token) {
    try {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id ?? null;
    } catch (_) { /* guest */ }
  }
  if (!userId) return { userId: null, role: null, planId: null, isStaff: false };

  const [prof, sub] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin
      .from("subscriptions")
      .select("plan_id, status, created_at")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const role: string | null = prof.data?.role ?? null;
  return {
    userId,
    role,
    planId: sub.data?.plan_id ?? null,
    isStaff: role ? STAFF_ROLES.has(role) : false,
  };
}

async function loadPlans(admin: any): Promise<PlanRow[]> {
  const { data } = await admin
    .from("plans")
    .select("id, name, price_cents, currency, badge, slogan, features, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return ((data ?? []) as PlanRow[]).map((p) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] }));
}

const planNameOf = (plans: PlanRow[], id?: string | null) =>
  plans.find((p) => p.id === id)?.name ?? DEFAULT_NAMES[(id ?? "").toLowerCase()] ?? "πληρωμένο πλάνο";

/* ------------------------------------------------------------------ */
/* Κάρτες που εμφανίζει το chat                                         */
/* ------------------------------------------------------------------ */

type Card =
  | {
      type: "video";
      slug: string;
      title: string;
      summary: string | null;
      category: string | null;
      level: string | null;
      requiredPlanName: string;
      durationSeconds: number | null;
      hasVideo: boolean;
      locked: boolean;
    }
  | {
      type: "pricing";
      reason: "no_plan" | "upgrade" | "info";
      requiredPlanName?: string;
      plans: { id: string; name: string; priceCents: number; currency: string; badge: string | null; slogan: string }[];
    }
  | {
      type: "online_seminar";
      id: string;
      title: string;
      startsAt: string;
      durationMinutes: number;
      priceCents: number;
      finalPriceCents: number;
      discountPercent: number;
      currency: string;
      spotsLeft: number | null;
      soldOut: boolean;
    }
  | { type: "seminar_onsite"; nextDates: { date: string; groupSlots: string[]; privateSlots: string[] }[] }
  | { type: "link"; to: "/book" | "/find-job" | "/contact" | "/stop-plan"; label: string; description: string }
  | { type: "login" };

type Part = { lines: string[]; cards: Card[]; fallback: string };

/* ------------------------------------------------------------------ */
/* Κατανόηση αιτήματος (κανόνες, όχι μοντέλο: αξιόπιστο και δωρεάν)     */
/* ------------------------------------------------------------------ */

const strip = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ς/g, "σ");

const CATEGORY_WORDS: Record<string, string[]> = {
  graduation: ["graduation", "graduat", "γκραντου", "γκραδου", "γκραζου", "γκρατου"],
  layers: ["layer", "λεηερ", "λειερ", "λεγιερ", "στρωσ"],
  fade: ["fade", "φειντ", "φαιντ", "ντεγκραντε", "degrade", "taper", "ταπερ", "burst"],
  creative: ["creative", "κρεατιβ", "κριειτιβ", "κρεειτιβ", "δημιουργικ", "design", "σχεδι"],
};
const CATEGORY_LABEL: Record<string, string> = {
  graduation: "Graduation",
  layers: "Layers",
  fade: "Fade",
  creative: "Creative",
};

const STOP = new Set([
  "δειξε", "δειξτε", "μου", "θελω", "ηθελα", "θα", "βιντεο", "video", "videos", "για", "με", "τα", "την",
  "τον", "το", "του", "μια", "ενα", "ενας", "που", "και", "απο", "στο", "στην", "στα", "εχει", "εχεις",
  "εχετε", "υπαρχει", "υπαρχουν", "show", "the", "any", "have", "you", "want", "see", "watch", "μαθημα",
  "μαθηματα", "course", "tutorial", "πως", "τι", "ποια", "ποιο", "ποιες", "ποιος", "can", "for", "some",
  "παρακολουθησω", "παρακολουθηση", "videos",
]);

type Intent = {
  category: string | null;
  videos: boolean;
  seminar: boolean;
  online: boolean;
  onsite: boolean;
  pricing: boolean;
  book: boolean;
  jobs: boolean;
  contact: boolean;
  cancel: boolean;
  tokens: string[];
};

function detect(raw: string, viewer: Viewer): Intent {
  const t = strip(raw);
  const category = Object.entries(CATEGORY_WORDS).find(([, ws]) => ws.some((w) => t.includes(w)))?.[0] ?? null;
  const videoWords = /(βιντεο|video|μαθημα|μαθηματα|course|tutorial|παρακολουθ|watch|lesson)/.test(t);
  const seminar = /(σεμιναρ|seminar|webinar|workshop)/.test(t);
  const online = /(online|διαδικτυ|\blive\b|zoom|webinar)/.test(t);
  const onsite = /(επι τοπου|επιτοπου|δια ζωσης|διαζωσης|φυσικο|κρητη|ομαδικο|ιδιωτικο|\bgroup\b|\bprivate\b|στην ακαδημια|in person)/.test(t);
  const planWords = /(πλανο|πλανα|συνδρομ|αναβαθμ|upgrade|subscription|\bplans?\b|\bbasic\b|\bpro\b|\belite\b|ελιτ|pricing|membership)/.test(t);
  const priceWords = /(τιμη|τιμες|κοστιζ|κοστος|\bprice)/.test(t);
  const book = /(βιβλιο|e-?book|method book)/.test(t);
  const jobs = /(find job|findjob|δουλει|\bjobs?\b|θεσεις εργασιας|θεση εργασιας|εργοδοτ)/.test(t);
  const contact = /(επικοινων|\bcontact\b|\bsupport\b|υποστηριξ)/.test(t);
  const cancel = /(ακυρωσ|\bcancel|διακοπη συνδρομ)/.test(t);

  const tokens = t.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w));

  return {
    category,
    // οι guests βλέπουν κάρτα «σύνδεση» μόνο όταν ζητούν ρητά βίντεο
    videos: videoWords || (!!viewer.userId && category !== null && !seminar),
    seminar,
    online,
    onsite,
    pricing: planWords || (priceWords && !seminar && !book),
    book,
    jobs,
    contact,
    cancel,
    tokens,
  };
}

const anyIntent = (d: Intent) =>
  d.videos || d.seminar || d.pricing || d.book || d.jobs || d.contact || d.cancel;

/* ------------------------------------------------------------------ */
/* Builders: κάθε ένα γυρίζει γραμμές για το μοντέλο + κάρτες           */
/* ------------------------------------------------------------------ */

const fmtMoney = (cents: number, currency = "eur") =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
const applyPercent = (cents: number, p: number) => Math.max(0, Math.floor((cents * (100 - p) + 50) / 100));
const athensToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const stem = (t: string) => (t.length > 6 ? t.slice(0, -2) : t.length > 4 ? t.slice(0, -1) : t);

function pricingCard(plans: PlanRow[], reason: "no_plan" | "upgrade" | "info", requiredPlanName?: string): Card {
  return {
    type: "pricing",
    reason,
    requiredPlanName,
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.price_cents,
      currency: p.currency,
      badge: p.badge,
      slogan: p.slogan,
    })),
  };
}

async function buildVideos(admin: any, viewer: Viewer, d: Intent, plans: PlanRow[]): Promise<Part> {
  if (!viewer.userId) {
    return {
      lines: [
        "ΒΙΝΤΕΟ: Ο χρήστης ΔΕΝ είναι συνδεδεμένος. Τα βίντεο είναι διαθέσιμα μόνο σε συνδεδεμένα μέλη με ενεργό πλάνο. Πες του να συνδεθεί (ή να δημιουργήσει λογαριασμό) και ότι τα πλάνα φαίνονται από κάτω.",
      ],
      cards: [{ type: "login" }, pricingCard(plans, "no_plan")],
      fallback: "Για να δεις βίντεο πρέπει να συνδεθείς και να έχεις ενεργό πλάνο. Τα πλάνα φαίνονται παρακάτω.",
    };
  }

  const { data, error } = await admin
    .from("courses")
    .select("id, title, slug, summary, category, level, required_plan, video_duration_seconds, video_path, sort_order")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    console.error("courses", error);
    return { lines: ["ΒΙΝΤΕΟ: Δεν μπόρεσα να διαβάσω τη λίστα βίντεο αυτή τη στιγμή. Πες το στον χρήστη."], cards: [], fallback: "" };
  }

  const courses = (data ?? []) as any[];
  const counts: Record<string, number> = {};
  for (const c of courses) counts[c.category ?? "other"] = (counts[c.category ?? "other"] ?? 0) + 1;
  const catSummary =
    Object.entries(counts).map(([k, n]) => `${CATEGORY_LABEL[k] ?? k} (${n})`).join(", ") || "κανένα ακόμη";

  const scored = courses.map((c) => {
    const hay = strip(`${c.title} ${c.slug} ${c.summary ?? ""} ${c.category ?? ""}`);
    const score = d.tokens.reduce((n, tk) => n + (hay.includes(stem(tk)) ? 1 : 0), 0);
    return { c, score };
  });

  let picked = d.category
    ? scored.filter((x) => x.c.category === d.category)
    : scored.filter((x) => x.score > 0);
  picked = picked.sort((a, b) => b.score - a.score).slice(0, MAX_VIDEO_CARDS);

  // γενικό αίτημα («δείξε μου βίντεο»): πρότεινε μερικά
  const generic = !d.category && picked.length === 0 && d.tokens.length === 0;
  if (generic) picked = scored.slice(0, MAX_VIDEO_CARDS);

  const lines: string[] = [`ΒΙΝΤΕΟ: Δημοσιευμένα συνολικά: ${courses.length}. Κατηγορίες: ${catSummary}.`];
  const cards: Card[] = [];
  let firstLockedPlan: string | undefined;

  for (const { c } of picked) {
    const locked = !viewer.isStaff && rank(viewer.planId) < requiredRank(c.required_plan);
    const needName = planNameOf(plans, c.required_plan);
    if (locked && !firstLockedPlan) firstLockedPlan = needName;
    cards.push({
      type: "video",
      slug: c.slug,
      title: c.title,
      summary: c.summary ? String(c.summary).slice(0, 240) : null,
      category: c.category,
      level: c.level,
      requiredPlanName: needName,
      durationSeconds: c.video_duration_seconds ?? null,
      hasVideo: !!c.video_path,
      locked,
    });
    lines.push(
      `- "${c.title}" | κατηγορία: ${CATEGORY_LABEL[c.category] ?? c.category ?? "-"} | απαιτεί: ${needName} | ${
        locked ? "LOCKED για αυτόν τον χρήστη" : "UNLOCKED (θα εμφανιστεί player)"
      }${c.video_path ? "" : " | το βίντεο δεν έχει ανέβει ακόμη"}${c.summary ? ` | περίληψη: ${String(c.summary).slice(0, 140)}` : ""}`,
    );
  }

  if (picked.length === 0) {
    lines.push("Δεν βρέθηκε βίντεο που να ταιριάζει με το αίτημα. Πρότεινε μία από τις κατηγορίες που υπάρχουν.");
  }
  if (firstLockedPlan) {
    cards.push(pricingCard(plans, viewer.planId ? "upgrade" : "no_plan", firstLockedPlan));
    lines.push(
      viewer.planId
        ? `Ο χρήστης έχει ${planNameOf(plans, viewer.planId)}. Για τα LOCKED χρειάζεται ${firstLockedPlan} ή ανώτερο. Τα πλάνα φαίνονται από κάτω.`
        : "Ο χρήστης ΔΕΝ έχει ενεργό πλάνο. Πρέπει να πληρώσει κάποιο πλάνο για να δει βίντεο. Τα πλάνα φαίνονται από κάτω.",
    );
  }

  const unlockedN = cards.filter((c) => c.type === "video" && !c.locked).length;
  const fallback =
    picked.length === 0
      ? "Δεν βρήκα βίντεο που να ταιριάζει. Δοκίμασε μία κατηγορία: Graduation, Layers, Fade ή Creative."
      : unlockedN > 0
        ? `Βρήκα ${unlockedN === 1 ? "ένα βίντεο" : `${unlockedN} βίντεο`}. Μπορείς να το δεις παρακάτω.`
        : `Βρήκα το βίντεο, αλλά χρειάζεται πλάνο ${firstLockedPlan}. Δες τα πλάνα παρακάτω.`;

  return { lines, cards, fallback };
}

async function buildOnline(admin: any, viewer: Viewer): Promise<Part> {
  const { data, error } = await admin
    .from("online_seminars_public")
    .select("*")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(6);
  if (error) {
    console.error("online_seminars_public", error);
    return { lines: ["ONLINE ΣΕΜΙΝΑΡΙΑ: δεν μπόρεσα να τα διαβάσω τώρα."], cards: [], fallback: "" };
  }

  let percent = 0;
  if (viewer.planId) {
    const { data: disc } = await admin
      .from("plan_discounts")
      .select("percent")
      .eq("plan_id", viewer.planId)
      .eq("product", "online_seminar")
      .maybeSingle();
    percent = Math.min(100, Math.max(0, Number(disc?.percent ?? 0)));
  }

  const rows = (data ?? []) as any[];
  if (!rows.length) {
    return {
      lines: ["ONLINE ΣΕΜΙΝΑΡΙΑ: Δεν υπάρχουν προγραμματισμένα online σεμινάρια αυτή τη στιγμή."],
      cards: [],
      fallback: "Δεν υπάρχουν προγραμματισμένα online σεμινάρια αυτή τη στιγμή. Ξαναδες σύντομα.",
    };
  }

  const lines = ["ONLINE ΣΕΜΙΝΑΡΙΑ (με σειρά ημερομηνίας):"];
  const cards: Card[] = [];
  for (const s of rows) {
    const left = s.capacity ? Number(s.capacity) - Number(s.taken ?? 0) : null;
    const soldOut = left !== null && left <= 0;
    const final = applyPercent(s.price_cents, percent);
    const when = new Date(s.starts_at).toLocaleString("el-GR", {
      timeZone: "Europe/Athens",
      dateStyle: "full",
      timeStyle: "short",
    });
    cards.push({
      type: "online_seminar",
      id: s.id,
      title: s.title,
      startsAt: s.starts_at,
      durationMinutes: s.duration_minutes,
      priceCents: s.price_cents,
      finalPriceCents: final,
      discountPercent: final < s.price_cents ? percent : 0,
      currency: s.currency,
      spotsLeft: left,
      soldOut,
    });
    lines.push(
      `- "${s.title}" | ${when} | ${s.duration_minutes} λεπτά | τιμή ${fmtMoney(s.price_cents, s.currency)}${
        final < s.price_cents ? ` (για αυτόν τον χρήστη με έκπτωση μέλους ${percent}%: ${fmtMoney(final, s.currency)})` : ""
      } | ${soldOut ? "ΕΞΑΝΤΛΗΜΕΝΟ" : left !== null ? `${left} θέσεις διαθέσιμες` : "ανοιχτές θέσεις"}${
        s.description ? ` | περιγραφή: ${String(s.description).slice(0, 160)}` : ""
      }`,
    );
  }
  return {
    lines,
    cards,
    fallback: `Υπάρχουν ${rows.length} προγραμματισμένα online σεμινάρια. Τα βλέπεις παρακάτω.`,
  };
}

async function buildOnsite(admin: any): Promise<Part> {
  const today = athensToday();
  const { data, error } = await admin.rpc("get_seminar_availability", {
    p_from: addDays(today, 1),
    p_to: addDays(today, 30),
  });
  if (error) console.error("get_seminar_availability", error);

  const rows = (data ?? []) as {
    seminar_date: string;
    slot: string | null;
    group_people: number;
    has_private: boolean;
    blocked: boolean;
  }[];

  const nextDates: { date: string; groupSlots: string[]; privateSlots: string[] }[] = [];
  for (let i = 1; i <= 30 && nextDates.length < 5; i++) {
    const date = addDays(today, i);
    const day = rows.filter((r) => r.seminar_date === date);
    if (day.some((r) => r.blocked && r.slot === null)) continue;
    const groupSlots: string[] = [];
    const privateSlots: string[] = [];
    for (const s of SLOTS) {
      if (day.some((r) => r.blocked && r.slot === s)) continue;
      const info = day.find((r) => !r.blocked && r.slot === s);
      const people = info?.group_people ?? 0;
      if (info?.has_private) continue;
      if (people <= GROUP_CAP - 2) groupSlots.push(s); // το ομαδικό θέλει τουλάχιστον 2 θέσεις
      if (people === 0) privateSlots.push(s);
    }
    if (groupSlots.length || privateSlots.length) nextDates.push({ date, groupSlots, privateSlots });
  }

  const lines = [
    "ΣΕΜΙΝΑΡΙΑ ΕΠΙ ΤΟΠΟΥ: κλείνονται από τη σελίδα κράτησης (ομαδικό 2 έως 8 άτομα, ή ιδιωτικό για 1 άτομο). Ώρες: 10:00, 14:00, 18:00. Δεν γνωρίζεις τιμή ή τοποθεσία, μην τα πεις.",
  ];
  if (nextDates.length) {
    lines.push("Επόμενες ημερομηνίες με διαθεσιμότητα:");
    for (const n of nextDates) {
      lines.push(`- ${n.date} | ομαδικό: ${n.groupSlots.join(", ") || "-"} | ιδιωτικό: ${n.privateSlots.join(", ") || "-"}`);
    }
  } else {
    lines.push("Δεν βρέθηκε ελεύθερη ημερομηνία τις επόμενες 30 μέρες (ή δεν μπόρεσα να τη διαβάσω). Πες του να δει τη σελίδα κράτησης.");
  }
  return {
    lines,
    cards: [{ type: "seminar_onsite", nextDates }],
    fallback: "Τα σεμινάρια επί τόπου κλείνονται από τη σελίδα κράτησης. Την ανοίγεις παρακάτω.",
  };
}

/* ------------------------------------------------------------------ */
/* Ένωση όλων σε ένα context                                           */
/* ------------------------------------------------------------------ */

async function buildContext(admin: any, viewer: Viewer, d: Intent, plans: PlanRow[]) {
  const parts: Part[] = [];
  const jobs: Promise<Part>[] = [];

  if (d.videos) jobs.push(buildVideos(admin, viewer, d, plans));
  if (d.seminar) {
    const online = d.online || !d.onsite;
    const onsite = d.onsite || !d.online;
    if (online) jobs.push(buildOnline(admin, viewer));
    if (onsite) jobs.push(buildOnsite(admin));
  }
  parts.push(...(await Promise.all(jobs)));

  if (d.book) {
    parts.push({
      lines: ["ΒΙΒΛΙΟ: υπάρχει η σελίδα του βιβλίου AURA Professional Hair Method. Οι εκπτώσεις μελών είναι στα πλάνα (catalog)."],
      cards: [{ type: "link", to: "/book", label: "AURA Professional Hair Method", description: "Δες και παρήγγειλε το βιβλίο." }],
      fallback: "Το βιβλίο το βρίσκεις στη σελίδα του, παρακάτω.",
    });
  }
  if (d.jobs) {
    const allowed = viewer.isStaff || rank(viewer.planId) >= 1;
    parts.push({
      lines: [
        allowed
          ? "FIND JOB: ο χρήστης έχει πρόσβαση (το AURA Find Job περιλαμβάνεται στα πλάνα). Θα εμφανιστεί κουμπί."
          : "FIND JOB: απαιτεί ενεργό πληρωμένο πλάνο, που ο χρήστης ΔΕΝ έχει. Πες του ότι πρέπει να πληρώσει κάποιο πλάνο. Τα πλάνα φαίνονται από κάτω.",
      ],
      cards: allowed
        ? [{ type: "link", to: "/find-job", label: "AURA Find Job", description: "Επαγγελματικές ευκαιρίες για barbers." }]
        : viewer.userId
          ? [pricingCard(plans, "no_plan")]
          : [{ type: "login" }, pricingCard(plans, "no_plan")],
      fallback: allowed ? "Το Find Job το ανοίγεις παρακάτω." : "Το Find Job χρειάζεται ενεργό πλάνο. Δες τα πλάνα παρακάτω.",
    });
  }
  if (d.cancel) {
    parts.push({
      lines: ["ΑΚΥΡΩΣΗ: τα πλάνα έχουν δυνατότητα ακύρωσης ανά πάσα στιγμή. Θα εμφανιστεί κουμπί προς τη σελίδα διαχείρισης. Μην πεις ότι ακύρωσες κάτι εσύ."],
      cards: viewer.userId
        ? [{ type: "link", to: "/stop-plan", label: "Διαχείριση συνδρομής", description: "Ακύρωση ή διακοπή του πλάνου σου." }]
        : [{ type: "login" }],
      fallback: "Τη συνδρομή τη διαχειρίζεσαι από τη σελίδα παρακάτω.",
    });
  }
  if (d.contact) {
    parts.push({
      lines: ["ΕΠΙΚΟΙΝΩΝΙΑ: υπάρχει σελίδα επικοινωνίας για λογαριασμό, χρεώσεις και οτιδήποτε δεν μπορείς να επιβεβαιώσεις."],
      cards: [{ type: "link", to: "/contact", label: "Επικοινωνία", description: "Στείλε μας μήνυμα." }],
      fallback: "Μπορείς να μας γράψεις από τη σελίδα επικοινωνίας, παρακάτω.",
    });
  }
  if (d.pricing && !parts.some((p) => p.cards.some((c) => c.type === "pricing"))) {
    parts.push({
      lines: ["ΠΛΑΝΑ: ο χρήστης ρωτά για πλάνα/τιμές. Θα εμφανιστεί κάρτα με τα πλάνα. Χρησιμοποίησε τα features του PLANS block παρακάτω."],
      cards: [pricingCard(plans, "info")],
      fallback: "Αυτά είναι τα πλάνα της AURA.",
    });
  }

  // μία μόνο pricing κάρτα (προτίμηση: no_plan/upgrade) και μία login
  const cards: Card[] = [];
  const rawCards = parts.flatMap((p) => p.cards);
  const pricing = rawCards.filter((c) => c.type === "pricing") as Extract<Card, { type: "pricing" }>[];
  const bestPricing = pricing.find((c) => c.reason !== "info") ?? pricing[0];
  let loginDone = false;
  for (const c of rawCards) {
    if (c.type === "pricing") continue;
    if (c.type === "login") {
      if (loginDone) continue;
      loginDone = true;
    }
    cards.push(c);
  }
  if (bestPricing) cards.push(bestPricing);

  const wantsPlanDetail = d.pricing;
  const planBlock =
    "PLANS (live από τη βάση):\n" +
    plans
      .map(
        (p) =>
          `- ${p.name} | ${fmtMoney(p.price_cents, p.currency)}/μήνα${
            wantsPlanDetail ? ` | ${p.slogan} | features: ${p.features.join("; ")}` : ""
          }`,
      )
      .join("\n");

  return {
    lines: parts.flatMap((p) => p.lines),
    planBlock,
    cards,
    fallback: parts.map((p) => p.fallback).filter(Boolean).join(" "),
  };
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let subject = "";
  let charged = false;
  let remainingAfter = 0;
  const refund = async () => {
    if (subject && charged) {
      charged = false;
      try { await admin.rpc("refund_ai_use", { p_subject: subject }); } catch (e) { console.error(e); }
    }
  };

  try {
    const body = await req.json();
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
      .slice(-8)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, m.role === "user" ? 500 : 800) }));

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ reply: "Γράψε μου μια ερώτηση και θα σε βοηθήσω.", fallback: true });
    }

    // Ποιος είναι: χρήστης (με πλάνο/ρόλο) ή guest
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const viewer = await getViewer(admin, token);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
    subject = viewer.userId
      ? `user:${viewer.userId}`
      : `guest:${await sha256(`${ip}|${String(body.deviceId ?? "")}|${Deno.env.get("GUEST_SALT") ?? ""}`)}`;

    // Όριο: μέλη με πλάνο (ή staff) έχουν μεγαλύτερο
    const limit = viewer.isStaff || rank(viewer.planId) >= 1 ? MEMBER_LIMIT : FREE_LIMIT;
    const { data: use, error: useErr } = await admin.rpc("consume_ai_use", { p_subject: subject, p_limit: limit });
    if (useErr) {
      console.error("consume_ai_use", useErr);
      return json({ reply: pick(), fallback: true });
    }
    const row = use?.[0];
    if (!row?.out_allowed) return json({ error: "limit_reached", remaining: 0 });
    charged = true;
    remainingAfter = row.out_remaining;

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      console.error("Λείπει το OPENROUTER_API_KEY");
      await refund();
      return json({ reply: pick(), fallback: true, remaining: remainingAfter + 1 });
    }

    // Τι ζητά ο χρήστης και τι βρίσκεται στη βάση
    const userMsgs = messages.filter((m: any) => m.role === "user");
    const last = userMsgs[userMsgs.length - 1].content as string;
    let intent = detect(last, viewer);
    if (!anyIntent(intent) && last.length < 30 && userMsgs.length > 1) {
      intent = detect(`${userMsgs[userMsgs.length - 2].content} ${last}`, viewer); // «και τα online;»
    }

    const plans = await loadPlans(admin);
    const ctx = await buildContext(admin, viewer, intent, plans);

    const nowAthens = new Date().toLocaleString("el-GR", { timeZone: "Europe/Athens", dateStyle: "full", timeStyle: "short" });
    const who = viewer.userId
      ? `συνδεδεμένος | πλάνο: ${viewer.planId ? planNameOf(plans, viewer.planId) : "ΚΑΝΕΝΑ ενεργό"}${viewer.isStaff ? " | staff (βλέπει τα πάντα)" : ""}`
      : "επισκέπτης (δεν είναι συνδεδεμένος)";
    const catalog =
      `<catalog>\nΤώρα: ${nowAthens} (Αθήνα)\nΧρήστης: ${who}\n${ctx.planBlock}\n` +
      (ctx.lines.length
        ? `\nΑΠΟΤΕΛΕΣΜΑΤΑ ΓΙΑ ΑΥΤΟ ΤΟ ΑΙΤΗΜΑ (το σύστημα εμφανίζει μόνο του τις κάρτες, μην γράφεις links):\n${ctx.lines.join("\n")}\n`
        : "\n(Για αυτό το μήνυμα δεν χρειάστηκε αναζήτηση στη βάση.)\n") +
      `</catalog>`;

    const own = (Deno.env.get("OPENROUTER_MODEL") ?? "")
      .split(",").map((s) => s.trim()).filter((s) => s && s !== "openrouter/free");
    const order = [...own, "openrouter/free", "openrouter/free", "openrouter/free", "openrouter/free"].slice(0, MAX_ATTEMPTS);

    const startedAt = Date.now();
    for (let i = 0; i < order.length; i++) {
      const left = BUDGET_MS - (Date.now() - startedAt);
      if (left < 3000) break;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), Math.min(18000, left));
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aura-academy.com",
            "X-Title": "AURA Academy",
          },
          body: JSON.stringify({
            model: order[i],
            max_tokens: 1200,
            temperature: 0.6,
            reasoning: { effort: "low" },
            messages: [{ role: "system", content: `${SYSTEM_PROMPT}\n\n${catalog}` }, ...messages],
          }),
        });

        if (!res.ok) {
          console.error(`attempt ${i + 1} ${order[i]}: HTTP ${res.status}`, (await res.text()).slice(0, 200));
          await sleep(res.status === 429 ? 1200 : 300);
          continue;
        }

        const reply = extractText(await res.json());
        if (reply) return json({ reply, cards: ctx.cards, remaining: remainingAfter, limit });
        console.error(`attempt ${i + 1} ${order[i]}: κενή απάντηση`);
      } catch (e) {
        console.error(`attempt ${i + 1} ${order[i]}:`, String(e));
      } finally {
        clearTimeout(timer);
      }
    }

    // Το μοντέλο απέτυχε, αλλά αν έχουμε αποτελέσματα από τη βάση, τα δίνουμε χωρίς μοντέλο
    if (ctx.cards.length && ctx.fallback) {
      return json({ reply: ctx.fallback, cards: ctx.cards, remaining: remainingAfter, limit, fallback: true });
    }
    await refund();
    return json({ reply: pick(), fallback: true, remaining: remainingAfter + 1 });
  } catch (e) {
    console.error(e);
    await refund();
    return json({ reply: pick(), fallback: true });
  }
});