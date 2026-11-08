// src/routes/admin.jobs.tsx
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  EMPLOYMENT_TYPES,
  LEVELS,
  LOGO_BUCKET,
  LOGO_TYPES,
  MAX_LOGO_BYTES,
  errText,
  logoUrl,
  sb,
  uid,
  type JobListing,
} from "@/lib/jobs";
import { jobsCss } from "@/components/aura/jobs/jobsTheme";

export const Route = createFileRoute("/admin/jobs")({
  head: () => ({ meta: [{ title: "Admin · Job listings" }] }),
  component: AdminJobsPage,
});

/* ------------------------------------------------------------------ */
/* Form model                                                          */
/* ------------------------------------------------------------------ */

interface Draft {
  shop_name: string;
  title: string;
  address: string;
  city: string;
  salary: string;
  experience: string;
  level: string;
  employment_type: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  maps_url: string;
  description: string;
  is_active: boolean;
}

const EMPTY: Draft = {
  shop_name: "",
  title: "Barber",
  address: "",
  city: "",
  salary: "",
  experience: "",
  level: "",
  employment_type: "",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  maps_url: "",
  description: "",
  is_active: true,
};

function toDraft(j: JobListing): Draft {
  return {
    shop_name: j.shop_name,
    title: j.title,
    address: j.address,
    city: j.city,
    salary: j.salary,
    experience: j.experience ?? "",
    level: j.level ?? "",
    employment_type: j.employment_type ?? "",
    phone: j.phone ?? "",
    email: j.email,
    website: j.website ?? "",
    instagram: j.instagram ?? "",
    maps_url: j.maps_url ?? "",
    description: j.description,
    is_active: j.is_active,
  };
}

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  const need = (k: keyof Draft, label: string) => {
    if (!String(d[k]).trim()) e[k] = `${label} is required`;
  };
  need("shop_name", "Barbershop name");
  need("title", "Job title");
  need("address", "Address");
  need("city", "City");
  need("salary", "Salary");
  need("description", "Description");
  if (!d.email.trim()) e.email = "Email is required";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) e.email = "Enter a valid email";
  if (d.description.length > 6000) e.description = "Maximum 6000 characters";
  return e;
}

const orNull = (v: string): string | null => (v.trim() ? v.trim() : null);

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function Logo({ path, name, size, preview }: { path: string | null; name: string; size: number; preview?: string | null }) {
  const [broken, setBroken] = useState(false);
  const url = preview ?? logoUrl(path);
  return (
    <span className="fj-logo" style={{ width: size, height: size }}>
      <span className="fj-logo-in">
        {url && !broken ? (
          <img src={url} alt="" onError={() => setBroken(true)} />
        ) : (
          <span className="fj-chrome" style={{ fontSize: size * 0.42 }}>
            {name.trim().slice(0, 1).toUpperCase() || <Store className="size-5" />}
          </span>
        )}
      </span>
    </span>
  );
}

function Field({
  label,
  required,
  optional,
  error,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`fa-field ${wide ? "fa-wide" : ""}`}>
      <label>
        {label} {required && <b>*</b>} {optional && <em>(optional)</em>}
      </label>
      {children}
      {error && <span className="fa-err">{error}</span>}
    </div>
  );
}

