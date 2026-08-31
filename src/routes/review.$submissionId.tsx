import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getSubmissionForReview, submitReview } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import { MediaThumb } from "@/components/aura/MediaThumb";
import type { ReviewDecision } from "@/lib/database.types";

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
    "w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/90 outline-none focus:border-white/30";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-white">
      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} />}

      {data && (
        <>
          <header className="mb-6 border-b border-white/10 pb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              Review
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              {data.submission.assignment?.title ?? "Υποβολή"}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {data.submission.student?.full_name ?? "Μαθητής"} · attempt{" "}
              {data.submission.attempt}
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <MediaColumn title="Before" paths={data.submission.before_media} />
            <MediaColumn
              title="Process"
              paths={data.submission.process_media}
            />
            <MediaColumn title="After" paths={data.submission.after_media} />
          </div>

          <Reasoning
            label="Client context"
            value={data.submission.client_context}
          />
          <Reasoning
            label="Παρατηρήσεις"
            value={data.submission.observations}
          />
          <Reasoning label="Τεχνική" value={data.submission.technique} />
          <Reasoning
            label="Αυτο-αξιολόγηση"
            value={data.submission.self_evaluation}
          />

          {rubric.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-medium text-white/70">Rubric</h2>
              <div className="space-y-3">
                {rubric.map((r) => (
                  <div
                    key={r.criterion}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{r.criterion}</p>
                      <p className="text-xs text-white/40">
                        Βάρος {r.weight} · max {r.max}
                      </p>
                    </div>
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
                      className="w-20 rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-white/60">
                Συνολικό score:{" "}
                <span className="text-lg font-semibold text-white">
                  {totalScore}
                </span>
                /100
              </p>
            </section>
          )}

          <section className="mt-8 space-y-4">
            <Labeled label="Δυνατά σημεία">
              <textarea
                rows={2}
                className={field}
                value={text.strengths}
                onChange={(e) =>
                  setText({ ...text, strengths: e.target.value })
                }
              />
            </Labeled>
            <Labeled label="Τεχνικά κενά">
              <textarea
                rows={2}
                className={field}
                value={text.technical_gaps}
                onChange={(e) =>
                  setText({ ...text, technical_gaps: e.target.value })
                }
              />
            </Labeled>
            <Labeled label="Κενά μεθόδου">
              <textarea
                rows={2}
                className={field}
                value={text.method_gaps}
                onChange={(e) =>
                  setText({ ...text, method_gaps: e.target.value })
                }
              />
            </Labeled>
            <Labeled label="Επόμενες ενέργειες">
              <textarea
                rows={2}
                className={field}
                value={text.next_actions}
                onChange={(e) =>
                  setText({ ...text, next_actions: e.target.value })
                }
              />
            </Labeled>

            <Labeled label="Απόφαση">
              <select
                value={decision}
                onChange={(e) =>
                  setDecision(e.target.value as ReviewDecision)
                }
                className={field}
              >
                <option value="passed">Passed (verify skill)</option>
                <option value="needs_revision">Needs revision</option>
                <option value="failed">Failed</option>
              </select>
            </Labeled>
          </section>

          {err && (
            <p className="mt-4 text-sm text-red-300" role="alert">
              {err}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={busy}
            className="mt-6 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {busy ? "Υποβολή…" : "Καταχώρηση αξιολόγησης"}
          </button>
        </>
      )}
    </main>
  );
}

function MediaColumn({ title, paths }: { title: string; paths: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-wide text-white/40">
        {title}
      </h3>
      {paths.length === 0 ? (
        <p className="text-xs text-white/30">—</p>
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
    <div className="mt-4">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{value}</p>
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
      <span className="mb-1 block text-sm text-white/70">{label}</span>
      {children}
    </label>
  );
}