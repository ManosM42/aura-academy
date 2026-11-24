// src/components/aura/admin/VivaAdminSection.tsx
//
// Admin panel section for the Viva.com payments:
//   * which provider new subscription checkouts use (Viva / Stripe)
//   * a connection health check (secrets, Viva credentials, webhook activity)
//   * the latest Viva payments of every kind (subscriptions, upgrades, seminars, books)
//   * the personal details customers entered in the checkout (searchable, CSV export)
// It uses the admin page's own styles (pu-*), so it must be rendered inside that page.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/plans";

type Provider = "viva" | "stripe";

interface ActivityRow {
  created_at: string;
  kind: string;
  status: string;
  amount_cents: number;
  label: string | null;
  who: string | null;
  email: string | null;
  order_code: string | null;
  failure_reason: string | null;
  environment: string | null;
}

interface CustomerRow {
  user_id: string;
  email: string | null;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postal_code: string;
  country: string;
  wants_invoice: boolean;
  company_name: string | null;
  vat_number: string | null;
  tax_office: string | null;
  updated_at: string;
}

interface SubscriptionRow {
  user_id: string;
  provider: string | null;
  status: string;
  plan_id: string;
}

interface Health {
  environment: string | null;
  provider: string | null;
  graceDays: number | null;
  secrets: Record<string, boolean>;
  missing: string[];
  oauth: { ok: boolean; error?: string };
  lastWebhookAt: string | null;
  webhook24h: Record<string, number>;
  pendingOrders24h: number;
}

