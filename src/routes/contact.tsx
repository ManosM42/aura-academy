import { createFileRoute } from "@tanstack/react-router";
import ContactForm from "@/components/aura/ContactForm";
import Footer from "@/components/aura/Footer";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "AURA — Επικοινωνία" },
      { name: "description", content: "Στείλε μήνυμα ή κλείσε ραντεβού με την AURA Academy." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <>
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <header>
            <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">CONTACT</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-100 sm:text-5xl">
              ΜΙΛΑ ΜΑΣ.
            </h1>
            <p className="mt-6 text-base leading-relaxed text-neutral-400">
              Ρώτα για τη μέθοδο, τα πακέτα ή την πιστοποίηση — ή κλείσε ραντεβού για να
              συζητήσουμε το επίπεδό σου και τους στόχους σου.
            </p>

            <dl className="mt-10 space-y-6 border-t border-white/10 pt-8">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.25em] text-neutral-600">
                  Χρόνος απάντησης
                </dt>
                <dd className="mt-2 text-sm text-neutral-300">1–2 εργάσιμες ημέρες</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.25em] text-neutral-600">
                  Ραντεβού
                </dt>
                <dd className="mt-2 text-sm text-neutral-300">
                  Δήλωσε προτιμώμενη ώρα και επιβεβαιώνουμε με email.
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.25em] text-neutral-600">
                  Υπάρχοντες μαθητές
                </dt>
                <dd className="mt-2 text-sm text-neutral-300">
                  Για θέματα λογαριασμού ή χρέωσης, ανάφερέ το στο μήνυμά σου.
                </dd>
              </div>
            </dl>
          </header>

          <ContactForm />
        </div>
      </main>
      <Footer />
    </>
  );
}