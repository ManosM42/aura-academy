import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  getMyProfile,
  getHaircutReviewForGrading,
  gradeHaircutReview,
  signedHaircutMediaUrl,
} from "@/lib/queries";
import { isAdminRole } from "@/lib/roles";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton, LockedState } from "@/components/aura/States";
import { Scissors, ArrowLeft, CheckCircle2, AlertCircle, Award, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/review/haircuts/$haircutId")({
  component: HaircutReviewDetailPage,
});

function HaircutReviewDetailPage() {
  const { haircutId } = Route.useParams();
  const navigate = useNavigate();

  const profile = useAsync(getMyProfile, []);
  const admin = profile.data ? isAdminRole(profile.data.role) : false;

  const { data, error, loading } = useAsync(
    async () => (admin ? getHaircutReviewForGrading(haircutId) : null),
    [haircutId, admin],
  );

  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const field =
    "w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-white/90 outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 placeholder:text-zinc-600";

  async function handleSubmit() {
    setErr(null);
    if (!feedback.trim()) {
      setErr("Γράψε feedback για τον μαθητή.");
      return;
    }
    if (!Number.isFinite(score) || score < 0) {
      setErr("Το score δεν μπορεί να είναι αρνητικό.");
      return;
    }
    setBusy(true);
    try {
      await gradeHaircutReview({ haircutReviewId: haircutId, score, feedback });
      navigate({ to: "/review/haircuts" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 sm:px-6 py-16 text-white relative">
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-600/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="mb-8 relative z-10">
        <Link
          to="/review/haircuts"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900/80 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:border-orange-500/40 transition-all backdrop-blur-md shadow-inner group"
        >
          <ArrowLeft className="w-4 h-4 text-orange-400 group-hover:-translate-x-1 transition-transform" />
          Επιστροφή στην Ουρά
        </Link>
      </div>

      {profile.loading && <LoadingSkeleton rows={4} />}
      {profile.error && <ErrorState message={profile.error} />}

      {profile.data && !admin && (
        <div className="relative z-10 p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_30px_-5px_rgba(0,0,0,0.8)] backdrop-blur-xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <LockedState reason="Μόνο admins έχουν πρόσβαση στην αξιολόγηση κουρεμάτων." />
        </div>
      )}

      {admin && loading && <LoadingSkeleton rows={4} />}
      {admin && error && <ErrorState message={error} />}

      {admin && data && (
        <div className="relative z-10 space-y-8">
          <header className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-orange-400 text-xs font-semibold tracking-widest uppercase mb-3 shadow-inner">
              <Scissors className="w-3.5 h-3.5" />
              Haircut Review
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {data.student?.full_name ?? "Μαθητής"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Υποβλήθηκε {new Date(data.created_at).toLocaleString("el-GR")}
            </p>
          </header>

          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70 mb-6">Φωτογραφίες</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <MediaColumn title="Before" paths={data.before_media ?? []} />
              <MediaColumn title="Process" paths={data.process_media ?? []} />
              <MediaColumn title="After" paths={data.after_media ?? []} />
            </div>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70 flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-400" />
              Αναφορά Μαθητή
            </h2>
            <Reasoning label="Μέθοδος" value={data.method_description} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Reasoning label="Τεχνική" value={data.technique} />
              <Reasoning label="Εργαλεία" value={data.tools} />
            </div>
            <Reasoning label="Σημειώσεις" value={data.notes} />
          </div>

          <section className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Βαθμολόγηση</h2>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Score</span>
              <input
                type="number"
                min={0}
                step="any"
                className="w-40 rounded-xl border border-white/10 bg-black/80 p-2.5 text-center text-sm font-bold text-orange-400 outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Feedback</span>
              <textarea
                rows={4}
                className={field}
                placeholder="Σχόλια για τη μέθοδο, την τεχνική, τι πήγε καλά και τι να προσέξει..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </label>
          </section>

          {err && (
            <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span role="alert">{err}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={busy}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-sm font-bold text-white shadow-[0_0_25px_-5px_rgba(255,90,20,0.5)] hover:shadow-[0_0_35px_-2px_rgba(255,90,20,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            {busy ? "Καταχώρηση..." : "Καταχώρηση Score"}
          </button>
        </div>
      )}
    </main>
  );
}

function MediaColumn({ title, paths }: { title: string; paths: string[] }) {
  return (
    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
      <h3 className="mb-3 text-xs uppercase tracking-widest text-orange-400 font-bold">{title}</h3>
      {paths.length === 0 ? (
        <p className="text-xs text-zinc-600">—</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {paths.map((p) => (
            <HaircutMediaThumb key={p} path={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function HaircutMediaThumb({ path }: { path: string }) {
  const { data: url, loading } = useAsync(() => signedHaircutMediaUrl(path), [path]);
  if (loading) return <div className="aspect-square rounded-lg bg-white/5 animate-pulse" />;
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" className="block">
      <img src={url ?? undefined} alt="" className="aspect-square w-full rounded-lg object-cover border border-white/10" />
    </a>
  );
}

function Reasoning({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
      <p className="text-xs uppercase tracking-widest text-orange-400 font-bold">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed">{value}</p>
    </div>
  );
}