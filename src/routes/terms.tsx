import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import Footer from "@/components/aura/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "AURA — Terms of Service & Privacy Policy" },
      { name: "description", content: "Terms of Service and Privacy Policy for AURA Hair Method Academy." },
    ],
  }),
  component: TermsPage,
});

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

function TermsPage() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 selection:bg-zinc-200 selection:text-black">
      <main className="mx-auto max-w-4xl px-5 pt-36 pb-24 sm:px-8 sm:pt-44">
        
        {/* Header */}
        <motion.div {...fadeInUp} className="text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950 px-3.5 py-1 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span className="inline-block scale-x-110 origin-left text-[10px] font-extralight uppercase tracking-[0.4em] text-zinc-400">
              LEGAL AGREEMENT
            </span>
          </div>

          <h1 className="mt-6 text-3xl font-extrabold uppercase tracking-tight sm:text-5xl md:text-6xl">
            TERMS &{" "}
            <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-600 bg-clip-text text-transparent">
              PRIVACY POLICY
            </span>
          </h1>
          <p className="mt-4 text-xs font-extralight uppercase tracking-[0.3em] text-zinc-500">
            Last Updated: September 2026
          </p>
        </motion.div>

        {/* Content Section */}
        <motion.div
          {...fadeInUp}
          className="mt-12 space-y-10 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-xl sm:p-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-sm font-extralight leading-relaxed text-zinc-300"
        >
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white border-b border-zinc-800 pb-2">
              1. ACCEPTANCE OF TERMS
            </h2>
            <p>
              By accessing or using the AURA — Hair Method Academy platform ("AURA"), you agree to be bound by these Terms of Service and Privacy Policy. If you do not agree, you may not access or use our services or register for online courses.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white border-b border-zinc-800 pb-2">
              2. EDUCATIONAL CONTENT & INTELLECTUAL PROPERTY
            </h2>
            <p>
              All video materials, geometric techniques, diagrams, downloadable assets, and evaluation frameworks are the exclusive intellectual property of AURA — Hair Method. Unauthorised recording, distribution, or sharing of account access is strictly prohibited and will result in immediate termination of access without refund.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white border-b border-zinc-800 pb-2">
              3. PRIVACY & DATA COLLECTION
            </h2>
            <p>
              We collect minimal personal information necessary to deliver our educational platform services: full name, email address, submitted practical assignments (photos/videos), and course progress data. Your data is stored securely and will never be sold or shared with unauthorized third parties.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white border-b border-zinc-800 pb-2">
              4. APPOINTMENTS & BOOKINGS
            </h2>
            <p>
              When booking an in-person session, seminar, or evaluation appointment through our platform, you agree to provide accurate contact details. Confirmation and scheduling specifics will be communicated via email or telephone.
            </p>
          </section>

          <div className="pt-6 border-t border-zinc-900 text-center">
            <Link
              to="/login"
              className="inline-block rounded-full border border-zinc-700 px-6 py-2.5 text-xs uppercase tracking-[0.3em] text-zinc-200 transition-colors hover:border-white hover:text-white"
            >
              ← Back to Sign In
            </Link>
          </div>
        </motion.div>

      </main>
      <Footer />
    </div>
  );
}