// src/components/aura/jobs/FindJob.tsx
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  Briefcase,
  Clock,
  Gem,
  Globe,
  Instagram,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Send,
  Store,
  X,
} from "lucide-react";
import {
  LEVELS,
  applyMailto,
  errText,
  instagramUrl,
  isNew,
  logoUrl,
  mapsLink,
  safeUrl,
  sb,
  telHref,
  type JobListing,
} from "@/lib/jobs";
import { jobsCss } from "./jobsTheme";

const DESCRIPTION = "Σε συνεργασία με διάφορα barbershops βοηθάμε τους μαθητές μας να βρουν εύκολα δουλειά.";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Logo({ job, size }: { job: JobListing; size: number }) {
  const [broken, setBroken] = useState(false);
  const url = useMemo(() => logoUrl(job.logo_path), [job.logo_path]);
  return (
    <span className="fj-logo" style={{ width: size, height: size }}>
      <span className="fj-logo-in">
        {url && !broken ? (
          <img src={url} alt={`${job.shop_name} logo`} loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <span className="fj-chrome" style={{ fontSize: size * 0.42 }}>
            {job.shop_name.trim().slice(0, 1).toUpperCase() || <Store className="size-5" />}
          </span>
        )}
      </span>
    </span>
  );
}

const JobCard = memo(function JobCard({
  job,
  index,
  onOpen,
}: {
  job: JobListing;
  index: number;
  onOpen: (job: JobListing) => void;
}) {
  return (
    <div
      className="fj-card"
      role="button"
      tabIndex={0}
      style={{ "--i": Math.min(index, 12) } as CSSProperties}
      onClick={() => onOpen(job)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(job);
        }
      }}
      aria-label={`${job.shop_name} – ${job.title}. View details`}
    >
      {isNew(job.created_at) && <span className="fj-new">NEW</span>}

      <div className="fj-card-top">
        <Logo job={job} size={64} />
        <div className="min-w-0">
          <h3 className="fj-shop">{job.shop_name}</h3>
          <p className="fj-role">{job.title}</p>
        </div>
      </div>

      <div className="fj-meta">
        <span>
          <MapPin className="size-4" aria-hidden />
          {job.city}
        </span>
        {job.employment_type && (
          <span>
            <Clock className="size-4" aria-hidden />
            {job.employment_type}
          </span>
        )}
      </div>

      {(job.level || job.experience) && (
        <div className="fj-tags">
          {job.level && (
            <span className="fj-chip">
              <Gem className="size-3" aria-hidden />
              {job.level}
            </span>
          )}
          {job.experience && (
            <span className="fj-chip">
              <Briefcase className="size-3" aria-hidden />
              {job.experience}
            </span>
          )}
        </div>
      )}

      <div className="fj-card-foot">
        <span className="fj-salary fj-chrome">
          <Banknote className="size-5" style={{ color: "#cfd4dc" }} aria-hidden />
          {job.salary}
        </span>
        <span className="fj-more">
          Details <ArrowUpRight className="size-4" aria-hidden />
        </span>
      </div>
    </div>
  );
});

