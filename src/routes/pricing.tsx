import { createFileRoute } from "@tanstack/react-router";
import PricingCards from "@/components/aura/PricingCards";
import Footer from "@/components/aura/Footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "AURA — Τιμές" },
      { name: "description", content: "Πλήρης, Βασική και Αρχική Μέθοδος AURA." },
    ],
  }),
  component: PricingPage,
});

const FAQ = [
  {
    q: "Μπορώ να ακυρώσω όποτε θέλω;",
    a: "Ναι. Η ακύρωση γίνεται από το προφίλ σου και ισχύει στο τέλος της τρέχουσας περιόδου. Δεν υπάρχουν κρυφές χρεώσεις.",
  },
  {
    q: "Τι σημαίνει «κουρέματα»;",
    a: "Είναι τα δομημένα practice assignments που ανεβάζεις για αξιολόγηση από AURA educator μέσα στη συνδρομή σου.",
  },
  {
    q: "Παίρνω πιστοποιητικό;",
    a: "Το πιστοποιητικό ολοκλήρωσης περιλαμβάνεται στην Πλήρη Μέθοδο και απονέμεται μόνο μετά από επιτυχή αξιολόγηση, με μοναδικό verification ID.",
  },
  {
    q: "Πώς γίνεται η πληρωμή;",
    a: "Μέσα στην εφαρμογή, μέσω Stripe. Η AURA δεν αποθηκεύει ποτέ στοιχεία κάρτας.",
  },
];

function PricingPage() {
  return (
    <>
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">PRICES</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-100 sm:text-5xl">
            ΔΙΑΛΕΞΕ ΤΟ ΕΠΙΠΕΔΟ
            <br />
            ΤΗΣ ΔΕΣΜΕΥΣΗΣ ΣΟΥ.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-neutral-400">
            Ίδια μέθοδος, διαφορετικό βάθος. Όλα τα πακέτα είναι μηνιαία και ακυρώνονται ανά πάσα
            στιγμή.
          </p>
        </header>

        <section className="mt-16">
          <PricingCards />
        </section>

        <section className="mt-24" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mb-8 text-xs uppercase tracking-[0.4em] text-neutral-600">
            ΣΥΧΝΕΣ ΕΡΩΤΗΣΕΙΣ
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-6">
                <dt className="text-sm font-medium text-neutral-200">{item.q}</dt>
                <dd className="mt-3 text-sm leading-relaxed text-neutral-500">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <Footer />
    </>
  );
}