const KIND_LABEL: Record<string, string> = {
  subscription_initial: "Νέα συνδρομή",
  subscription_renewal: "Ανανέωση",
  subscription_upgrade: "Αναβάθμιση",
  seminar: "Σεμινάριο",
  book: "Βιβλίο",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Πληρώθηκε", cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" },
  shipped: { label: "Στάλθηκε", cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" },
  delivered: { label: "Παραδόθηκε", cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" },
  pending: { label: "Εκκρεμεί", cls: "border-amber-400/30 bg-amber-500/10 text-amber-200" },
  failed: { label: "Απέτυχε", cls: "border-red-400/30 bg-red-500/10 text-red-200" },
  cancelled: { label: "Ακυρώθηκε", cls: "border-red-400/30 bg-red-500/10 text-red-200" },
  expired: { label: "Έληξε", cls: "border-white/15 bg-white/[0.04] text-white/60" },
  refunded: { label: "Επιστράφηκε", cls: "border-white/15 bg-white/[0.04] text-white/60" },
};

const SECRET_LABEL: Record<string, string> = {
  VIVA_ENV: "VIVA_ENV (sandbox ή production)",
  CLIENT_ID: "Smart Checkout Client ID",
  CLIENT_SECRET: "Smart Checkout Client Secret",
  SOURCE_CODE: "Payment source code",
  WEBHOOK_KEY: "Webhook key",
  MERCHANT_ID: "Merchant ID (ανανεώσεις)",
  API_KEY: "API key (ανανεώσεις)",
  CRON_SECRET: "CRON_SECRET (αυτόματες ανανεώσεις)",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Pill({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export default function VivaAdminSection() {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [providerMsg, setProviderMsg] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);

  const [health, setHealth] = useState<Health | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [settings, act, prof, subscriptions] = await Promise.all([
        db.from("billing_settings").select("active_provider").eq("id", true).maybeSingle(),
        db.rpc("admin_viva_activity", { p_limit: 80 }),
        db.rpc("admin_billing_profiles"),
        db.from("subscriptions").select("user_id, provider, status, plan_id").in("status", ["active", "trialing"]),
      ]);
      const p = (settings.data as { active_provider?: string } | null)?.active_provider;
      setProvider(p === "stripe" ? "stripe" : "viva");
      if (act.error) throw new Error(act.error.message);
      if (prof.error) throw new Error(prof.error.message);
      setActivity((act.data ?? []) as ActivityRow[]);
      setCustomers((prof.data ?? []) as CustomerRow[]);
      setSubs((subscriptions.data ?? []) as SubscriptionRow[]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Η φόρτωση απέτυχε.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function chooseProvider(next: Provider) {
    if (next === provider || savingProvider) return;
    setSavingProvider(true);
    setProviderMsg(null);
    const { error } = await db.from("billing_settings").update({ active_provider: next, viva_admin_only: false }).eq("id", true);
    setSavingProvider(false);
    if (error) {
      setProviderMsg("Αποτυχία: " + error.message);
      return;
    }
    setProvider(next);
    setProviderMsg(next === "viva" ? "Οι νέες συνδρομές πληρώνονται πλέον με Viva." : "Οι νέες συνδρομές πληρώνονται πλέον με Stripe.");
  }

  async function runHealth() {
    setHealthBusy(true);
    setHealthError(null);
    try {
      const { data, error } = await db.functions.invoke<Health>("viva-health", { body: {} });
      if (error) throw new Error(error.message);
      setHealth(data ?? null);
    } catch (err) {
      setHealth(null);
      setHealthError(err instanceof Error ? err.message : "Ο έλεγχος απέτυχε.");
    } finally {
      setHealthBusy(false);
    }
  }

  const subByUser = useMemo(() => {
    const m = new Map<string, SubscriptionRow>();
    for (const s of subs) m.set(s.user_id, s);
    return m;
  }, [subs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers ?? [];
    return (customers ?? []).filter((c) =>
      [c.full_name, c.email, c.phone, c.city, c.company_name, c.vat_number].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [customers, query]);

  const counts = useMemo(() => {
    const out = { viva: 0, stripe: 0 };
    for (const s of subs) {
      if (s.provider === "viva") out.viva += 1;
      else out.stripe += 1;
    }
    return out;
  }, [subs]);

  function exportCsv() {
    const header = ["Ονοματεπώνυμο", "Email", "Τηλέφωνο", "Διεύθυνση", "Όροφος", "Πόλη", "Τ.Κ.", "Χώρα", "Τιμολόγιο", "Επωνυμία", "ΑΦΜ", "ΔΟΥ", "Πάροχος", "Πλάνο", "Ενημερώθηκε"];
    const rows = filtered.map((c) => {
      const s = subByUser.get(c.user_id);
      return [c.full_name, c.email, c.phone, c.address_line1, c.address_line2, c.city, c.postal_code, c.country, c.wants_invoice ? "ΝΑΙ" : "ΟΧΙ", c.company_name, c.vat_number, c.tax_office, s?.provider ?? "", s?.plan_id ?? "", c.updated_at];
    });
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `aura-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-8">
      <div id="viva" className="flex scroll-mt-28 flex-wrap items-end justify-between gap-4">
        <div>
          <span className="pu-kicker">Payments</span>
          <h2 className="pu-title mt-3 text-2xl font-bold tracking-tight sm:text-4xl">Viva & στοιχεία πελατών</h2>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="pu-btn">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Ανανέωση
        </button>
      </div>

      {loadError && (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {loadError} — έχεις τρέξει το SQL της Viva (viva_complete.sql);
        </p>
      )}

      {/* ---- provider + health ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="pu-panel space-y-4 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Πάροχος πληρωμών συνδρομών</h3>
          <div className="flex flex-wrap gap-2">
            {(["viva", "stripe"] as const).map((p) => (
              <button key={p} type="button" disabled={savingProvider || provider === null} onClick={() => void chooseProvider(p)} className={`pu-chip ${provider === p ? "pu-chip-on" : ""}`}>
                {p === "viva" ? "Viva.com" : "Stripe"}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-white/50">
            Αφορά ΜΟΝΟ τις νέες συνδρομές. Τα μέλη που ήδη πληρώνουν συνεχίζουν με τον πάροχό τους. Σεμινάρια και βιβλίο πληρώνονται πάντα με Viva.
          </p>
          <p className="text-xs text-white/60">
            Ενεργές συνδρομές: <strong className="text-white">{counts.viva}</strong> Viva · <strong className="text-white">{counts.stripe}</strong> Stripe
          </p>
          {providerMsg && <p role="status" className="text-xs text-emerald-300">{providerMsg}</p>}
        </div>

        <div className="pu-panel space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Σύνδεση με Viva</h3>
            <button type="button" onClick={() => void runHealth()} disabled={healthBusy} className="pu-btn">
              {healthBusy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Έλεγχος
            </button>
          </div>
          {healthError && <p role="alert" className="text-xs text-red-300">{healthError}</p>}
          {!health && !healthError && <p className="text-xs text-white/50">Πάτα «Έλεγχος» για να δεις αν η Viva είναι σωστά συνδεδεμένη.</p>}
          {health && (
            <div className="space-y-3 text-xs">
              <p className="text-white/70">
                Περιβάλλον: <strong className="text-white">{health.environment === "production" ? "ΠΑΡΑΓΩΓΗ (πραγματικές πληρωμές)" : health.environment === "sandbox" ? "SANDBOX (δοκιμαστικό)" : "—"}</strong>
              </p>
              <p className={health.oauth.ok ? "text-emerald-300" : "text-red-300"}>
                {health.oauth.ok ? "✓ Η Viva δέχεται τα διαπιστευτήρια" : `✗ ${health.oauth.error ?? "Η Viva δεν δέχεται τα διαπιστευτήρια"}`}
              </p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {Object.entries(health.secrets).map(([k, ok]) => (
                  <li key={k} className={ok ? "text-emerald-300/90" : "text-red-300"}>
                    {ok ? "✓" : "✗"} {SECRET_LABEL[k] ?? k}
                  </li>
                ))}
              </ul>
              <p className="text-white/60">
                Τελευταίο webhook: <strong className="text-white">{health.lastWebhookAt ? fmtDate(health.lastWebhookAt) : "κανένα ακόμη"}</strong>
                {!health.lastWebhookAt && " — έχεις καταχωρήσει το webhook στη Viva;"}
              </p>
              <p className="text-white/60">
                24 ώρες: {health.webhook24h["processed"] ?? 0} επιτυχή · {health.webhook24h["ignored"] ?? 0} αγνοήθηκαν · {health.webhook24h["failed"] ?? 0} απέτυχαν · {health.pendingOrders24h} εκκρεμείς παραγγελίες
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---- Viva activity ---- */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Τελευταίες πληρωμές Viva</h3>
        <div className="pu-panel overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
              <tr>
                {["Ημερομηνία", "Τύπος", "Κατάσταση", "Ποσό", "Αντικείμενο", "Πελάτης", "Order code", "Σημείωση"].map((h) => (
                  <th key={h} className="p-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(activity ?? []).map((r, i) => {
                const st = STATUS[r.status] ?? { label: r.status, cls: "border-white/15 bg-white/[0.04] text-white/60" };
                return (
                  <tr key={`${r.order_code ?? "x"}-${i}`} className="align-top hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap p-3 text-white/70">{fmtDate(r.created_at)}</td>
                    <td className="p-3 text-white/85">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="p-3"><Pill cls={st.cls}>{st.label}</Pill></td>
                    <td className="whitespace-nowrap p-3 font-semibold text-white">{formatEuro(r.amount_cents)}</td>
                    <td className="p-3 text-white/70">{r.label ?? "—"}</td>
                    <td className="p-3 text-white/70">{r.who || "—"}{r.email ? <span className="block font-mono text-[11px] text-white/45">{r.email}</span> : null}</td>
                    <td className="p-3 font-mono text-[11px] text-white/45">{r.order_code ?? "—"}{r.environment ? <span className="block">{r.environment}</span> : null}</td>
                    <td className="p-3 text-[11px] text-red-300/80">{r.failure_reason ?? ""}</td>
                  </tr>
                );
              })}
              {activity && activity.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-white/40">Δεν υπάρχουν πληρωμές Viva ακόμη.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- customer details ---- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Στοιχεία πελατών ({filtered.length})</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input className="pu-input w-64" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Αναζήτηση: όνομα, email, τηλέφωνο, ΑΦΜ…" aria-label="Αναζήτηση πελατών" />
            <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="pu-btn">
              <Download className="size-4" /> CSV
            </button>
          </div>
        </div>
        <div className="pu-panel overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
              <tr>
                {["Πελάτης", "Επικοινωνία", "Διεύθυνση", "Τιμολόγιο", "Συνδρομή", "Ενημερώθηκε"].map((h) => (
                  <th key={h} className="p-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((c) => {
                const s = subByUser.get(c.user_id);
                return (
                  <tr key={c.user_id} className="align-top hover:bg-white/[0.02]">
                    <td className="p-3 font-medium text-white/90">{c.full_name}</td>
                    <td className="p-3 text-white/70">
                      <a href={`tel:${c.phone}`} className="hover:text-white">{c.phone}</a>
                      <span className="block font-mono text-[11px] text-white/45">{c.email ?? ""}</span>
                    </td>
                    <td className="p-3 text-white/70">
                      {c.address_line1}{c.address_line2 ? `, ${c.address_line2}` : ""}
                      <span className="block text-[11px] text-white/45">{c.postal_code} {c.city}, {c.country}</span>
                    </td>
                    <td className="p-3 text-white/70">
                      {c.wants_invoice ? (
                        <>
                          {c.company_name}
                          <span className="block font-mono text-[11px] text-white/45">ΑΦΜ {c.vat_number} · ΔΟΥ {c.tax_office}</span>
                        </>
                      ) : <span className="text-white/35">Απόδειξη</span>}
                    </td>
                    <td className="p-3 text-white/70">
                      {s ? (<><span className="uppercase">{s.plan_id}</span><span className="block text-[11px] text-white/45">{s.provider === "viva" ? "Viva" : "Stripe"}</span></>) : <span className="text-white/35">—</span>}
                    </td>
                    <td className="whitespace-nowrap p-3 text-[11px] text-white/45">{fmtDate(c.updated_at)}</td>
                  </tr>
                );
              })}
              {customers && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-white/40">{query ? "Κανένα αποτέλεσμα." : "Κανένας πελάτης δεν έχει συμπληρώσει στοιχεία ακόμη."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
