// src/routes/cookie-policy.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cookie-policy")({
  component: CookiePolicyPage,
  head: () => ({
    meta: [
      { title: "Πολιτική Cookies — AURA" },
      { name: "description", content: "Πολιτική cookies της AURA." },
    ],
  }),
});

function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:px-8">
      <p className="text-[10px] font-extralight uppercase tracking-[0.4em] text-neutral-500">
        Νομικά
      </p>
      <h1 className="mt-3 text-2xl font-extralight tracking-wide text-neutral-100 sm:text-3xl">
        Πολιτική Cookies
      </h1>

      <div className="mt-8 space-y-8 text-sm font-extralight leading-relaxed text-neutral-300">
        <section>
          <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-neutral-100">
            Τι είναι τα cookies
          </h2>
          <p className="mt-3">
            Τα cookies είναι μικρά αρχεία κειμένου που αποθηκεύονται στη συσκευή σας όταν
            επισκέπτεστε έναν ιστότοπο, ώστε να θυμάται τις προτιμήσεις σας και να λειτουργεί σωστά.
          </p>
        </section>

        <section>
          <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-neutral-100">
            Απολύτως απαραίτητα cookies
          </h2>
          <p className="mt-3">
            Είναι απαραίτητα για τη λειτουργία της πλατφόρμας AURA και δεν μπορούν να
            απενεργοποιηθούν — π.χ. cookies σύνδεσης/ταυτοποίησης χρήστη και το cookie που θυμάται
            την επιλογή σας για αποδοχή ή απόρριψη cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-neutral-100">
            Λειτουργικά cookies
          </h2>
          <p className="mt-3">
            Χρησιμοποιούνται π.χ. για την απομνημόνευση της γλώσσας που έχετε επιλέξει μέσω του
            εργαλείου μετάφρασης σελίδας.
          </p>
        </section>

        <section>
          <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-neutral-100">
            Cookies στατιστικών
          </h2>
          <p className="mt-3">
            Εφόσον τα αποδεχτείτε, ενδέχεται να χρησιμοποιηθούν για την κατανόηση του τρόπου χρήσης
            της πλατφόρμας. Με «Απόρριψη», αυτά δεν ενεργοποιούνται.
          </p>
        </section>

        <section>
          <h2 className="text-xs font-normal uppercase tracking-[0.3em] text-neutral-100">
            Αλλαγή της επιλογής σας
          </h2>
          <p className="mt-3">
            Διαγράφοντας τα cookies του browser για αυτόν τον ιστότοπο, η καρτέλα επιλογής θα
            εμφανιστεί ξανά.
          </p>
        </section>
      </div>
    </main>
  );
}