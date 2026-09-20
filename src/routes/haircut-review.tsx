import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { submitHaircutReview } from "@/lib/queries";
import { ArrowLeft, CheckCircle2, AlertCircle, Scissors } from "lucide-react";

export const Route = createFileRoute("/haircut-review")({
  component: HaircutReviewPage,
});

function toArray(fileList: FileList | null): File[] {
  return fileList ? Array.from(fileList) : [];
}

function HaircutReviewPage() {
  const navigate = useNavigate();

  const [before, setBefore] = useState<File[]>([]);
  const [process, setProcess] = useState<File[]>([]);
  const [after, setAfter] = useState<File[]>([]);
  const [methodDescription, setMethodDescription] = useState("");
  const [technique, setTechnique] = useState("");
  const [tools, setTools] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const field =
    "w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-white/90 outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 placeholder:text-zinc-600";

  async function handleSubmit() {
    setErr(null);
    if (before.length === 0 || after.length === 0) {
      setErr("Χρειάζεται τουλάχιστον μία φωτογραφία Before και μία After.");
      return;
    }
    if (!methodDescription.trim()) {
      setErr("Περιγράψτε τη μέθοδο που επιλέξατε.");
      return;
    }

    setBusy(true);
    try {
      await submitHaircutReview({
        before,
        process,
        after,
        methodDescription,
        technique,
        tools,
        notes,
      });
      navigate({ to: "/dashboard" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 sm:px-6 py-16 text-white relative">
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-600/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="mb-8 relative z-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900/80 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:border-orange-500/40 transition-all backdrop-blur-md shadow-inner group"
        >
          <ArrowLeft className="w-4 h-4 text-orange-400 group-hover:-translate-x-1 transition-transform" />
          Επιστροφή στο Dashboard
        </Link>
      </div>

      <div className="relative z-10 space-y-8">
        <header className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-orange-400 text-xs font-semibold tracking-widest uppercase mb-3 shadow-inner">
            <Scissors className="w-3.5 h-3.5" />
            Haircut Review
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Υποβολή Κουρέματος για Review
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Ανέβασε φωτογραφίες πριν / κατά τη διάρκεια / μετά και εξήγησε τη μέθοδο σου. Ένας εκπαιδευτής θα σου δώσει feedback και πόντους.
          </p>
        </header>

        <section className="p-6 sm:p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Labeled label="Before *">
              <input type="file" accept="image/*" multiple onChange={(e) => setBefore(toArray(e.target.files))} className={field} />
            </Labeled>
            <Labeled label="Process (προαιρετικό)">
              <input type="file" accept="image/*" multiple onChange={(e) => setProcess(toArray(e.target.files))} className={field} />
            </Labeled>
            <Labeled label="After *">
              <input type="file" accept="image/*" multiple onChange={(e) => setAfter(toArray(e.target.files))} className={field} />
            </Labeled>
          </div>

          <Labeled label="Ποια μέθοδο επέλεξες και γιατί *">
            <textarea
              rows={4}
              className={field}
              placeholder="π.χ. Skin fade στα πλαγία με #1 guard, scissor-over-comb στο πάνω μέρος γιατί ο πελάτης ήθελε όγκο..."
              value={methodDescription}
              onChange={(e) => setMethodDescription(e.target.value)}
            />
          </Labeled>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Labeled label="Τεχνική">
              <input className={field} placeholder="π.χ. Taper fade" value={technique} onChange={(e) => setTechnique(e.target.value)} />
            </Labeled>
            <Labeled label="Εργαλεία">
              <input className={field} placeholder="π.χ. #2 guard, thinning shears" value={tools} onChange={(e) => setTools(e.target.value)} />
            </Labeled>
          </div>

          <Labeled label="Επιπλέον σημειώσεις">
            <textarea
              rows={3}
              className={field}
              placeholder="Τύπος μαλλιού πελάτη, δυσκολίες που αντιμετώπισες, τι θα έκανες διαφορετικά..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Labeled>
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
          {busy ? "Υποβολή..." : "Υποβολή για Review"}
        </button>
      </div>
    </main>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
    </label>
  );
}