import { createFileRoute } from "@tanstack/react-router";
import TeamGrid from "@/components/aura/TeamGrid";
import Footer from "@/components/aura/Footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "AURA — Εμείς" },
      { name: "description", content: "Η ομάδα πίσω από την AURA Academy." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
        <header className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ABOUT US</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-100 sm:text-6xl">
            ΕΜΕΙΣ ΧΤΙΖΟΥΜΕ
            <br />
            ΕΠΑΓΓΕΛΜΑΤΙΕΣ.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-relaxed text-neutral-400">
            Η AURA δεν είναι μια βιβλιοθήκη βίντεο. Είναι το λειτουργικό σύστημα του σύγχρονου
            barber: μέθοδος, πρακτική, αξιολόγηση από educator και πιστοποίηση που βασίζεται σε
            αποδείξεις — όχι σε ώρες παρακολούθησης.
          </p>
        </header>

        <section className="mt-20" aria-labelledby="team-heading">
          <h2
            id="team-heading"
            className="mb-8 text-xs uppercase tracking-[0.4em] text-neutral-600"
          >
            Η ΟΜΑΔΑ
          </h2>
          <TeamGrid />
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3" aria-label="Οι αρχές μας">
          {[
            { title: "METHOD FIRST", body: "Πρώτα η μέθοδος, μετά το εργαλείο." },
            { title: "EVIDENCE OVER CLAIMS", body: "Κάθε skill επιβεβαιώνεται με submission." },
            { title: "PROGRESS IS VISIBLE", body: "Ξέρεις πάντα πού είσαι και τι ακολουθεί." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-6">
              <h3 className="text-xs uppercase tracking-[0.25em] text-neutral-300">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">{item.body}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}