function Dialog({
  title,
  busy,
  onClose,
  children,
  footer,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [busy, onClose]);

  return (
    <div className="fj-layer" onPointerDown={() => !busy && onClose()}>
      <div className="fj-modal" role="dialog" aria-modal="true" aria-label={title} onPointerDown={(e) => e.stopPropagation()}>
        <div className="fj-modal-head">
          <h2 className="fj-shop fj-chrome" style={{ fontSize: "1.6rem" }}>
            {title}
          </h2>
          <button type="button" className="fj-iconbtn" onClick={onClose} disabled={busy} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="fj-modal-body" style={{ padding: 0 }}>
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit form                                                  */
/* ------------------------------------------------------------------ */

function JobForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: JobListing | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(editing ? toDraft(editing) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pickLogo = (f: File | undefined) => {
    setFormError(null);
    if (!f) return;
    if (!LOGO_TYPES.includes(f.type)) {
      setFormError("The logo must be a JPG, PNG or WebP image.");
      return;
    }
    if (f.size > MAX_LOGO_BYTES) {
      setFormError("The logo must be 2 MB or smaller.");
      return;
    }
    setRemoveLogo(false);
    setFile(f);
  };

  const save = async () => {
    const errs = validate(d);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setFormError(null);
    let newPath: string | null = null;

    try {
      if (file) {
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        newPath = `logos/${uid()}.${ext}`;
        const up = await sb.storage.from(LOGO_BUCKET).upload(newPath, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
      }

      const keepPath = removeLogo ? null : editing?.logo_path ?? null;
      const payload = {
        shop_name: d.shop_name.trim(),
        title: d.title.trim(),
        address: d.address.trim(),
        city: d.city.trim(),
        salary: d.salary.trim(),
        experience: orNull(d.experience),
        level: orNull(d.level),
        employment_type: orNull(d.employment_type),
        phone: orNull(d.phone),
        email: d.email.trim(),
        website: orNull(d.website),
        instagram: orNull(d.instagram),
        maps_url: orNull(d.maps_url),
        description: d.description.trim(),
        is_active: d.is_active,
        logo_path: newPath ?? keepPath,
      };

      const res = editing
        ? await sb.from("job_listings").update(payload).eq("id", editing.id)
        : await sb.from("job_listings").insert(payload);
      if (res.error) throw res.error;

      // the old logo is no longer used
      if (editing?.logo_path && (newPath || removeLogo)) {
        void sb.storage.from(LOGO_BUCKET).remove([editing.logo_path]);
      }
      onSaved();
    } catch (e) {
      if (newPath) void sb.storage.from(LOGO_BUCKET).remove([newPath]);
      setFormError(errText(e, "Could not save the listing."));
      setSaving(false);
    }
  };

  const showExisting = !file && !removeLogo && Boolean(editing?.logo_path);

  return (
    <Dialog
      title={editing ? "Edit listing" : "New listing"}
      busy={saving}
      onClose={onClose}
      footer={
        <div className="fa-modal-foot">
          <button type="button" className="fj-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="fj-btn fj-btn-chrome" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {editing ? "Save changes" : "Publish listing"}
          </button>
        </div>
      }
    >
      {formError && (
        <p className="fa-note" role="alert" style={{ marginTop: 18 }}>
          {formError}
        </p>
      )}

      <div className="fa-form">
        {/* logo */}
        <div className="fa-field fa-wide">
          <label>
            Barbershop logo <em>(optional, JPG / PNG / WebP, max 2 MB)</em>
          </label>
          <div className="fa-logo-row">
            <Logo path={showExisting ? editing?.logo_path ?? null : null} name={d.shop_name} size={76} preview={preview} />
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={LOGO_TYPES.join(",")}
              onChange={(e) => {
                pickLogo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button type="button" className="fj-btn fj-btn-sm" onClick={() => fileRef.current?.click()} disabled={saving}>
              <Upload className="size-4" /> {file || showExisting ? "Replace" : "Upload logo"}
            </button>
            {(file || showExisting) && (
              <button
                type="button"
                className="fj-btn fj-btn-sm fj-btn-danger"
                onClick={() => {
                  setFile(null);
                  setRemoveLogo(true);
                }}
                disabled={saving}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <Field label="Barbershop name" required error={errors.shop_name}>
          <input className="fa-input" value={d.shop_name} maxLength={120} onChange={(e) => set("shop_name", e.target.value)} placeholder="e.g. Royal Cuts" />
        </Field>
        <Field label="Job title" required error={errors.title}>
          <input className="fa-input" value={d.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="Barber" />
        </Field>

        <Field label="Address" required error={errors.address}>
          <input className="fa-input" value={d.address} maxLength={240} onChange={(e) => set("address", e.target.value)} placeholder="Street and number" />
        </Field>
        <Field label="City / area" required error={errors.city}>
          <input className="fa-input" value={d.city} maxLength={80} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Heraklion" />
        </Field>

        <Field label="Salary" required error={errors.salary}>
          <input className="fa-input" value={d.salary} maxLength={120} onChange={(e) => set("salary", e.target.value)} placeholder="e.g. 900–1.200€ / month" />
        </Field>
        <Field label="Employment" optional>
          <select className="fa-input" value={d.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
            <option value="">Not specified</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Level" optional>
          <select className="fa-input" value={d.level} onChange={(e) => set("level", e.target.value)}>
            <option value="">Not specified</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Experience" optional>
          <input className="fa-input" value={d.experience} maxLength={80} onChange={(e) => set("experience", e.target.value)} placeholder="e.g. 2+ years" />
        </Field>

        <Field label="Email (applications go here)" required error={errors.email}>
          <input className="fa-input" type="email" inputMode="email" value={d.email} maxLength={200} onChange={(e) => set("email", e.target.value)} placeholder="shop@example.com" />
        </Field>
        <Field label="Phone" optional>
          <input className="fa-input" type="tel" inputMode="tel" value={d.phone} maxLength={40} onChange={(e) => set("phone", e.target.value)} placeholder="+30 28100 00000" />
        </Field>

        <Field label="Website" optional>
          <input className="fa-input" value={d.website} maxLength={200} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Instagram" optional>
          <input className="fa-input" value={d.instagram} maxLength={120} onChange={(e) => set("instagram", e.target.value)} placeholder="@barbershop" />
        </Field>

        <Field label="Google Maps link" optional wide>
          <input className="fa-input" value={d.maps_url} maxLength={400} onChange={(e) => set("maps_url", e.target.value)} placeholder="https://maps.google.com/…  (if empty, a map search from the address is used)" />
        </Field>

        <Field label="Barbershop description" required error={errors.description} wide>
          <textarea
            className="fa-input"
            value={d.description}
            maxLength={6000}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Tell students about the barbershop, the team, what you are looking for, working hours, benefits…"
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textAlign: "right" }}>{d.description.length} / 6000</span>
        </Field>

        <label className="fa-wide" style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14 }}>
          <input type="checkbox" checked={d.is_active} onChange={(e) => set("is_active", e.target.checked)} style={{ width: 18, height: 18, accentColor: "#e5e7eb" }} />
          Visible to students
        </label>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Gate = "loading" | "denied" | "ok";

function AdminJobsPage() {
  const [gate, setGate] = useState<Gate>("loading");
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ job: JobListing | null } | null>(null);
  const [confirmDel, setConfirmDel] = useState<JobListing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: session } = await sb.auth.getSession();
      if (!session.session) {
        if (!cancelled) setGate("denied");
        return;
      }
      const { data, error: e } = await sb.rpc("is_admin_user");
      if (!cancelled) setGate(!e && data === true ? "ok" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await sb.from("job_listings").select("*").order("created_at", { ascending: false });
    if (e) {
      setError(errText(e, "Could not load listings."));
      setLoading(false);
      return;
    }
    setJobs((data ?? []) as JobListing[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (gate === "ok") void load();
  }, [gate, load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const toggle = async (job: JobListing) => {
    const next = !job.is_active;
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, is_active: next } : j)));
    const { error: e } = await sb.from("job_listings").update({ is_active: next }).eq("id", job.id);
    if (e) {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
      setToast(errText(e, "Could not update the listing."));
    }
  };

  const remove = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    const { error: e } = await sb.from("job_listings").delete().eq("id", confirmDel.id);
    setDeleting(false);
    if (e) {
      setToast(errText(e, "Could not delete the listing."));
      return;
    }
    if (confirmDel.logo_path) void sb.storage.from(LOGO_BUCKET).remove([confirmDel.logo_path]);
    setJobs((prev) => prev.filter((j) => j.id !== confirmDel.id));
    setConfirmDel(null);
  };

  const activeCount = useMemo(() => jobs.filter((j) => j.is_active).length, [jobs]);

  // Sits inside your admin layout, so it does not add the big top padding the public pages use.
  const embedded = { "--fj-nav": "28px", minHeight: "auto" } as CSSProperties;

  if (gate === "loading") {
    return (
      <div className="grid min-h-[40vh] place-items-center text-white/60">
        <Loader2 className="size-6 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (gate === "denied") {
    return (
      <div className="fj-root" style={embedded}>
        <style>{jobsCss}</style>
        <div className="fj-wrap">
          <div className="fj-state">
            <ShieldAlert className="size-10 opacity-70" />
            <h3>Admins only</h3>
            <p>You need an admin or super admin account to manage job listings.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fj-root" style={embedded}>
      <style>{jobsCss}</style>

      <div className="fj-wrap" style={{ maxWidth: 980 }}>
        <div className="fa-top">
          <div>
            <h1 className="fa-title fj-chrome">Job listings</h1>
            <p style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,.5)" }}>
              {jobs.length} total · {activeCount} visible to students on Find Job
            </p>
          </div>
          <button type="button" className="fj-btn fj-btn-chrome" onClick={() => setForm({ job: null })}>
            <Plus className="size-4" /> New listing
          </button>
        </div>

        {toast && (
          <p className="fa-note" role="alert" style={{ margin: "0 0 16px" }}>
            {toast}
          </p>
        )}

        {error ? (
          <div className="fj-state">
            <AlertCircle className="size-9 opacity-70" />
            <h3>Could not load the listings</h3>
            <p style={{ fontSize: 13 }}>{error}</p>
            <button type="button" className="fj-btn" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="fa-list" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="fj-skel" style={{ height: 92 }} />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="fj-state">
            <Store className="size-10 opacity-60" />
            <h3>No listings yet</h3>
            <p>Create the first job listing and it will appear on the Find Job page.</p>
            <button type="button" className="fj-btn fj-btn-chrome" onClick={() => setForm({ job: null })}>
              <Plus className="size-4" /> New listing
            </button>
          </div>
        ) : (
          <div className="fa-list">
            {jobs.map((job) => (
              <div key={job.id} className="fa-row">
                <Logo path={job.logo_path} name={job.shop_name} size={56} />
                <div className="fa-info">
                  <b>{job.shop_name}</b>
                  <span>
                    {job.title} · {job.city} · {job.salary}
                  </span>
                </div>
                <span className={`fa-badge ${job.is_active ? "" : "fa-badge-off"}`}>{job.is_active ? "Visible" : "Hidden"}</span>
                <div className="fa-actions">
                  <button type="button" className="fj-btn fj-btn-sm" onClick={() => void toggle(job)}>
                    {job.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {job.is_active ? "Hide" : "Show"}
                  </button>
                  <button type="button" className="fj-btn fj-btn-sm" onClick={() => setForm({ job })}>
                    <Pencil className="size-4" /> Edit
                  </button>
                  <button type="button" className="fj-btn fj-btn-sm fj-btn-danger" onClick={() => setConfirmDel(job)}>
                    <Trash2 className="size-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && (
        <JobForm
          key={form.job?.id ?? "new"}
          editing={form.job}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void load();
          }}
        />
      )}

      {confirmDel && (
        <Dialog
          title="Delete listing?"
          busy={deleting}
          onClose={() => setConfirmDel(null)}
          footer={
            <div className="fa-modal-foot">
              <button type="button" className="fj-btn" onClick={() => setConfirmDel(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="fj-btn fj-btn-danger" onClick={() => void remove()} disabled={deleting}>
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </button>
            </div>
          }
        >
          <p style={{ padding: "22px 24px", fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,.75)" }}>
            “{confirmDel.shop_name} – {confirmDel.title}” will be removed for everyone. This cannot be undone. If you only want to hide it from
            students, use <b>Hide</b> instead.
          </p>
        </Dialog>
      )}
    </div>
  );
}