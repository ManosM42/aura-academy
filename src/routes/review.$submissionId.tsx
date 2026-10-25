import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { getSubmissionForReview, submitReview } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import { MediaThumb } from "@/components/aura/MediaThumb";
import type { ReviewDecision } from "@/lib/database.types";
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Award,
  FileText,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/review/$submissionId")({
  component: ReviewDetailPage,
});

const EASE = [0.22, 1, 0.36, 1] as const;
const CHROME_TEXT =
  "linear-gradient(90deg, #595959 0%, #b3b3b3 25%, #ffffff 50%, #b3b3b3 75%, #595959 100%)";
const CHROME_FILL =
  "linear-gradient(180deg, #ffffff 0%, #e6e6ea 30%, #b4b4bc 48%, #8a8a92 52%, #bdbdc4 74%, #f4f4f6 100%)";
const FRAME_BORDER =
  "linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.06) 65%, rgba(255,255,255,0.4))";

const DECISIONS: { value: ReviewDecision; label: string }[] = [
  { value: "passed", label: "Verified" },
  { value: "needs_revision", label: "Needs revision" },
  { value: "failed", label: "Not passed" },
];

function Frame({ children, className = "", inner = "p-6 sm:p-8" }: { children: React.ReactNode; className?: string; inner?: string }) {
  return (
    <div className={`relative rounded-3xl p-px ${className}`} style={{ background: FRAME_BORDER, boxShadow: "0 0 60px rgba(0,0,0,0.9)" }}>
      <div className={`relative overflow-hidden rounded-[23px] bg-[#0a0a0b] ${inner}`}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)" }} />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-white/65">
      <span className="text-white">{icon}</span>
      {children}
    </h2>
  );
}

