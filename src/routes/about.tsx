import { createFileRoute } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Footer from "@/components/aura/Footer";
import logoImg from "@/assets/logo.jpg";
import founderImg from "@/assets/founder.jpg";
import cofounderImg from "@/assets/cofounder.jpg";
import developerImg from "@/assets/developer.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "AURA — Η Ομάδα" },
      { name: "description", content: "Η ομάδα πίσω από την AURA Academy." },
    ],
  }),
  component: AboutPage,
});

interface Profile {
  id: string;
  name: string;
  role: string;
  image: string;
  paragraphs: string[];
  mottos: string[];
  reverse: boolean;
}

const teamProfiles: Profile[] = [
  {
    id: "01",
    name: "ΘΕΟΠΙΣΤΟΣ",
    role: "FOUNDER • CREATOR • CREATIVE DIRECTOR • HEAD EDUCATOR",
    image: founderImg,
    paragraphs: [
      "Ο Θεόπιστος είναι ο δημιουργός και η δημιουργική δύναμη πίσω από την AURA.",
      "Με πολυετή εμπειρία στον χώρο της κομμωτικής, της επαγγελματικής εκπαίδευσης και της δημιουργίας, έχει αφιερώσει την πορεία του όχι μόνο στην εξέλιξη της τεχνικής, αλλά και στην κατανόηση του τι πραγματικά δημιουργεί έναν ολοκληρωμένο επαγγελματία.",
      "Δεν πιστεύει στην εκπαίδευση που βασίζεται απλώς στην αντιγραφή. Πιστεύει στην κατανόηση. Στην παρατήρηση. Στη σκέψη πριν από την πράξη.",
      "Με αυτό το όραμα δημιούργησε την AURA: ένα σύγχρονο εκπαιδευτικό σύστημα που δεν έχει στόχο απλώς να διδάξει τεχνικές, αλλά να βοηθήσει κάθε επαγγελματία να αναπτύξει τον δικό του τρόπο σκέψης, κρίσης και δημιουργίας.",
      "Ως FOUNDER, CREATIVE DIRECTOR και HEAD EDUCATOR, καθοδηγεί τη δημιουργική και εκπαιδευτική κατεύθυνση της AURA.",
      "Στόχος του είναι να δημιουργήσει μια νέα γενιά επαγγελματιών που δεν ακολουθούν απλώς τεχνικές και τάσεις. Τις κατανοούν. Τις εξελίσσουν. Και δημιουργούν τις δικές τους.",
    ],
    mottos: [
      "OBSERVE. ANALYZE. DESIGN. EXECUTE. EVALUATE. EVOLVE.",
      "WE DON’T FOLLOW TRENDS. WE SPAWN THEM.",
    ],
    reverse: false,
  },
  {
    id: "02",
    name: "ΑΓΓΕΛΟΣ",
    role: "PARTNER • STRATEGIC DEVELOPMENT • HEAD EDUCATOR",
    image: cofounderImg,
    paragraphs: [
      "Ο Άγγελος αποτελεί σημαντικό μέλος της AURA και ενεργό κομμάτι της εξέλιξης και της κατεύθυνσής της.",
      "Με κοινό όραμα, υψηλά standards και πάθος για την επαγγελματική εξέλιξη, συμμετέχει ενεργά τόσο στην ανάπτυξη της AURA όσο και στη δημιουργία μιας νέας εκπαιδευτικής κουλτούρας.",
      "Ως HEAD EDUCATOR, στόχος του δεν είναι απλώς να μεταφέρει τεχνικές. Στόχος του είναι να μεταφέρει γνώση. Να αναπτύσσει επαγγελματική σκέψη. Να βοηθά κάθε εκπαιδευόμενο να κατανοήσει το γιατί πίσω από κάθε επιλογή.",
      "Για τον Άγγελο, η εξέλιξη δεν σταματά ποτέ. Κάθε τεχνική μπορεί να βελτιωθεί. Κάθε επαγγελματίας μπορεί να εξελιχθεί. Και κάθε νέα γνώση μπορεί να γίνει το επόμενο βήμα.",
      "Μέσα από την AURA, συμμετέχει στη δημιουργία μιας κοινότητας ανθρώπων που δεν θέλουν απλώς να είναι καλοί στη δουλειά τους. Θέλουν να γίνουν εξαιρετικοί.",
    ],
    mottos: [
      "KNOWLEDGE CREATES CONFIDENCE.",
      "CONFIDENCE CREATES EXCELLENCE.",
    ],
    reverse: true,
  },
  {
    id: "03",
    name: "ΜΑΝΟΣ",
    role: "PROGRAMMER • DIGITAL CREATOR • ONLINE ACADEMY",
    image: developerImg,
    paragraphs: [
      "Ο Μάνος αποτελεί τη δύναμη πίσω από την ψηφιακή εξέλιξη της AURA.",
      "Παρότι μόλις 17 ετών, ξεκίνησε να ασχολείται με τον προγραμματισμό από τα 15 του και έχει ήδη αναπτύξει σημαντικές γνώσεις και εμπειρία στον χώρο της τεχνολογίας και της ψηφιακής δημιουργίας.",
      "Ως PROGRAMMER, βρίσκεται πίσω από τη δημιουργία και την ανάπτυξη της Online Academy της AURA.",
      "Ο ρόλος του είναι να μετατρέπει το όραμα, τη γνώση και το εκπαιδευτικό σύστημα της AURA σε μια σύγχρονη ψηφιακή εμπειρία.",
      "Για τον Μάνο, η τεχνολογία δεν είναι απλώς ένα εργαλείο. Είναι ένας τρόπος να δημιουργείς χωρίς όρια.",
      "Η παρουσία του στην ομάδα αντιπροσωπεύει τη νέα γενιά δημιουργών. Ανθρώπους που ξεκινούν νωρίς. Μαθαίνουν γρήγορα. Και δεν περιμένουν το μέλλον. Το δημιουργούν.",
    ],
    mottos: [
      "THE NEXT GENERATION IS ALREADY HERE.",
      "WE ARE BUILDING THE DIGITAL FUTURE OF AURA.",
    ],
    reverse: false,
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
};

function ProfileBlock({ profile }: { profile: Profile }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const yImage = useTransform(scrollYProgress, [0, 1], [-60, 60]);
  const yText = useTransform(scrollYProgress, [0, 1], [25, -25]);

  return (
    <section
      ref={ref}
      className="relative border-b border-zinc-900/80 py-24 md:py-36 overflow-hidden"
    >
      {/* Chrome Radial Light Background */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-full -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-200/5 via-black to-black blur-[130px]" />

      <div
        className={`mx-auto max-w-7xl px-5 sm:px-8 grid gap-12 lg:gap-20 items-center lg:grid-cols-12 ${
          profile.reverse ? "lg:flex-row-reverse" : ""
        }`}
      >
        {/* Profile Image with Parallax & Metallic Framing */}
        <motion.div
          {...fadeInUp}
          className={`lg:col-span-5 relative group ${
            profile.reverse ? "lg:order-2" : "lg:order-1"
          }`}
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-950 shadow-[0_0_50px_rgba(255,255,255,0.03)]">
            {/* Top specular reflection line */}
            <div className="absolute inset-x-0 top-0 z-10 h-[1px] bg-gradient-to-r from-transparent via-zinc-200 to-transparent opacity-70" />

            <motion.img
              src={profile.image}
              alt={profile.name}
              style={{ y: yImage }}
              className="h-[115%] w-full object-cover object-center grayscale contrast-110 transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
          </div>

          <span className="absolute -top-6 -left-4 font-mono text-5xl font-extralight tracking-tighter text-zinc-800/50 select-none">
            {profile.id}
          </span>
        </motion.div>

        {/* Profile Description Container */}
        <motion.div
          {...fadeInUp}
          style={{ y: yText }}
          className={`lg:col-span-7 flex flex-col justify-center ${
            profile.reverse ? "lg:order-1" : "lg:order-2"
          }`}
        >
          {/* Subtitle / Role */}
          <span className="inline-block origin-left scale-x-105 text-[10px] font-extralight uppercase tracking-[0.4em] text-zinc-400">
            // {profile.role}
          </span>

          {/* Metallic Title */}
          <h2 className="mt-4 text-4xl font-extrabold uppercase tracking-tight text-white sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]">
              {profile.name}
            </span>
          </h2>

          {/* Paragraphs */}
          <div className="mt-8 space-y-4 text-sm sm:text-base leading-relaxed font-extralight text-zinc-300">
            {profile.paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>

          {/* Mottos / Highlights Container */}
          <div className="mt-10 space-y-3 pt-6 border-t border-zinc-900">
            {profile.mottos.map((motto, idx) => (
              <div
                key={idx}
                className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-5 py-3.5 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-400/40 to-transparent" />
                <p className="inline-block origin-left scale-x-105 text-xs sm:text-sm font-extralight uppercase tracking-[0.35em] text-zinc-100">
                  {motto}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function AboutPage() {
  const { scrollYProgress } = useScroll();

  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 selection:bg-zinc-200 selection:text-black">
      {/* Scroll Progress Line */}
      <motion.div
        className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-gradient-to-r from-zinc-700 via-white to-zinc-700 origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      <main>
        {/* Hero / Header Section with Blended Logo */}
        <motion.header
          {...fadeInUp}
          className="relative mx-auto max-w-7xl px-5 pt-36 pb-20 sm:px-8 sm:pt-48 border-b border-zinc-900"
        >
          <div className="flex flex-col items-center gap-10 md:flex-row md:items-center md:gap-16">
            
            {/* Logo image with 4-way radial blend gradient */}
            <div className="relative shrink-0 w-48 sm:w-60 md:w-72 aspect-square flex items-center justify-center">
              <div className="absolute inset-0 bg-white/5 rounded-full blur-3xl pointer-events-none" />
              <img
                src={logoImg}
                alt="AURA Logo"
                className="w-full h-full object-contain [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
              />
            </div>

            {/* Title & Tagline */}
            <div className="flex-1 max-w-3xl text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950 px-4 py-1 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span className="inline-block scale-x-110 origin-left text-[10px] font-extralight uppercase tracking-[0.4em] text-zinc-400">
                  ABOUT AURA
                </span>
              </div>

              <h1 className="mt-6 text-4xl font-extrabold uppercase tracking-tight sm:text-6xl lg:text-7xl leading-[1.05]">
                ΕΜΕΙΣ ΧΤΙΖΟΥΜΕ{" "}
                <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-600 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]">
                  ΕΠΑΓΓΕΛΜΑΤΙΕΣ.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base sm:text-lg font-extralight leading-relaxed text-zinc-400">
                Η <strong className="font-normal text-zinc-100">AURA</strong> δεν είναι μια απλή πλατφόρμα. Είναι το λειτουργικό σύστημα του σύγχρονου barber: μέθοδος, πρακτική, αξιολόγηση και πιστοποίηση που βασίζεται σε αποδείξεις.
              </p>
            </div>
          </div>
        </motion.header>

        {/* Dynamic Scroll Profile Blocks */}
        {teamProfiles.map((profile) => (
          <ProfileBlock key={profile.name} profile={profile} />
        ))}
      </main>

      <Footer />
    </div>
  );
}