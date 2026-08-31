import { createFileRoute, Link } from "@tanstack/react-router";
import MethodSteps from "@/components/aura/MethodSteps";
import ChromeButton from "@/components/aura/ChromeButton";
import Footer from "@/components/aura/Footer";

export const Route = createFileRoute("/method")({
  head: () => ({
    meta: [
      { title: "AURA — Η Μέθοδος" },
      {
        name: "description",
        content: "OBSERVE → ANALYZE → DESIGN → EXECUTE → EVALUATE → EVOLVE.",
      },
    ],
  }),
  component: MethodPage,
});

function MethodPage() {
  return (
    <>
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
        <header className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">THE METHOD</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-100 sm:text-6xl">
            LEARN. PRACTICE.
            <br />
            PROVE.
          </h1>
          <p className="mt-7 text-base leading-relaxed text-neutral-400">
            Η μέθοδος AURA είναι ένας κλειστός κύκλος έξι βημάτων. Δεν αντιγράφεις κουρέματα —
            μαθαίνεις να παίρνεις αποφάσεις και να τις υπερασπίζεσαι με αποτέλεσμα.
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
            OBSERVE → ANALYZE → DESIGN → EXECUTE → EVALUATE → EVOLVE
          </p>
        </header>

        <section className="mt-24">
          <MethodSteps />
        </section>

        <section className="mt-24 rounded-2xl border border-white/10 bg-[#0A0A0A] p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-100 sm:text-3xl">
            Έτοιμος να μπεις στη μέθοδο;
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-400">
            Διάλεξε το πακέτο που ταιριάζει στο επίπεδό σου. Ακύρωση ανά πάσα στιγμή.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/pricing">
              <ChromeButton type="button">ΔΕΣ ΤΙΣ ΤΙΜΕΣ</ChromeButton>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}