function ReviewDetailPage() {
  const reduce = useReducedMotion();
  const { submissionId } = Route.useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useAsync(
    () => getSubmissionForReview(submissionId),
    [submissionId],
  );

  const [text, setText] = useState({
    strengths: "",
    technical_gaps: "",
    method_gaps: "",
    next_actions: "",
  });
  const [decision, setDecision] = useState<ReviewDecision>("passed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setErr(null);
    try {
      await submitReview({
        submissionId,
        // No numeric grading any more: the decision is the result.
        // "Verified" is stored as a full pass, anything else as 0.
        score: decision === "passed" ? 100 : 0,
        rubricScores: [],
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
    "w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-white/90 outline-none transition-all duration-300 placeholder:text-white/25 focus:border-white/50 focus:bg-black/80 focus:shadow-[0_0_28px_rgba(255,255,255,0.1)] focus:ring-2 focus:ring-white/15";

  const verified = decision === "passed";

  return (
    <main className="relative mx-auto min-h-screen max-w-5xl overflow-hidden px-4 py-16 text-white sm:px-6">
      {/* ambient glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 aspect-square w-[min(800px,120%)] -translate-x-1/2 -translate-y-1/3 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, rgba(170,180,190,0.04) 40%, transparent 70%)" }}
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* back */}
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: EASE }} className="relative mb-8">
        <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.97 }} className="inline-block">
          <Link
            to="/review"
            className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-white/80 outline-none backdrop-blur-md transition-all hover:border-white/60 hover:bg-white/[0.09] hover:text-white hover:shadow-[0_0_26px_rgba(255,255,255,0.15)] focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            Επιστροφή στην Ουρά
          </Link>
        </motion.div>
      </motion.div>

      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} />}

      {data && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          className="relative space-y-8"
        >
          {/* header */}
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
            <Frame>
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                    <Sparkles className="size-3.5" />
                    Submission Evaluation
                  </div>
                  <h1 className="text-2xl font-extrabold sm:text-4xl">
                    <motion.span
                      initial={{ backgroundPosition: "0% 50%" }}
                      animate={reduce ? undefined : { backgroundPosition: "100% 50%" }}
                      transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                      style={{
                        backgroundImage: CHROME_TEXT,
                        backgroundSize: "300% auto",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                      className="inline-block drop-shadow-[0_0_26px_rgba(255,255,255,0.45)]"
                    >
                      {data.submission.assignment?.title ?? "Υποβολή"}
                    </motion.span>
                  </h1>
                  {(data.submission.assignment as any)?.skill?.name && (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
                      Skill: {(data.submission.assignment as any).skill.name}
                    </p>
                  )}
                  <p className="mt-3 flex items-center gap-2 text-sm text-white/50">
                    <span className="font-medium text-white">{data.submission.student?.full_name ?? "Μαθητής"}</span>
                    <span>·</span>
                    <span>Attempt {data.submission.attempt}</span>
                  </p>
                </div>

                {/* live result preview */}
                <div className="min-w-[170px] rounded-2xl border border-white/10 bg-black/50 p-5 text-center">
                  <span className="mb-3 block text-[10px] uppercase tracking-[0.3em] text-white/45">Αποτέλεσμα</span>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={decision}
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold uppercase tracking-wider ${
                        verified
                          ? "border-white bg-white text-neutral-950 shadow-[0_0_28px_rgba(255,255,255,0.6)]"
                          : "border-white/25 bg-white/[0.06] text-white/75"
                      }`}
                    >
                      {verified && <ShieldCheck className="size-4" />}
                      {DECISIONS.find((d) => d.value === decision)?.label}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </Frame>
          </motion.div>

          {/* media */}
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
            <Frame>
              <CardTitle icon={<FileText className="size-4" />}>Υλικό Υποβολής (Media Files)</CardTitle>
              <div className="grid gap-5 md:grid-cols-3">
                <MediaColumn title="Before" paths={data.submission.before_media} />
                <MediaColumn title="Process" paths={data.submission.process_media} />
                <MediaColumn title="After" paths={data.submission.after_media} />
              </div>
            </Frame>
          </motion.div>

          {/* context */}
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
            <Frame>
              <CardTitle icon={<Award className="size-4" />}>Αναφορά Μαθητή & Πλαισίου</CardTitle>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Reasoning label="Client context" value={data.submission.client_context} />
                <Reasoning label="Παρατηρήσεις" value={data.submission.observations} />
                <Reasoning label="Τεχνική" value={data.submission.technique} />
                <Reasoning label="Αυτο-αξιολόγηση" value={data.submission.self_evaluation} />
              </div>
            </Frame>
          </motion.div>

          {/* feedback + decision */}
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
            <Frame>
              <CardTitle icon={<CheckCircle2 className="size-4" />}>Φόρμα Ανατροφοδότησης & Απόφασης</CardTitle>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Labeled label="Δυνατά σημεία">
                  <textarea rows={3} className={field} placeholder="Γράψτε τα θετικά στοιχεία της εργασίας..." value={text.strengths} onChange={(e) => setText({ ...text, strengths: e.target.value })} />
                </Labeled>
                <Labeled label="Τεχνικά κενά">
                  <textarea rows={3} className={field} placeholder="Επισημάνετε τεχνικές αδυναμίες..." value={text.technical_gaps} onChange={(e) => setText({ ...text, technical_gaps: e.target.value })} />
                </Labeled>
                <Labeled label="Κενά μεθόδου">
                  <textarea rows={3} className={field} placeholder="Σημεία βελτίωσης στη μεθοδολογία..." value={text.method_gaps} onChange={(e) => setText({ ...text, method_gaps: e.target.value })} />
                </Labeled>
                <Labeled label="Επόμενες ενέργειες">
                  <textarea rows={3} className={field} placeholder="Τι πρέπει να προσέξει στην επόμενη προσπάθεια..." value={text.next_actions} onChange={(e) => setText({ ...text, next_actions: e.target.value })} />
                </Labeled>
              </div>

              {/* decision picker */}
              <div className="mt-8">
                <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.25em] text-white/45">Τελική Απόφαση</span>
                <div role="radiogroup" aria-label="Τελική Απόφαση" className="grid gap-2 rounded-2xl border border-white/10 bg-black/50 p-1.5 sm:grid-cols-3">
                  {DECISIONS.map((d) => {
                    const on = decision === d.value;
                    return (
                      <button
                        key={d.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setDecision(d.value)}
                        className="relative rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60"
                        style={{ color: on ? "#0a0a0a" : "rgba(255,255,255,0.6)" }}
                      >
                        {on && (
                          <motion.span
                            layoutId="decision-pill"
                            className="absolute inset-0 rounded-xl"
                            style={{ backgroundImage: CHROME_FILL, boxShadow: "0 0 26px rgba(255,255,255,0.4), inset 0 1px 0 rgba(255,255,255,0.95)" }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                        <span className="relative">{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Frame>
          </motion.div>

          {err && (
            <div role="alert" className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.05] p-4 text-sm text-white/85">
              <AlertCircle className="size-5 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* submit */}
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              whileHover={{ y: -3, scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-full px-10 py-4 text-sm font-bold text-neutral-950 outline-none transition-shadow duration-300 hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
              style={{ backgroundImage: CHROME_FILL, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 30px rgba(255,255,255,0.18)" }}
            >
              {!reduce && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                  animate={{ x: ["-160%", "420%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                  style={{ skewX: -18 }}
                />
              )}
              <CheckCircle2 className="relative size-5" />
              <span className="relative">{busy ? "Καταχώρηση..." : "Καταχώρηση Αξιολόγησης"}</span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </main>
  );
}

function MediaColumn({ title, paths }: { title: string; paths: string[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/40 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-white/60">{title}</h3>
      {paths.length === 0 ? (
        <p className="text-xs text-white/25">—</p>
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

function Reasoning({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{value}</p>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-white/45">{label}</span>
      {children}
    </label>
  );
}