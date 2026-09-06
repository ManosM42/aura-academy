import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { getSubmissionForReview, submitReview } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import { MediaThumb } from "@/components/aura/MediaThumb";
import type { ReviewDecision } from "@/lib/database.types";
import { Sparkles, ArrowLeft, CheckCircle2, AlertCircle, Award, FileText } from "lucide-react";

export const Route = createFileRoute("/review/$submissionId")({
  component: ReviewDetailPage,
});

function ReviewDetailPage() {
  const { submissionId } = Route.useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useAsync(
    () => getSubmissionForReview(submissionId),
    [submissionId],
  );

  const rubric = data?.submission.assignment?.rubric ?? [];

  const [scores, setScores] = useState<Record<string, number>>({});
  const [text, setText] = useState({
    strengths: "",
    technical_gaps: "",
    method_gaps: "",
    next_actions: "",
  });
  const [decision, setDecision] = useState<ReviewDecision>("passed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalScore = useMemo(() => {
    if (rubric.length === 0) return 0;
    const totalWeight = rubric.reduce((s, r) => s + r.weight, 0) || 1;
    const weighted = rubric.reduce((s, r) => {
      const val = scores[r.criterion] ?? 0;
      const pct = r.max ? val / r.max : 0;
      return s + pct * r.weight;
    }, 0);
    return Math.round((weighted / totalWeight) * 100);
  }, [rubric, scores]);

  async function handleSubmit() {
    setBusy(true);
    setErr(null);
    try {
      await submitReview({
        submissionId,
        score: totalScore,
        rubricScores: rubric.map((r) => ({
          criterion: r.criterion,
          score: scores[r.criterion] ?? 0,
        })),
        strengths: text.strengths,
        technicalGaps: text.technical_gaps,
        methodGaps: text.method_gaps,
        nextActions: text.next_actions,
        decision,
      });
      navigate({ to: "/review" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-white/90 outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 placeholder:text-zinc-600";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 sm:px-6 py-16 text-white relative">
      {/* Ambient glow backdrop */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-600/10 blur-[140px] pointer-events-none rounded-full" />

      {/* Top bar back button */}
      <div className="mb-8 relative z-10">
        <Link
          to="/review"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900/80 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:border-orange-500/40 transition-all backdrop-blur-md shadow-inner group"
        >
          <ArrowLeft className="w-4 h-4 text-orange-400 group-hover:-translate-x-1 transition-transform" />
          Επιστροφή στην Ουρά
        </Link>
      </div>

      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} />}

      {data && (
        <div className="relative z-10 space-y-8">
          
          {/* Header Card */}
          <header className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-orange-400 text-xs font-semibold tracking-widest uppercase mb-3 shadow-inner">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                Submission Evaluation
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {data.submission.assignment?.title ?? "Υποβολή"}
              </h1>
              {(data.submission.assignment as any)?.skill?.name && (
                <p className="mt-1 text-xs uppercase tracking-wider text-orange-400 font-semibold">
                  Skill: {(data.submission.assignment as any).skill.name}
                </p>
              )}
              <p className="mt-2 text-sm text-zinc-400 flex items-center gap-2">
                <span className="text-white font-medium">{data.submission.student?.full_name ?? "Μαθητής"}</span>
                <span>·</span>
                <span className="text-orange-400 font-semibold">Attempt {data.submission.attempt}</span>
              </p>
            </div>

            {rubric.length > 0 && (
              <div className="p-5 rounded-2xl bg-black/60 border border-white/10 text-center min-w-[160px] shadow-inner">
                <span className="text-xs uppercase tracking-widest text-zinc-400 block mb-1">Συνολικό Score</span>
                <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
                  {totalScore}<span className="text-sm font-normal text-zinc-500">/100</span>
                </div>
              </div>
            )}
          </header>

          {/* Media Grid Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70 mb-6 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-400" />
              Υλικό Υποβολής (Media Files)
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              <MediaColumn title="Before" paths={data.submission.before_media} />
              <MediaColumn title="Process" paths={data.submission.process_media} />
              <MediaColumn title="After" paths={data.submission.after_media} />
            </div>
          </div>

          {/* Context & Reasoning Details Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70 flex items-center gap-2">
              <Award className="w-4 h-4 text-orange-400" />
              Αναφορά Μαθητή & Πλαισίου
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Reasoning label="Client context" value={data.submission.client_context} />
              <Reasoning label="Παρατηρήσεις" value={data.submission.observations} />
              <Reasoning label="Τεχνική" value={data.submission.technique} />
              <Reasoning label="Αυτο-αξιολόγηση" value={data.submission.self_evaluation} />
            </div>
          </div>

          {/* Rubric Section */}
          {rubric.length > 0 && (
            <section className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <h2 className="mb-6 text-sm font-bold uppercase tracking-wider text-white/70">Rubric Κριτήρια Αξιολόγησης</h2>
              <div className="space-y-4">
                {rubric.map((r) => (
                  <div
                    key={r.criterion}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/50 p-4 shadow-inner"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-white">{r.criterion}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Βάρος {r.weight} · max {r.max} πόντοι
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400">Βαθμολογία:</span>
                      <input
                        type="number"
                        min={0}
                        max={r.max}
                        value={scores[r.criterion] ?? ""}
                        onChange={(e) =>
                          setScores({
                            ...scores,
                            [r.criterion]: Number(e.target.value),
                          })
                        }
                        className="w-24 rounded-xl border border-white/10 bg-black/80 p-2.5 text-center text-sm font-bold text-orange-400 outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Review Text Form Section */}
          <section className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Φόρμα Ανατροφοδότησης & Απόφασης</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Labeled label="Δυνατά σημεία">
                <textarea
                  rows={3}
                  className={field}
                  placeholder="Γράψτε τα θετικά στοιχεία της εργασίας..."
                  value={text.strengths}
                  onChange={(e) =>
                    setText({ ...text, strengths: e.target.value })
                  }
                />
              </Labeled>

              <Labeled label="Τεχνικά κενά">
                <textarea
                  rows={3}
                  className={field}
                  placeholder="Επισημάνετε τεχνικές αδυναμίες..."
                  value={text.technical_gaps}
                  onChange={(e) =>
                    setText({ ...text, technical_gaps: e.target.value })
                  }
                />
              </Labeled>

              <Labeled label="Κενά μεθόδου">
                <textarea
                  rows={3}
                  className={field}
                  placeholder="Σημεία βελτίωσης στη μεθοδολογία..."
                  value={text.method_gaps}
                  onChange={(e) =>
                    setText({ ...text, method_gaps: e.target.value })
                  }
                />
              </Labeled>

              <Labeled label="Επόμενες ενέργειες">
                <textarea
                  rows={3}
                  className={field}
                  placeholder="Τι πρέπει να προσέξει στην επόμενη προσπάθεια..."
                  value={text.next_actions}
                  onChange={(e) =>
                    setText({ ...text, next_actions: e.target.value })
                  }
                />
              </Labeled>
            </div>

            <div className="pt-2">
              <Labeled label="Τελική Απόφαση">
                <select
                  value={decision}
                  onChange={(e) =>
                    setDecision(e.target.value as ReviewDecision)
                  }
                  className={field}
                >
                  <option value="passed" className="bg-zinc-900 text-white">Passed (verify skill)</option>
                  <option value="needs_revision" className="bg-zinc-900 text-white">Needs revision</option>
                  <option value="failed" className="bg-zinc-900 text-white">Failed</option>
                </select>
              </Labeled>
            </div>
          </section>

          {err && (
            <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span role="alert">{err}</span>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="pt-4">
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-sm font-bold text-white shadow-[0_0_25px_-5px_rgba(255,90,20,0.5)] hover:shadow-[0_0_35px_-2px_rgba(255,90,20,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              {busy ? "Καταχώρηση..." : "Καταχώρηση Αξιολόγησης"}
            </button>
          </div>

        </div>
      )}
    </main>
  );
}

function MediaColumn({ title, paths }: { title: string; paths: string[] }) {
  return (
    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
      <h3 className="mb-3 text-xs uppercase tracking-widest text-orange-400 font-bold">
        {title}
      </h3>
      {paths.length === 0 ? (
        <p className="text-xs text-zinc-600">—</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {paths.map((p) => (
            <MediaThumb key={p} path={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Reasoning({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
      <p className="text-xs uppercase tracking-widest text-orange-400 font-bold">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed">{value}</p>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
    </label>
  );
}