import { useState } from "react";

interface Step {
  index: string;
  title: string;
  subtitle: string;
  body: string;
  image: string;
}

const STEPS: Step[] = [
  {
    index: "01",
    title: "OBSERVE",
    subtitle: "Παρατήρησε πριν αγγίξεις",
    body: "Κάθε κεφάλι είναι διαφορετικό. Πριν πιάσεις ψαλίδι, μαθαίνεις να διαβάζεις σχήμα κρανίου, γραμμή μαλλιών, πυκνότητα, κατεύθυνση φυσικής πτώσης και αναλογίες προσώπου. Η παρατήρηση είναι δεξιότητα, όχι ταλέντο.",
    image: "/images/method/observe.jpg",
  },
  {
    index: "02",
    title: "ANALYZE",
    subtitle: "Κατάλαβε το γιατί",
    body: "Μετατρέπεις αυτό που βλέπεις σε δεδομένα: τι δουλεύει, τι δημιουργεί πρόβλημα, τι περιορίζει το αποτέλεσμα. Εδώ σταματάει η αντιγραφή και ξεκινάει η κρίση.",
    image: "/images/method/analyze.jpg",
  },
  {
    index: "03",
    title: "DESIGN",
    subtitle: "Σχεδίασε το αποτέλεσμα",
    body: "Πριν το πρώτο πέρασμα, υπάρχει πλάνο: γραμμές, βάρη, μεταβάσεις, τελικό σχήμα. Ένα κούρεμα σχεδιάζεται στο μυαλό και μετά εκτελείται στα χέρια.",
    image: "/images/method/design.jpg",
  },
  {
    index: "04",
    title: "EXECUTE",
    subtitle: "Εκτέλεσε με ακρίβεια",
    body: "Τεχνική, σειρά κινήσεων, έλεγχος πίεσης, σωστό εργαλείο στη σωστή στιγμή. Η εκτέλεση κρίνεται στη συνέπεια, όχι στην ταχύτητα.",
    image: "/images/method/execute.jpg",
  },
  {
    index: "05",
    title: "EVALUATE",
    subtitle: "Αξιολόγησε με στοιχεία",
    body: "Ανεβάζεις before / process / after, εξηγείς τι επέλεξες και γιατί, και παίρνεις δομημένο feedback από AURA educator πάνω σε συγκεκριμένο rubric. Αποδείξεις, όχι εντυπώσεις.",
    image: "/images/method/evaluate.jpg",
  },
  {
    index: "06",
    title: "EVOLVE",
    subtitle: "Εξελίξου μετρήσιμα",
    body: "Κάθε verified skill ξεκλειδώνει το επόμενο βήμα. Το επίπεδό σου δεν προχωράει επειδή πλήρωσες, αλλά επειδή αποδείχθηκε.",
    image: "/images/method/evolve.jpg",
  },
];

function StepMedia({ step }: { step: Step }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
      {failed ? (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.10),transparent_60%)]"
        >
          <span className="text-5xl font-semibold tracking-[0.3em] text-white/10">
            {step.index}
          </span>
        </div>
      ) : (
        <img
          src={step.image}
          alt={`AURA Method — ${step.title}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover grayscale transition-all duration-700 hover:scale-[1.03] hover:grayscale-0"
        />
      )}
    </div>
  );
}

export default function MethodSteps() {
  return (
    <ol className="space-y-20">
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
        >
          <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
            <StepMedia step={step} />
          </div>
          <div className={i % 2 === 1 ? "lg:order-1" : undefined}>
            <span className="text-xs uppercase tracking-[0.4em] text-neutral-600">
              STEP {step.index}
            </span>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-100 sm:text-4xl">
              {step.title}
            </h3>
            <p className="mt-2 text-sm uppercase tracking-[0.2em] text-neutral-500">
              {step.subtitle}
            </p>
            <p className="mt-5 max-w-prose text-base leading-relaxed text-neutral-400">
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}