function Fact({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      {icon}
      <div className="min-w-0">
        <small>{label}</small>
        <span>{value}</span>
      </div>
    </>
  );
  return href ? (
    <a className="fj-fact" href={href} {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
      {inner}
    </a>
  ) : (
    <div className="fj-fact">{inner}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Details modal                                                       */
/* ------------------------------------------------------------------ */

function JobModal({
  job,
  applicant,
  onClose,
}: {
  job: JobListing;
  applicant: { name: string; email: string };
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const website = safeUrl(job.website);
  const insta = instagramUrl(job.instagram);

  return (
    <div className="fj-layer" onPointerDown={onClose}>
      <div
        className="fj-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${job.shop_name} – ${job.title}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="fj-modal-head">
          <Logo job={job} size={72} />
          <div className="min-w-0 pr-10">
            <h2 className="fj-shop fj-chrome" style={{ fontSize: "1.7rem" }}>
              {job.shop_name}
            </h2>
            <p className="fj-role">{job.title}</p>
          </div>
          <button ref={closeRef} type="button" className="fj-iconbtn" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="fj-modal-body">
          <div className="fj-tags" style={{ marginBottom: 20 }}>
            <span className="fj-chip">
              <Banknote className="size-3" aria-hidden />
              {job.salary}
            </span>
            {job.employment_type && <span className="fj-chip">{job.employment_type}</span>}
            {job.level && (
              <span className="fj-chip">
                <Gem className="size-3" aria-hidden />
                {job.level}
              </span>
            )}
            {job.experience && (
              <span className="fj-chip">
                <Briefcase className="size-3" aria-hidden />
                {job.experience}
              </span>
            )}
          </div>

          <h3 className="fj-h">About the barbershop</h3>
          <p className="fj-desc">{job.description}</p>

          <div className="fj-facts">
            <Fact
              icon={<MapPin className="size-4" />}
              label="Location"
              value={`${job.address}, ${job.city}`}
              href={mapsLink(job)}
              external
            />
            {job.phone && <Fact icon={<Phone className="size-4" />} label="Phone" value={job.phone} href={telHref(job.phone)} />}
            <Fact icon={<Mail className="size-4" />} label="Email" value={job.email} href={`mailto:${job.email}`} />
            {website && (
              <Fact
                icon={<Globe className="size-4" />}
                label="Website"
                value={website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                href={website}
                external
              />
            )}
            {insta && (
              <Fact
                icon={<Instagram className="size-4" />}
                label="Instagram"
                value={job.instagram?.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, "") ?? ""}
                href={insta}
                external
              />
            )}
          </div>
        </div>

        <div className="fj-modal-foot">
          <a className="fj-btn fj-btn-chrome fj-apply" href={applyMailto(job, applicant)}>
            <Send className="size-4" aria-hidden />
            Apply for this job
          </a>
          <p className="fj-foot-note">Opens your email app with a ready message to {job.shop_name}.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function FindJob({ applicant }: { applicant: { name: string; email: string } }) {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const [level, setLevel] = useState<string>("all");
  const [open, setOpen] = useState<JobListing | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await sb
      .from("job_listings")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (e) {
      setError(errText(e, "Could not load the job listings."));
      setLoading(false);
      return;
    }
    setJobs((data ?? []) as JobListing[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cities = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.city.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [jobs],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (city !== "all" && j.city.trim() !== city) return false;
      if (level !== "all" && j.level !== level) return false;
      if (!needle) return true;
      return [j.shop_name, j.title, j.city, j.address, j.description].some((s) => s.toLowerCase().includes(needle));
    });
  }, [jobs, q, city, level]);

  const closeModal = useCallback(() => setOpen(null), []);

  return (
    <div className="fj-root">
      <style>{jobsCss}</style>

      <div className="fj-wrap">
        <header className="fj-head">
          <h1 className="fj-title fj-chrome">Find Job with ΛURΛ</h1>
          <span className="fj-rule" aria-hidden />
          <p className="fj-sub">{DESCRIPTION}</p>
          {!loading && !error && (
            <span className="fj-count">
              <i aria-hidden />
              {jobs.length} open {jobs.length === 1 ? "position" : "positions"}
            </span>
          )}
        </header>

        {!loading && !error && jobs.length > 0 && (
          <div className="fj-toolbar">
            <label className="fj-search">
              <Search className="size-4 shrink-0" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search barbershop, city or role…"
                aria-label="Search job listings"
              />
            </label>

            {cities.length > 1 && (
              <select className="fj-select" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
                <option value="all">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <div className="fj-pills" role="group" aria-label="Filter by level">
              {["all", ...LEVELS].map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`fj-pill ${level === l ? "fj-pill-on" : ""}`}
                  aria-pressed={level === l}
                  onClick={() => setLevel(l)}
                >
                  {l === "all" ? "All levels" : l}
                </button>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <div className="fj-state">
            <AlertCircle className="size-9 opacity-70" />
            <h3>We couldn’t load the listings</h3>
            <p style={{ fontSize: 13 }}>{error}</p>
            <button type="button" className="fj-btn" onClick={() => void load()}>
              <RefreshCw className="size-4" /> Try again
            </button>
          </div>
        ) : loading ? (
          <div className="fj-grid" style={{ marginTop: 34 }} aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="fj-skel" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="fj-state">
            <Store className="size-10 opacity-60" />
            <h3>New opportunities are coming</h3>
            <p style={{ maxWidth: 420 }}>No positions are open right now. Check back soon, new barbershops join ΛURΛ regularly.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="fj-state">
            <Search className="size-9 opacity-60" />
            <h3>No matches</h3>
            <p>Try a different search or clear the filters.</p>
            <button
              type="button"
              className="fj-btn"
              onClick={() => {
                setQ("");
                setCity("all");
                setLevel("all");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="fj-grid">
            {filtered.map((job, i) => (
              <JobCard key={job.id} job={job} index={i} onOpen={setOpen} />
            ))}
          </div>
        )}
      </div>

      {open && <JobModal job={open} applicant={applicant} onClose={closeModal} />}
    </div>
  );
}