import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  getAssignment,
  getOrCreateDraft,
  getSubmissionReview,
  saveSubmission,
  submitSubmission,
  uploadSubmissionMedia,
} from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import { MediaThumb } from "@/components/aura/MediaThumb";
import type { Submission } from "@/lib/database.types";
import { Sparkles, Upload, CheckCircle2, Save, AlertCircle, FileCheck, Award, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/practice/$assignmentId")({
  component: PracticePage,
});

type MediaKind = "before" | "process" | "after";

function PracticePage() {
  const { assignmentId } = Route.useParams();
  const [reload, setReload] = useState(0);

  const assignment = useAsync(
    () => getAssignment(assignmentId),
    [assignmentId],
  );
  const draft = useAsync(
    () => getOrCreateDraft(assignmentId),
    [assignmentId, reload],
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 sm:px-6 py-16 text-white relative">
      {/* Ambient background blur */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-600/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="relative z-10">
        {(assignment.loading || draft.loading) && <LoadingSkeleton rows={4} />}
        {assignment.error && <ErrorState message={assignment.error} />}
        {draft.error && <ErrorState message={draft.error} />}

        {assignment.data && draft.data && (
          <SubmissionForm
            assignment={assignment.data}
            draft={draft.data}
            onSubmitted={() => setReload((n) => n + 1)}
          />
        )}
      </div>
    </main>
  );
}

function SubmissionForm({
  assignment,
  draft,
  onSubmitted,
}: {
  assignment: Awaited<ReturnType<typeof getAssignment>>;
  draft: Submission;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState({
    client_context: draft.client_context ?? "",
    observations: draft.observations ?? "",
    intended_result: draft.intended_result ?? "",
    technique: draft.technique ?? "",
    self_evaluation: draft.self_evaluation ?? "",
  });
  const [media, setMedia] = useState({
    before: draft.before_media ?? [],
    process: draft.process_media ?? [],
    after: draft.after_media ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const review = useAsync(() => getSubmissionReview(draft.id), [draft.id]);
  const locked = draft.status === "submitted" || draft.status === "in_review";

  useEffect(() => {
    setMsg(null);
  }, [draft.status]);

  async function handleUpload(kind: MediaKind, files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) {
        paths.push(await uploadSubmissionMedia(draft.id, kind, file));
      }
      const next = { ...media, [kind]: [...media[kind], ...paths] };
      setMedia(next);
      await saveSubmission(draft.id, {
        before_media: next.before,
        process_media: next.process,
        after_media: next.after,
      });
      setMsg("Τα αρχεία ανέβηκαν επιτυχώς.");
    } catch (e) {
      setMsg("Αποτυχία upload: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft() {
    setBusy(true);
    try {
      await saveSubmission(draft.id, form);
      setMsg("Το προσχέδιο αποθηκεύτηκε.");
    } catch (e) {
      setMsg("Αποτυχία αποθήκευσης: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (media.after.length === 0) {
      setMsg("Χρειάζεται τουλάχιστον μία φωτογραφία αποτελέσματος (after).");
      return;
    }
    setBusy(true);
    try {
      await saveSubmission(draft.id, form);
      await submitSubmission(draft.id);
      setMsg("Η υποβολή στάλθηκε για αξιολόγηση.");
      onSubmitted();
    } catch (e) {
      setMsg("Αποτυχία υποβολής: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-white/90 outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50 transition-all duration-300 placeholder:text-zinc-600";

  return (
    <div className="space-y-8">
      {/* Header Card */}
      <header className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-orange-400 text-xs font-semibold tracking-widest uppercase mb-3 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Practice Assignment
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {assignment.title}
          </h1>
          {assignment.brief && (
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-2xl">
              {assignment.brief}
            </p>
          )}
        </div>
        <div>
          <StatusBadge status={draft.status} />
        </div>
      </header>

      {/* Checklist Card */}
      {assignment.checklist.length > 0 && (
        <section className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/70 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-orange-400" />
            Submission Checklist
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-zinc-300">
            {assignment.checklist.map((item, i) => (
              <li key={i} className="flex items-center gap-2.5 p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Media Upload Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["before", "process", "after"] as MediaKind[]).map((kind) => (
          <section key={kind} className="p-6 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-orange-400">
                  {kind} media
                </h2>
                {!locked && draft.status !== "passed" && (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-orange-500 hover:border-orange-500 transition-all duration-300 group shadow-inner">
                    <Upload className="w-3.5 h-3.5 text-orange-400 group-hover:text-white" />
                    <span>Upload</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => handleUpload(kind, e.target.files)}
                    />
                  </label>
                )}
              </div>
              {media[kind].length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {media[kind].map((p) => (
                    <MediaThumb key={p} path={p} />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-white/10 rounded-2xl bg-black/20">
                  <p className="text-xs text-zinc-600">Κανένα αρχείο ακόμη.</p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Form Fields Card */}
      <section className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl space-y-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/70 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-orange-400" />
          Λεπτομέρειες & Αυτο-αξιολόγηση
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Textarea
            label="Client context"
            value={form.client_context}
            disabled={locked || draft.status === "passed"}
            onChange={(v) => setForm({ ...form, client_context: v })}
            className={field}
            placeholder="Περιγράψτε το προφίλ και τις ανάγκες του πελάτη..."
          />
          <Textarea
            label="Παρατηρήσεις"
            value={form.observations}
            disabled={locked || draft.status === "passed"}
            onChange={(v) => setForm({ ...form, observations: v })}
            className={field}
            placeholder="Σημαντικές παρατηρήσεις κατά τη διαδικασία..."
          />
          <Textarea
            label="Επιδιωκόμενο αποτέλεσμα"
            value={form.intended_result}
            disabled={locked || draft.status === "passed"}
            onChange={(v) => setForm({ ...form, intended_result: v })}
            className={field}
            placeholder="Ποιος ήταν ο στόχος του κουρέματος..."
          />
          <Textarea
            label="Τεχνική & γιατί"
            value={form.technique}
            disabled={locked || draft.status === "passed"}
            onChange={(v) => setForm({ ...form, technique: v })}
            className={field}
            placeholder="Εξηγείστε τις τεχνικές που χρησιμοποιήσατε..."
          />
        </div>
        <div>
          <Textarea
            label="Αυτο-αξιολόγηση"
            value={form.self_evaluation}
            disabled={locked || draft.status === "passed"}
            onChange={(v) => setForm({ ...form, self_evaluation: v })}
            className={field}
            placeholder="Πώς κρίνετε εσείς προσωπικά το αποτέλεσμα;"
          />
        </div>
      </section>

      {msg && (
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/10 text-zinc-300 text-sm flex items-center gap-3 backdrop-blur-xl shadow-lg">
          <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
          <span role="status">{msg}</span>
        </div>
      )}

      {/* Action Buttons */}
      {!locked && draft.status !== "passed" && (
        <div className="flex flex-wrap gap-4 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={busy}
            className="flex items-center gap-2 rounded-2xl border border-white/15 bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 hover:border-white/30 disabled:opacity-50 cursor-pointer shadow-inner"
          >
            <Save className="w-4 h-4 text-orange-400" />
            Αποθήκευση προσχεδίου
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3.5 text-sm font-bold text-white shadow-[0_0_25px_-5px_rgba(255,90,20,0.5)] hover:shadow-[0_0_35px_-2px_rgba(255,90,20,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            Υποβολή για αξιολόγηση
          </button>
        </div>
      )}

      {/* Instructor Feedback Section */}
      {review.data && (
        <section className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-orange-500/30 shadow-[0_0_40px_-10px_rgba(255,90,20,0.2)] backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Feedback Εκπαιδευτή
            </h2>
            {review.data.score != null && (
              <div className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
                {review.data.score}
                <span className="text-xs font-normal text-zinc-500"> / 100</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <FeedbackBlock label="Δυνατά σημεία" value={review.data.strengths} />
            <FeedbackBlock label="Τεχνικά κενά" value={review.data.technical_gaps} />
            <FeedbackBlock label="Κενά μεθόδου" value={review.data.method_gaps} />
            <FeedbackBlock label="Επόμενες ενέργειες" value={review.data.next_actions} />
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Submission["status"] }) {
  const map: Record<Submission["status"], string> = {
    draft: "bg-white/5 border border-white/10 text-zinc-400",
    submitted: "bg-blue-500/10 border border-blue-500/20 text-blue-400",
    in_review: "bg-amber-500/10 border border-amber-500/20 text-amber-400",
    needs_revision: "bg-orange-500/10 border border-orange-500/20 text-orange-400",
    passed: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
  };
  return (
    <span
      className={`inline-block rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider shadow-inner ${map[status]}`}
    >
      {status}
    </span>
  );
}

function Textarea({
  label,
  value,
  onChange,
  disabled,
  className,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  className: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      <textarea
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        placeholder={placeholder}
      />
    </label>
  );
}

function FeedbackBlock({
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