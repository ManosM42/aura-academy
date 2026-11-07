// src/routes/admin.plans-and-users.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  Check,
  Crown,
  Download,
  Euro,
  Loader2,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Undo2,
  Users as UsersIcon,
  Wallet,
  X,
} from "lucide-react";
import { db } from "@/lib/db";
import { getMyProfile } from "@/lib/queries";
import { isAdminRole } from "@/lib/roles";
import { useAsync } from "@/lib/useAsync";
import { invalidatePlans } from "@/lib/usePlans";
import { formatEuro } from "@/lib/plans";
import { seo } from "@/lib/seo";
import { ErrorState, LoadingSkeleton, LockedState } from "@/components/aura/States";

export const Route = createFileRoute("/admin/plans-and-users")({
  head: () =>
    seo({
      title: "Plans & Users",
      description: "Admin: plans, income and subscribers.",
      path: "/admin/plans-and-users",
      noindex: true,
    }),
  component: PlansAndUsersPage,
});

// New tables/functions are not in the generated types yet.
const sb = db as unknown as SupabaseClient;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ------------------------------------------------------------------ */
/* Types + helpers                                                     */
/* ------------------------------------------------------------------ */

type PlanKey = "low" | "mid" | "high";
const PLAN_KEYS: PlanKey[] = ["low", "mid", "high"];

interface PlanRow {
  id: PlanKey;
  name: string;
  slogan: string;
  tagline: string;
  badge: string | null;
  price_cents: number;
  features: string[];
  highlight: boolean;
  active: boolean;
  sort_order: number;
  updated_at: string;
}

interface PaymentRow {
  plan_id: string | null;
  amount_cents: number;
  amount_refunded_cents: number;
  paid_at: string;
}

interface UserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  subscribed_at: string | null;
  last_paid_at: string | null;
  last_paid_cents: number | null;
  last_billing_reason: string | null;
  payments_count: number;
  total_paid_cents: number;
}

const eur = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });
const money = (cents: number) => eur.format(cents / 100);

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("el-GR", { day: "2-digit", month: "short", year: "numeric" });
}

function sanitizePlan(row: any): PlanRow {
  return {
    ...row,
    features: Array.isArray(row.features) ? row.features.filter((f: unknown) => typeof f === "string") : [],
  } as PlanRow;
}

