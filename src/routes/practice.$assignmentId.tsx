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
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-white">
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
      setMsg("Τα αρχεία ανέβηκαν.");
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
    "w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/90 outline-none focus:border-white/30 disabled:opacity-60";

  return (
    <>
      <header className="mb-6 border-b border-white/10 pb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Practice
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{assignment.title}</h1>
        {assignment.brief && (
          <p className="mt-2 text-sm text-white/70">{assignment.brief}</p>
        )}
        <StatusBadge status={draft.status} />
      </header>

      {assignment.checklist.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-white/70">
            Submission checklist
          </h2>
          <ul className="space-y-1 text-sm text-white/60">
            {assignment.checklist.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </section>
      )}

      {(["before", "process", "after"] as MediaKind[]).map((kind) => (
        <section key={kind} className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium capitalize text-white/70">
              {kind} media
            </h2>
            {!locked && draft.status !== "passed" && (
              <label className="cursor-pointer rounded-lg border border-white/15 px-3 py-1 text-xs text-white/80 transition hover:bg-white/10">
                + Ανέβασμα
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
            <div className="grid grid-cols-3 gap-2">
              {media[kind].map((p) => (
                <MediaThumb key={p} path={p} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/40">Κανένα αρχείο ακόμη.</p>
          )}
        </section>
      ))}

      <section className="space-y-4">
        <Textarea
          label="Client context"
          value={form.client_context}
          disabled={locked || draft.status === "passed"}
          onChange={(v) => setForm({ ...form, client_context: v })}
          className={field}
        />
        <Textarea
          label="Παρατηρήσεις"
          value={form.observations}
          disabled={locked || draft.status === "passed"}
          onChange={(v) => setForm({ ...form, observations: v })}
          className={field}
        />
        <Textarea
          label="Επιδιωκόμενο αποτέλεσμα"
          value={form.intended_result}
          disabled={locked || draft.status === "passed"}
          onChange={(v) => setForm({ ...form, intended_result: v })}
          className={field}
        />
        <Textarea
          label="Τεχνική & γιατί"
          value={form.technique}
          disabled={locked || draft.status === "passed"}
          onChange={(v) => setForm({ ...form, technique: v })}
          className={field}
        />
        <Textarea
          label="Αυτο-αξιολόγηση"
          value={form.self_evaluation}
          disabled={locked || draft.status === "passed"}
          onChange={(v) => setForm({ ...form, self_evaluation: v })}
          className={field}
        />
      </section>

      {msg && (
        <p className="mt-4 text-sm text-white/70" role="status">
          {msg}
        </p>
      )}

      {!locked && draft.status !== "passed" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={busy}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            Αποθήκευση προσχεδίου
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            Υποβολή για αξιολόγηση
          </button>
        </div>
      )}

      {review.data && (
        <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium text-white/70">
            Feedback εκπαιδευτή
          </h2>
          {review.data.score != null && (
            <p className="mt-1 text-2xl font-semibold">
              {review.data.score}
              <span className="text-sm text-white/40"> / 100</span>
            </p>
          )}
          <FeedbackBlock label="Δυνατά σημεία" value={review.data.strengths} />
          <FeedbackBlock
            label="Τεχνικά κενά"
            value={review.data.technical_gaps}
          />
          <FeedbackBlock
            label="Κενά μεθόδου"
            value={review.data.method_gaps}
          />
          <FeedbackBlock
            label="Επόμενες ενέργειες"
            value={review.data.next_actions}
          />
        </section>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: Submission["status"] }) {
  const map: Record<Submission["status"], string> = {
    draft: "bg-white/10 text-white/70",
    submitted: "bg-blue-500/15 text-blue-300",
    in_review: "bg-amber-500/15 text-amber-300",
    needs_revision: "bg-orange-500/15 text-orange-300",
    passed: "bg-emerald-500/15 text-emerald-300",
  };
  return (
    <span
      className={`mt-3 inline-block rounded-full px-3 py-1 text-xs ${map[status]}`}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  className: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-white/70">{label}</span>
      <textarea
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={className}
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
    <div className="mt-3">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{value}</p>
    </div>
  );
}