function errText(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string") {
    return (e as any).message as string;
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Small UI                                                            */
/* ------------------------------------------------------------------ */

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 36, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ id, kicker, title, right }: { id: string; kicker: string; title: string; right?: ReactNode }) {
  return (
    <div id={id} className="flex scroll-mt-28 flex-wrap items-end justify-between gap-4">
      <div>
        <span className="pu-kicker">{kicker}</span>
        <h2 className="pu-title mt-3 text-2xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function Banner({ tone, children, onClose }: { tone: "ok" | "bad" | "info"; children: ReactNode; onClose?: () => void }) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : tone === "bad"
        ? "border-red-400/30 bg-red-500/10 text-red-200"
        : "border-white/15 bg-white/[0.04] text-white/70";
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="opacity-70 hover:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="pu-kpi">
      <span className="pu-kpi-icon">{icon}</span>
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">{label}</p>
      <p className="pu-kpi-value mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/35">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function PlansAndUsersPage() {
  const profile = useAsync(getMyProfile, []);
  const admin = isAdminRole(profile.data?.role ?? null);
  const reduce = useReducedMotion();

  return (
    <div className="pu-root relative min-h-screen w-full overflow-x-clip bg-aura-bg px-4 pb-24 pt-28 text-white sm:px-6 md:px-10">
      <style>{css}</style>
      <div className="aura-grain" aria-hidden />
      <div className="hero-atmosphere absolute inset-0" aria-hidden />
      <div className="pu-grid absolute inset-0" aria-hidden />
      {!reduce && (
        <>
          <motion.div className="pu-orb left-[3%] top-[6%] h-80 w-80" animate={{ y: [0, -30, 0], x: [0, 16, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
          <motion.div className="pu-orb right-[2%] top-[40%] h-[26rem] w-[26rem]" animate={{ y: [0, 28, 0], x: [0, -20, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
        </>
      )}

      <div className="relative z-10 mx-auto max-w-7xl">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="border-b border-white/10 pb-8"
        >
          <Link to="/admin" className="pu-back">
            <ArrowLeft className="size-4" /> Admin Panel
          </Link>
          <span className="pu-kicker mt-8 block">Control Room · Billing</span>
          <h1 className="pu-title mt-3 text-4xl font-extrabold uppercase tracking-tight sm:text-6xl">Plans &amp; Users</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/50">
            Επεξεργασία πλάνων και τιμών, έσοδα με ΦΠΑ και όλοι οι συνδρομητές ανά πλάνο. Μόνο για admins.
          </p>
        </motion.header>

        <div className="mt-10">
          {profile.loading && <LoadingSkeleton rows={3} />}
          {profile.error && <ErrorState message={profile.error} />}
          {profile.data && !admin && <LockedState reason="Αυτή η περιοχή είναι μόνο για admins της AURA." />}
          {profile.data && admin && <Dashboard />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard (loads everything once, passes it down)                   */
/* ------------------------------------------------------------------ */

async function fetchPayments(): Promise<PaymentRow[]> {
  const out: PaymentRow[] = [];
  const size = 1000;
  for (let from = 0; from < 100000; from += size) {
    const { data, error } = await sb
      .from("payments")
      .select("plan_id, amount_cents, amount_refunded_cents, paid_at")
      .order("paid_at", { ascending: false })
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PaymentRow[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

function Dashboard() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [vat, setVat] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [planRes, payList, userRes, vatRes] = await Promise.all([
        sb.from("plans").select("*").order("sort_order", { ascending: true }),
        fetchPayments(),
        sb.rpc("admin_plan_users"),
        sb.from("billing_settings").select("vat_rate").eq("id", true).maybeSingle(),
      ]);
      if (planRes.error) throw new Error(`plans: ${planRes.error.message}`);
      if (userRes.error) throw new Error(`users: ${userRes.error.message}`);

      setPlans(((planRes.data ?? []) as any[]).map(sanitizePlan));
      setPayments(payList);
      setUsers((userRes.data ?? []) as UserRow[]);
      if (vatRes.data && typeof (vatRes.data as any).vat_rate !== "undefined") {
        setVat(Number((vatRes.data as any).vat_rate));
      }
    } catch (e) {
      setError(errText(e, "Δεν φορτώθηκαν τα δεδομένα. Έτρεξες το SQL migration;"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { data, error: fnError } = await sb.functions.invoke("admin-billing-sync");
      if (fnError) {
        let detail = fnError.message;
        try {
          const body = await (fnError as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {
          /* keep default message */
        }
        throw new Error(detail);
      }
      const r = data as any;
      setSyncMsg({
        tone: r?.errors?.length ? "bad" : "ok",
        text: `Συγχρονίστηκαν ${r?.subscriptions ?? 0} συνδρομές και ${r?.payments ?? 0} πληρωμές${
          r?.skippedSubscriptions ? ` (${r.skippedSubscriptions} συνδρομές χωρίς χρήστη παραλείφθηκαν)` : ""
        }.${r?.errors?.length ? ` Προειδοποιήσεις: ${r.errors.slice(0, 3).join(" · ")}` : ""}`,
      });
      await load();
    } catch (e) {
      setSyncMsg({ tone: "bad", text: errText(e, "Ο συγχρονισμός απέτυχε.") });
    } finally {
      setSyncing(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorState message={error} />
        <button type="button" onClick={() => void load()} className="pu-btn">
          <RefreshCw className="size-4" /> Δοκίμασε ξανά
        </button>
      </div>
    );
  }

  if (!plans || !payments || !users) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Ενότητες">
          {[
            ["#plans", "Πλάνα"],
            ["#income", "Έσοδα"],
            ["#users", "Χρήστες"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="pu-chip">
              {label}
            </a>
          ))}
        </nav>
        <button type="button" onClick={() => void sync()} disabled={syncing} className="pu-btn pu-btn-primary">
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Συγχρονισμός με Stripe
        </button>
      </div>

      {syncMsg && (
        <Banner tone={syncMsg.tone} onClose={() => setSyncMsg(null)}>
          {syncMsg.text}
        </Banner>
      )}

      <PlansSection plans={plans} onChange={(row) => setPlans((list) => (list ?? []).map((p) => (p.id === row.id ? row : p)))} />
      <IncomeSection plans={plans} payments={payments} users={users} vat={vat} onVat={setVat} />
      <UsersSection plans={plans} users={users} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Plan editor                                                      */
/* ------------------------------------------------------------------ */

interface Draft {
  name: string;
  slogan: string;
  tagline: string;
  badge: string;
  price: string;
  features: string[];
  highlight: boolean;
  active: boolean;
}

function toDraft(p: PlanRow): Draft {
  return {
    name: p.name,
    slogan: p.slogan,
    tagline: p.tagline,
    badge: p.badge ?? "",
    price: (p.price_cents / 100).toFixed(2).replace(".", ","),
    features: [...p.features],
    highlight: p.highlight,
    active: p.active,
  };
}

function parsePriceCents(text: string): number | null {
  const n = Number(text.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function PlansSection({ plans, onChange }: { plans: PlanRow[]; onChange: (row: PlanRow) => void }) {
  return (
    <section className="space-y-8">
      <Reveal>
        <SectionHead id="plans" kicker="Plans" title="Πλάνα & τιμές" />
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/50">
          Οι αλλαγές εμφανίζονται άμεσα στη σελίδα τιμών και στο checkout. Η νέα τιμή ισχύει για{" "}
          <strong className="text-white/80">νέες συνδρομές</strong>· οι υπάρχοντες συνδρομητές συνεχίζουν να
          χρεώνονται την τιμή που είχαν όταν συνδέθηκαν. Οι τιμές είναι <strong className="text-white/80">τελικές, με ΦΠΑ</strong>.
        </p>
      </Reveal>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {plans.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.1}>
            <PlanEditor plan={p} onSaved={onChange} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function PlanEditor({ plan, onSaved }: { plan: PlanRow; onSaved: (row: PlanRow) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(plan));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  // Reset when the saved row changes (after a save or a reload).
  useEffect(() => {
    setDraft(toDraft(plan));
  }, [plan.updated_at, plan.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const original = useMemo(() => JSON.stringify(toDraft(plan)), [plan]);
  const dirty = JSON.stringify(draft) !== original;
  const cents = parsePriceCents(draft.price);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setMsg(null);
  };

  const setFeature = (index: number, value: string) =>
    set("features", draft.features.map((f, i) => (i === index ? value : f)));
  const moveFeature = (index: number, dir: -1 | 1) => {
    const next = [...draft.features];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    set("features", next);
  };

  async function save() {
    setMsg(null);
    const features = draft.features.map((f) => f.trim()).filter(Boolean);
    if (!draft.name.trim()) return setMsg({ tone: "bad", text: "Το όνομα είναι υποχρεωτικό." });
    if (cents === null || cents < 50) return setMsg({ tone: "bad", text: "Η τιμή πρέπει να είναι τουλάχιστον 0,50€." });
    if (cents > 9_999_999) return setMsg({ tone: "bad", text: "Η τιμή είναι υπερβολικά μεγάλη." });
    if (features.length === 0) return setMsg({ tone: "bad", text: "Πρόσθεσε τουλάχιστον ένα προνόμιο." });

    setSaving(true);
    try {
      const { data, error } = await sb
        .from("plans")
        .update({
          name: draft.name.trim(),
          slogan: draft.slogan.trim(),
          tagline: draft.tagline.trim(),
          badge: draft.badge.trim() || null,
          price_cents: cents,
          features,
          highlight: draft.highlight,
          active: draft.active,
        })
        .eq("id", plan.id)
        .select("*")
        .single();
      if (error) throw error;
      onSaved(sanitizePlan(data));
      invalidatePlans(); // public pages refetch the new prices
      setMsg({ tone: "ok", text: "Αποθηκεύτηκε. Ισχύει ήδη στη σελίδα τιμών και στο checkout." });
    } catch (e) {
      setMsg({ tone: "bad", text: errText(e, "Η αποθήκευση απέτυχε.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`pu-plan ${draft.highlight ? "pu-plan-hi" : ""} ${!draft.active ? "pu-plan-off" : ""}`}>
      {draft.highlight && <span className="pu-plan-border" aria-hidden />}
      <div className="pu-plan-inner">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">{plan.id === "low" ? "Επίπεδο 1" : plan.id === "mid" ? "Επίπεδο 2" : "Επίπεδο 3"}</p>
            <h3 className="pu-title mt-2 truncate text-2xl font-bold tracking-[0.1em]">{draft.name || "—"}</h3>
          </div>
          <div className="text-right">
            <p className="pu-price text-4xl font-bold leading-none">{cents !== null && cents >= 0 ? formatEuro(cents) : "—"}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/40">/ μήνα</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Όνομα πλάνου">
            <input className="pu-input" value={draft.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
          </Field>

          <Field label="Τιμή (€ / μήνα, με ΦΠΑ)">
            <div className="relative">
              <Euro className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <input
                className="pu-input pl-9"
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => set("price", e.target.value)}
                aria-invalid={cents === null || cents < 50}
              />
            </div>
          </Field>

          <Field label="Slogan">
            <input className="pu-input" value={draft.slogan} maxLength={80} onChange={(e) => set("slogan", e.target.value)} />
          </Field>

          <Field label="Περιγραφή">
            <textarea className="pu-input min-h-[104px] resize-y" value={draft.tagline} maxLength={400} onChange={(e) => set("tagline", e.target.value)} />
          </Field>

          <Field label="Badge (προαιρετικό, π.χ. ΔΗΜΟΦΙΛΕΣ)">
            <input className="pu-input" value={draft.badge} maxLength={24} onChange={(e) => set("badge", e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Toggle label="Επιλεγμένο (highlight)" checked={draft.highlight} onChange={(v) => set("highlight", v)} />
            <Toggle label="Ενεργό στο site" checked={draft.active} onChange={(v) => set("active", v)} />
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/45">Προνόμια ({draft.features.length})</p>
            <ul className="space-y-2">
              {draft.features.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <input className="pu-input py-2 text-[13px]" value={f} onChange={(e) => setFeature(i, e.target.value)} aria-label={`Προνόμιο ${i + 1}`} />
                  <button type="button" className="pu-icon" onClick={() => moveFeature(i, -1)} disabled={i === 0} aria-label="Πάνω">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" className="pu-icon" onClick={() => moveFeature(i, 1)} disabled={i === draft.features.length - 1} aria-label="Κάτω">
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button type="button" className="pu-icon pu-icon-danger" onClick={() => set("features", draft.features.filter((_, k) => k !== i))} aria-label="Διαγραφή">
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="pu-btn mt-3 w-full justify-center" onClick={() => set("features", [...draft.features, ""])}>
              <Plus className="size-4" /> Νέο προνόμιο
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-5">
            <Banner tone={msg.tone} onClose={() => setMsg(null)}>
              {msg.text}
            </Banner>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => void save()} disabled={!dirty || saving} className="pu-btn pu-btn-primary flex-1 justify-center">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Αποθήκευση
          </button>
          <button type="button" onClick={() => { setDraft(toDraft(plan)); setMsg(null); }} disabled={!dirty || saving} className="pu-btn" aria-label="Επαναφορά">
            <Undo2 className="size-4" />
          </button>
        </div>
        <p className="mt-3 text-[11px] text-white/30">Τελευταία αλλαγή: {fmtDate(plan.updated_at)}</p>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/45">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`pu-toggle ${checked ? "pu-toggle-on" : ""}`}
    >
      <span className="pu-toggle-knob" aria-hidden />
      <span className="text-[11px] leading-tight">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Income (gross / VAT / net)                                       */
/* ------------------------------------------------------------------ */

const COLS = ["Αυτός ο μήνας", "Προηγ. μήνας", "Τελευταίοι 12 μήνες", "Σύνολο"] as const;

type Cells = [number, number, number, number];
type Agg = Record<string, { cells: Cells; count: number }>;

function aggregate(payments: PaymentRow[]) {
  const now = new Date();
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const start12 = new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime();

  const agg: Agg = {};
  const months: { label: string; key: string; cents: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("el-GR", { month: "short" }),
      cents: 0,
    });
  }

  for (const p of payments) {
    const key = p.plan_id === "low" || p.plan_id === "mid" || p.plan_id === "high" ? p.plan_id : "other";
    const cents = p.amount_cents - (p.amount_refunded_cents || 0);
    const t = new Date(p.paid_at);
    const ts = t.getTime();
    const row = (agg[key] ??= { cells: [0, 0, 0, 0], count: 0 });
    row.cells[3] += cents;
    row.count += 1;
    if (ts >= startThis) row.cells[0] += cents;
    else if (ts >= startPrev) row.cells[1] += cents;
    if (ts >= start12) {
      row.cells[2] += cents;
      const bucket = months.find((m) => m.key === `${t.getFullYear()}-${t.getMonth()}`);
      if (bucket) bucket.cents += cents;
    }
  }
  return { agg, months };
}

const vatOf = (gross: number, rate: number) => Math.round((gross * rate) / (100 + rate));

function IncomeSection({
  plans,
  payments,
  users,
  vat,
  onVat,
}: {
  plans: PlanRow[];
  payments: PaymentRow[];
  users: UserRow[];
  vat: number;
  onVat: (v: number) => void;
}) {
  const { agg, months } = useMemo(() => aggregate(payments), [payments]);

  const rows = useMemo(() => {
    const list: { key: string; label: string }[] = plans.map((p) => ({ key: p.id, label: p.name }));
    if (agg["other"]) list.push({ key: "other", label: "Άλλο / άγνωστο πλάνο" });
    return list;
  }, [plans, agg]);

  const gross = (key: string): Cells => agg[key]?.cells ?? [0, 0, 0, 0];
  const grossTotals = rows.reduce<Cells>((acc, r) => {
    const c = gross(r.key);
    return [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2], acc[3] + c[3]];
  }, [0, 0, 0, 0]);

  const activeUsers = users.filter((u) => u.status === "active" || u.status === "trialing");
  const mrr = activeUsers.reduce((sum, u) => {
    if (u.cancel_at_period_end) return sum;
    const planPrice = plans.find((p) => p.id === u.plan_id)?.price_cents ?? 0;
    return sum + (u.last_paid_cents ?? planPrice);
  }, 0);

  const maxMonth = Math.max(1, ...months.map((m) => m.cents));
  const totalCount = rows.reduce((n, r) => n + (agg[r.key]?.count ?? 0), 0);

  return (
    <section className="space-y-8">
      <Reveal>
        <SectionHead
          id="income"
          kicker="Income"
          title="Έσοδα & ΦΠΑ"
          right={<VatControl vat={vat} onVat={onVat} />}
        />
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/50">
          Υπολογίζονται από τις πραγματικές πληρωμές του Stripe (μείον επιστροφές). Οι τιμές θεωρούνται{" "}
          <strong className="text-white/80">με ΦΠΑ {vat}%</strong>, άρα ΦΠΑ = τζίρος × {vat}/{100 + vat}.
          Το «καθαρό» είναι ο τζίρος χωρίς ΦΠΑ, πριν από προμήθειες Stripe και έξοδα.
        </p>
      </Reveal>

      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={<UsersIcon className="size-5" />} label="Ενεργοί συνδρομητές" value={String(activeUsers.length)} hint={`${users.length} συνολικά`} />
          <Kpi icon={<CalendarClock className="size-5" />} label="Μηνιαίο έσοδο (MRR)" value={money(mrr)} hint="Μεικτό, από ενεργές συνδρομές" />
          <Kpi icon={<Wallet className="size-5" />} label="Τζίρος αυτού του μήνα" value={money(grossTotals[0])} hint={`Προηγ. μήνας: ${money(grossTotals[1])}`} />
          <Kpi icon={<Receipt className="size-5" />} label="Συνολικός τζίρος" value={money(grossTotals[3])} hint={`${totalCount} πληρωμές`} />
        </div>
      </Reveal>

      {totalCount === 0 && (
        <Banner tone="info">
          Δεν υπάρχουν καταγεγραμμένες πληρωμές ακόμη. Πάτα «Συγχρονισμός με Stripe» για να φέρεις το ιστορικό.
        </Banner>
      )}

      <Reveal>
        <div className="pu-panel p-6 sm:p-8">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Τζίρος ανά μήνα · 12 μήνες</h3>
            <span className="text-xs text-white/35">Μεικτός</span>
          </div>
          <div className="mt-8 flex h-44 items-end gap-2 sm:gap-3" role="img" aria-label="Μηνιαίος τζίρος, τελευταίοι 12 μήνες">
            {months.map((m, i) => (
              <div key={m.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="pu-bar-tip">{money(m.cents)}</span>
                <motion.div
                  initial={{ height: 0 }}
                  whileInView={{ height: `${Math.max(3, (m.cents / maxMonth) * 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease: EASE, delay: i * 0.04 }}
                  className="pu-bar w-full"
                  title={`${m.label}: ${money(m.cents)}`}
                />
                <span className="text-[10px] uppercase tracking-wider text-white/40">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6">
        <Reveal>
          <MoneyTable
            title="1 · Τζίρος (μεικτό)"
            subtitle="Ό,τι χρεώθηκαν οι πελάτες, με ΦΠΑ"
            rows={rows.map((r) => ({ label: r.label, cells: gross(r.key) }))}
            totals={grossTotals}
          />
        </Reveal>
        <Reveal>
          <MoneyTable
            title={`2 · ΦΠΑ ${vat}%`}
            subtitle="Το ποσό που αναλογεί στο ΦΠΑ (αποδίδεται στην εφορία)"
            rows={rows.map((r) => ({ label: r.label, cells: gross(r.key).map((c) => vatOf(c, vat)) as Cells }))}
            totals={rows.reduce<Cells>((acc, r) => {
              const c = gross(r.key).map((x) => vatOf(x, vat));
              return [acc[0] + (c[0] ?? 0), acc[1] + (c[1] ?? 0), acc[2] + (c[2] ?? 0), acc[3] + (c[3] ?? 0)];
            }, [0, 0, 0, 0])}
            tone="vat"
          />
        </Reveal>
        <Reveal>
          <MoneyTable
            title="3 · Καθαρό (τζίρος − ΦΠΑ)"
            subtitle="Έσοδα χωρίς ΦΠΑ, πριν από προμήθειες Stripe"
            rows={rows.map((r) => ({
              label: r.label,
              cells: gross(r.key).map((c) => c - vatOf(c, vat)) as Cells,
            }))}
            totals={rows.reduce<Cells>((acc, r) => {
              const c = gross(r.key).map((x) => x - vatOf(x, vat));
              return [acc[0] + (c[0] ?? 0), acc[1] + (c[1] ?? 0), acc[2] + (c[2] ?? 0), acc[3] + (c[3] ?? 0)];
            }, [0, 0, 0, 0])}
            tone="net"
          />
        </Reveal>
      </div>
    </section>
  );
}

function MoneyTable({
  title,
  subtitle,
  rows,
  totals,
  tone,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; cells: Cells }[];
  totals: Cells;
  tone?: "vat" | "net";
}) {
  return (
    <div className={`pu-panel overflow-hidden ${tone === "net" ? "pu-panel-net" : ""}`}>
      <div className="border-b border-white/10 px-6 py-5 sm:px-8">
        <h3 className="pu-title text-lg font-bold tracking-wide sm:text-xl">{title}</h3>
        <p className="mt-1 text-xs text-white/40">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-white/40">
              <th scope="col" className="px-6 py-3 font-medium sm:px-8">Πλάνο</th>
              {COLS.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 text-right font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-white/[0.06] transition-colors hover:bg-white/[0.03]">
                <th scope="row" className="px-6 py-4 text-left font-medium text-white/85 sm:px-8">{r.label}</th>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-4 py-4 text-right tabular-nums text-white/70">{money(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/20 bg-white/[0.04]">
              <th scope="row" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-white sm:px-8">Σύνολο</th>
              {totals.map((c, i) => (
                <td key={i} className="pu-total px-4 py-4 text-right font-bold tabular-nums">{money(c)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function VatControl({ vat, onVat }: { vat: number; onVat: (v: number) => void }) {
  const [text, setText] = useState(String(vat));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setText(String(vat)), [vat]);

  async function save() {
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) return setMsg("0–100");
    setSaving(true);
    setMsg(null);
    const { error } = await sb.from("billing_settings").update({ vat_rate: n, updated_at: new Date().toISOString() }).eq("id", true);
    setSaving(false);
    if (error) return setMsg(error.message);
    onVat(n);
    setMsg("✓");
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/60">
        <Percent className="size-3.5" /> ΦΠΑ
        <input
          className="w-14 bg-transparent text-right text-sm text-white outline-none"
          inputMode="decimal"
          value={text}
          onChange={(e) => { setText(e.target.value); setMsg(null); }}
          aria-label="Συντελεστής ΦΠΑ %"
        />
        %
      </label>
      <button type="button" className="pu-btn" onClick={() => void save()} disabled={saving || Number(text.replace(",", ".")) === vat}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </button>
      {msg && <span className="text-xs text-white/50">{msg}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Users per plan                                                   */
/* ------------------------------------------------------------------ */

type StatusFilter = "all" | "active" | "attention" | "ended";

function bucketOf(u: UserRow): Exclude<StatusFilter, "all"> {
  if (u.status === "canceled" || u.status === "incomplete_expired") return "ended";
  if (u.status === "active" || u.status === "trialing") return u.cancel_at_period_end ? "attention" : "active";
  return "attention"; // past_due, unpaid, incomplete, paused...
}

type Tone = "ok" | "warn" | "bad" | "muted";

function renewalOf(u: UserRow): { label: string; tone: Tone } {
  if (u.status === "canceled" || u.status === "incomplete_expired") return { label: "Ακυρώθηκε", tone: "muted" };
  if (u.status === "past_due" || u.status === "unpaid") return { label: "Απέτυχε η ανανέωση", tone: "bad" };
  if (u.status === "incomplete") return { label: "Πληρωμή σε εκκρεμότητα", tone: "warn" };
  if (u.cancel_at_period_end) return { label: "Δεν θα ανανεωθεί", tone: "warn" };
  if (u.payments_count === 0) return { label: "Χωρίς πληρωμή στο ledger · Συγχρονισμός", tone: "warn" };
  if (u.last_billing_reason === "subscription_cycle") return { label: "Ανανεώθηκε ✓", tone: "ok" };
  return { label: "Πρώτος μήνας · ανανέωση στη λήξη", tone: "ok" };
}

function expiryOf(u: UserRow): { main: string; sub: string } {
  const end = u.current_period_end ? new Date(u.current_period_end) : null;
  if (!end) return { main: "—", sub: "" };
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  const when = days === 0 ? "σήμερα" : days > 0 ? `σε ${days} ${days === 1 ? "μέρα" : "μέρες"}` : `πριν ${-days} ${days === -1 ? "μέρα" : "μέρες"}`;
  if (u.status === "canceled" || u.status === "incomplete_expired") return { main: fmtDate(u.current_period_end), sub: `Έληξε ${when}` };
  if (u.status === "past_due" || u.status === "unpaid") return { main: fmtDate(u.current_period_end), sub: `Ληξιπρόθεσμη ${when}` };
  if (u.cancel_at_period_end) return { main: fmtDate(u.current_period_end), sub: `Λήγει ${when}` };
  return { main: fmtDate(u.current_period_end), sub: `Επόμενη χρέωση ${when}` };
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function UsersSection({ plans, users }: { plans: PlanRow[]; users: UserRow[] }) {
  const [tab, setTab] = useState<"all" | PlanKey>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const planName = useCallback((id: string) => plans.find((p) => p.id === id)?.name ?? id, [plans]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users.length, low: 0, mid: 0, high: 0 };
    for (const u of users) c[u.plan_id] = (c[u.plan_id] ?? 0) + 1;
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (tab !== "all" && u.plan_id !== tab) return false;
      if (status !== "all" && bucketOf(u) !== status) return false;
      if (!q) return true;
      return [u.email, u.full_name, u.username].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [users, tab, status, query]);

  function exportCsv() {
    const head = ["Email", "Όνομα", "Username", "Πλάνο", "Κατάσταση", "Έναρξη", "Τελευταία πληρωμή", "Ποσό τελευταίας", "Λήξη περιόδου", "Δεν ανανεώνεται", "Πληρωμές", "Σύνολο πληρωμένο (€)"];
    const lines = filtered.map((u) =>
      [
        u.email, u.full_name, u.username, planName(u.plan_id), u.status,
        fmtDate(u.subscribed_at), fmtDate(u.last_paid_at),
        u.last_paid_cents !== null ? (u.last_paid_cents / 100).toFixed(2) : "",
        fmtDate(u.current_period_end), u.cancel_at_period_end ? "ναι" : "όχι",
        u.payments_count, (u.total_paid_cents / 100).toFixed(2),
      ].map(csvCell).join(";"),
    );
    const blob = new Blob(["\uFEFF" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aura-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { key: "all" | PlanKey; label: string }[] = [
    { key: "all", label: "Όλα" },
    ...PLAN_KEYS.map((k) => ({ key: k, label: planName(k) })),
  ];
  const statuses: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Όλοι" },
    { key: "active", label: "Ενεργοί" },
    { key: "attention", label: "Θέλουν προσοχή" },
    { key: "ended", label: "Έληξαν" },
  ];

  return (
    <section className="space-y-8">
      <Reveal>
        <SectionHead
          id="users"
          kicker="Subscribers"
          title="Χρήστες ανά πλάνο"
          right={
            <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="pu-btn">
              <Download className="size-4" /> Εξαγωγή CSV
            </button>
          }
        />
      </Reveal>

      <Reveal>
        <div className="space-y-4">
          <div role="tablist" aria-label="Πλάνο" className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`pu-tab ${tab === t.key ? "pu-tab-on" : ""}`}>
                {t.label}
                <span className="pu-tab-count">{counts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button key={s.key} type="button" onClick={() => setStatus(s.key)} aria-pressed={status === s.key} className={`pu-chip ${status === s.key ? "pu-chip-on" : ""}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <label className="relative ml-auto w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
              <input className="pu-input pl-9" placeholder="Αναζήτηση email, όνομα, username…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Αναζήτηση χρηστών" />
            </label>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="pu-panel overflow-hidden">
          {/* desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-white/40">
                  <th scope="col" className="px-6 py-4 font-medium">Χρήστης</th>
                  <th scope="col" className="px-4 py-4 font-medium">Πλάνο</th>
                  <th scope="col" className="px-4 py-4 font-medium">Κατάσταση</th>
                  <th scope="col" className="px-4 py-4 font-medium">Τελευταία πληρωμή</th>
                  <th scope="col" className="px-4 py-4 font-medium">Λήξη συνδρομής</th>
                  <th scope="col" className="px-4 py-4 font-medium">Επαναπληρωμή</th>
                  <th scope="col" className="px-6 py-4 text-right font-medium">Σύνολο</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const ren = renewalOf(u);
                  const exp = expiryOf(u);
                  return (
                    <tr key={u.user_id} className="border-t border-white/[0.06] align-middle transition-colors hover:bg-white/[0.03]">
                      <td className="px-6 py-4"><Person u={u} /></td>
                      <td className="px-4 py-4"><PlanPill id={u.plan_id} name={planName(u.plan_id)} /></td>
                      <td className="px-4 py-4"><StatusPill status={u.status} cancelling={u.cancel_at_period_end} /></td>
                      <td className="px-4 py-4">
                        <p className="text-white/85">{fmtDate(u.last_paid_at)}</p>
                        <p className="text-xs text-white/40">{u.last_paid_cents !== null ? money(u.last_paid_cents) : "—"} · {u.payments_count} πληρωμές</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-white/85">{exp.main}</p>
                        <p className="text-xs text-white/40">{exp.sub}</p>
                      </td>
                      <td className="px-4 py-4"><Tag tone={ren.tone}>{ren.label}</Tag></td>
                      <td className="px-6 py-4 text-right tabular-nums text-white/80">{money(u.total_paid_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* mobile / tablet cards */}
          <ul className="divide-y divide-white/[0.06] lg:hidden">
            {filtered.map((u) => {
              const ren = renewalOf(u);
              const exp = expiryOf(u);
              return (
                <li key={u.user_id} className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Person u={u} />
                    <PlanPill id={u.plan_id} name={planName(u.plan_id)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status={u.status} cancelling={u.cancel_at_period_end} />
                    <Tag tone={ren.tone}>{ren.label}</Tag>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.2em] text-white/35">Τελευταία πληρωμή</dt>
                      <dd className="mt-1 text-white/85">{fmtDate(u.last_paid_at)}</dd>
                      <dd className="text-xs text-white/40">{u.last_paid_cents !== null ? money(u.last_paid_cents) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.2em] text-white/35">Λήξη συνδρομής</dt>
                      <dd className="mt-1 text-white/85">{exp.main}</dd>
                      <dd className="text-xs text-white/40">{exp.sub}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.2em] text-white/35">Πληρωμές</dt>
                      <dd className="mt-1 text-white/85">{u.payments_count}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.2em] text-white/35">Σύνολο</dt>
                      <dd className="mt-1 text-white/85">{money(u.total_paid_cents)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 && (
            <p className="px-6 py-14 text-center text-sm text-white/40">
              {users.length === 0 ? "Δεν υπάρχουν συνδρομητές ακόμη." : "Κανένας χρήστης με αυτά τα φίλτρα."}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-white/30">{filtered.length} από {users.length} χρήστες</p>
      </Reveal>
    </section>
  );
}

function Person({ u }: { u: UserRow }) {
  const name = u.full_name?.trim() || u.username || (u.email ?? "—");
  const [broken, setBroken] = useState(false);
  const showImg = u.avatar_url && !broken;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="pu-avatar">
        {showImg ? (
          <img src={u.avatar_url as string} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span>{name.slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-white/90">{name}</p>
        <p className="truncate text-xs text-white/45">{u.email ?? "—"}</p>
        {u.username && <p className="truncate text-[11px] text-white/30">@{u.username}</p>}
      </div>
    </div>
  );
}

function PlanPill({ id, name }: { id: string; name: string }) {
  return (
    <span className={`pu-plan-pill ${id === "high" ? "pu-plan-pill-elite" : ""}`}>
      {id === "high" && <Crown className="size-3" />}
      {name}
    </span>
  );
}

function StatusPill({ status, cancelling }: { status: string; cancelling: boolean }) {
  const map: Record<string, { label: string; tone: Tone }> = {
    active: { label: cancelling ? "Ενεργή (λήγει)" : "Ενεργή", tone: cancelling ? "warn" : "ok" },
    trialing: { label: "Δοκιμή", tone: "ok" },
    past_due: { label: "Ληξιπρόθεσμη", tone: "bad" },
    unpaid: { label: "Απλήρωτη", tone: "bad" },
    incomplete: { label: "Ημιτελής", tone: "warn" },
    incomplete_expired: { label: "Έληξε", tone: "muted" },
    canceled: { label: "Ακυρωμένη", tone: "muted" },
    paused: { label: "Σε παύση", tone: "warn" },
  };
  const s = map[status] ?? { label: status, tone: "muted" as Tone };
  return <Tag tone={s.tone}>{s.label}</Tag>;
}

function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  const cls: Record<Tone, string> = {
    ok: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    bad: "border-red-400/30 bg-red-500/10 text-red-300",
    muted: "border-white/15 bg-white/[0.04] text-white/55",
  };
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${cls[tone]}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const css = `
@keyframes pu-spin { to { transform: rotate(360deg); } }
@keyframes pu-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes pu-pulse { 0%,100% { opacity: .5; } 50% { opacity: .95; } }

.pu-grid {
  background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size: 58px 58px;
  -webkit-mask-image: radial-gradient(ellipse 75% 45% at 50% 12%, #000 15%, transparent 75%);
          mask-image: radial-gradient(ellipse 75% 45% at 50% 12%, #000 15%, transparent 75%);
  pointer-events: none;
}
.pu-orb { position: absolute; border-radius: 9999px; pointer-events: none; filter: blur(46px);
  background: radial-gradient(circle at 35% 30%, rgba(232,236,242,.14), rgba(160,168,180,.05) 45%, transparent 70%); }

.pu-title, .pu-price, .pu-kpi-value, .pu-total {
  background: linear-gradient(110deg, #6b7280 0%, #f8fafc 22%, #9ca3af 42%, #ffffff 58%, #8b93a1 78%, #f1f5f9 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: pu-shimmer 8s linear infinite;
}
.pu-kicker { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: .5em; text-transform: uppercase; color: rgba(255,255,255,.55); }
.pu-back { display: inline-flex; align-items: center; gap: .6rem; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: rgba(255,255,255,.55); transition: color .25s, transform .25s; }
.pu-back:hover { color: #fff; transform: translateX(-3px); }

.pu-btn {
  display: inline-flex; align-items: center; gap: .5rem; padding: .6rem 1rem; border-radius: .8rem; font-size: 12px; font-weight: 500; color: #e8ecf2; cursor: pointer;
  border: 1px solid rgba(255,255,255,.15); background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
  transition: border-color .25s, box-shadow .25s, transform .15s, opacity .2s;
}
.pu-btn:hover:not(:disabled) { border-color: rgba(255,255,255,.4); box-shadow: 0 0 26px -8px rgba(232,236,242,.55); transform: translateY(-1px); }
.pu-btn:active:not(:disabled) { transform: translateY(1px); }
.pu-btn:disabled { opacity: .4; cursor: not-allowed; }
.pu-btn-primary { color: #0b0b0c; border-color: rgba(255,255,255,.6); background: linear-gradient(180deg, #ffffff, #aab0ba); box-shadow: 0 0 30px -8px rgba(232,236,242,.6), inset 0 1px 0 rgba(255,255,255,.9); }
.pu-btn-primary:hover:not(:disabled) { box-shadow: 0 0 40px -6px rgba(232,236,242,.85), inset 0 1px 0 #fff; }

.pu-chip, .pu-tab {
  display: inline-flex; align-items: center; gap: .5rem; padding: .45rem .95rem; border-radius: 9999px; font-size: 12px; color: rgba(255,255,255,.6); cursor: pointer;
  border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.03); transition: color .2s, border-color .2s, background .2s, box-shadow .2s;
}
.pu-chip:hover, .pu-tab:hover { color: #fff; border-color: rgba(255,255,255,.35); }
.pu-chip-on, .pu-tab-on { color: #fff; border-color: rgba(232,236,242,.6); background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.03)); box-shadow: 0 0 24px -8px rgba(232,236,242,.6); }
.pu-tab { padding: .6rem 1.2rem; font-size: 13px; }
.pu-tab-count { display: inline-grid; place-items: center; min-width: 1.4rem; height: 1.4rem; padding: 0 .35rem; border-radius: 9999px; font-size: 11px; background: rgba(255,255,255,.1); color: #fff; }

.pu-input {
  width: 100%; padding: .7rem .9rem; border-radius: .75rem; font-size: 14px; color: #f3f4f6; outline: none;
  border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.4);
  transition: border-color .25s, box-shadow .25s, background-color .25s;
}
.pu-input::placeholder { color: rgba(255,255,255,.3); }
.pu-input:focus { border-color: rgba(232,236,242,.55); background-color: rgba(0,0,0,.55); box-shadow: 0 0 0 1px rgba(232,236,242,.3), 0 0 26px -8px rgba(232,236,242,.45); }
.pu-input[aria-invalid="true"] { border-color: rgba(248,113,113,.6); }
.pu-icon { display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0; border-radius: .6rem; color: rgba(255,255,255,.55); cursor: pointer; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.03); transition: color .2s, border-color .2s; }
.pu-icon:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,.35); }
.pu-icon:disabled { opacity: .25; cursor: not-allowed; }
.pu-icon-danger:hover:not(:disabled) { color: #fca5a5; border-color: rgba(248,113,113,.5); }

.pu-toggle { display: flex; align-items: center; gap: .6rem; padding: .55rem .7rem; border-radius: .75rem; text-align: left; color: rgba(255,255,255,.6); cursor: pointer; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.03); transition: border-color .25s, color .25s; }
.pu-toggle-knob { position: relative; flex-shrink: 0; width: 30px; height: 18px; border-radius: 9999px; background: rgba(255,255,255,.12); transition: background .25s; }
.pu-toggle-knob::after { content: ""; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px; border-radius: 9999px; background: #9ca3af; transition: transform .25s, background .25s; }
.pu-toggle-on { color: #fff; border-color: rgba(232,236,242,.45); }
.pu-toggle-on .pu-toggle-knob { background: rgba(232,236,242,.35); }
.pu-toggle-on .pu-toggle-knob::after { transform: translateX(12px); background: #fff; box-shadow: 0 0 10px rgba(255,255,255,.8); }

.pu-panel {
  border-radius: 1.4rem; border: 1px solid rgba(255,255,255,.1);
  background: linear-gradient(180deg, rgba(20,21,27,.94), rgba(9,10,13,.97));
  box-shadow: 0 30px 80px -40px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.05);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
}
.pu-panel-net { border-color: rgba(232,236,242,.28); box-shadow: 0 30px 80px -40px rgba(0,0,0,.9), 0 0 70px -34px rgba(232,236,242,.5), inset 0 1px 0 rgba(255,255,255,.08); }

.pu-kpi { position: relative; overflow: hidden; padding: 1.5rem; border-radius: 1.2rem; border: 1px solid rgba(255,255,255,.12);
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.01)); transition: border-color .3s, box-shadow .3s, transform .3s; }
.pu-kpi:hover { border-color: rgba(232,236,242,.4); box-shadow: 0 0 40px -14px rgba(232,236,242,.5); transform: translateY(-3px); }
.pu-kpi-icon { position: absolute; right: 1.2rem; top: 1.2rem; color: rgba(255,255,255,.35); }

.pu-bar { border-radius: .5rem .5rem .2rem .2rem; background: linear-gradient(180deg, #ffffff, #7b828d 70%, #444a53); box-shadow: 0 0 18px -4px rgba(232,236,242,.5); min-height: 3px; }
.pu-bar-tip { font-size: 10px; color: #fff; opacity: 0; transform: translateY(4px); transition: opacity .2s, transform .2s; white-space: nowrap; }
.group:hover .pu-bar-tip { opacity: 1; transform: none; }

.pu-plan { position: relative; border-radius: 1.4rem; padding: 1px; overflow: hidden; isolation: isolate; background: rgba(255,255,255,.1); transition: box-shadow .4s, background .4s; }
.pu-plan:hover { background: rgba(255,255,255,.2); box-shadow: 0 30px 80px -40px rgba(232,236,242,.35); }
.pu-plan-hi { box-shadow: 0 0 80px -30px rgba(232,236,242,.45); }
.pu-plan-off { opacity: .6; }
.pu-plan-border { position: absolute; inset: -60%; z-index: -1;
  background: conic-gradient(from 0deg, transparent 0 50%, rgba(255,255,255,0) 56%, rgba(232,236,242,.95) 74%, rgba(255,255,255,0) 90%, transparent 100%); animation: pu-spin 8s linear infinite; }
.pu-plan-inner { position: relative; padding: 1.6rem; border-radius: calc(1.4rem - 1px); background: linear-gradient(180deg, rgba(22,23,29,.97), rgba(8,9,12,.99)); }

.pu-avatar { display: grid; place-items: center; flex-shrink: 0; width: 42px; height: 42px; border-radius: 9999px; overflow: hidden; font-size: 15px; color: #e5e7eb;
  background: radial-gradient(circle at 30% 25%, #3a3b40, #16171a); border: 1px solid rgba(232,236,242,.35); box-shadow: 0 4px 12px rgba(0,0,0,.5); }
.pu-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pu-plan-pill { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .8rem; border-radius: 9999px; font-size: 11px; font-weight: 600; letter-spacing: .12em; color: #e8ecf2; border: 1px solid rgba(232,236,242,.3); background: rgba(255,255,255,.05); white-space: nowrap; }
.pu-plan-pill-elite { color: #fff; border-color: rgba(255,255,255,.6); background: linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.04)); box-shadow: 0 0 22px -6px rgba(232,236,242,.7); }

.pu-root a:focus-visible, .pu-root button:focus-visible, .pu-root input:focus-visible, .pu-root textarea:focus-visible { outline: 2px solid rgba(232,236,242,.8); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .pu-title, .pu-price, .pu-kpi-value, .pu-total, .pu-plan-border { animation: none !important; } }
`;