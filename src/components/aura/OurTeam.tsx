// src/components/aura/OurTeam.tsx
import { useState, useRef } from "react";
import { motion, PanInfo } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import founderImg from "@/assets/founder.jpg";
import cofounderImg from "@/assets/cofounder.jpg";
import developerImg from "@/assets/developer.jpg";

interface TeamMemberPreview {
  id: string;
  name: string;
  role: string;
  image: string;
  excerpt: string;
  motto: string;
}

const teamMembers: TeamMemberPreview[] = [
  {
    id: "01",
    name: "ΘΕΟΠΙΣΤΟΣ",
    role: "FOUNDER • CREATIVE DIRECTOR",
    image: founderImg,
    excerpt:
      "Δημιουργική δύναμη και εμπνευστής της AURA. Εστιάζει στην ουσιαστική κατανόηση, την παρατήρηση και τη διαμόρφωση μιας νέας γενιάς επαγγελματιών.",
    motto: "OBSERVE. ANALYZE. EVOLVE.",
  },
  {
    id: "02",
    name: "ΑΓΓΕΛΟΣ",
    role: "PARTNER • HEAD EDUCATOR",
    image: cofounderImg,
    excerpt:
      "Καθοδηγεί την εξέλιξη της εκπαιδευτικής κουλτούρας. Πιστεύει στη συνεχή βελτίωση και στη βαθιά μεταφορά τεχνικής γνώσης.",
    motto: "KNOWLEDGE CREATES EXCELLENCE.",
  },
  {
    id: "03",
    name: "ΜΑΝΟΣ",
    role: "PROGRAMMER • DIGITAL CREATOR",
    image: developerImg,
    excerpt:
      "Η κινητήριος δύναμη πίσω από την Online Academy, μετατρέποντας το όραμα και το εκπαιδευτικό σύστημα σε μια σύγχρονη ψηφιακή εμπειρία.",
    motto: "BUILDING THE DIGITAL FUTURE.",
  },
];

export default function OurTeam() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % teamMembers.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + teamMembers.length) % teamMembers.length);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      handleNext();
    } else if (info.offset.x > swipeThreshold) {
      handlePrev();
    }
  };

  return (
    <section className="relative py-24 md:py-32 bg-[#050505] overflow-hidden text-zinc-100 select-none border-t border-zinc-900">
      {/* Background Ambient Chrome Backlight */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-full -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-200/10 via-black/80 to-black blur-[130px]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950 px-4 py-1 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span className="inline-block scale-x-110 origin-center text-[10px] font-extralight uppercase tracking-[0.4em] text-zinc-400">
              MEET THE CREATORS
            </span>
          </div>

          <h2 className="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]">
              Our Team
            </span>
          </h2>
        </div>

        {/* 3D Perspective Slider Container */}
        <div
          ref={containerRef}
          className="relative flex items-center justify-center min-h-[480px] sm:min-h-[520px] perspective-1000"
        >
          {/* Desktop Left Arrow */}
          <button
            onClick={handlePrev}
            aria-label="Previous Team Member"
            className="hidden md:flex absolute left-2 lg:left-12 z-30 items-center justify-center w-12 h-12 rounded-full border border-white/30 bg-black/60 text-white backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.3)] hover:bg-white hover:text-black hover:border-white hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all duration-300 cursor-pointer group"
          >
            <svg
              className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Cards Stack with Touch Dragging for Mobile */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="relative w-full max-w-sm sm:max-w-md h-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-pan-y"
          >
            {teamMembers.map((member, index) => {
              // Calculate index offset relative to current active index (-1, 0, 1)
              let offset = index - currentIndex;
              if (offset < -1) offset += teamMembers.length;
              if (offset > 1) offset -= teamMembers.length;

              const isActive = offset === 0;

              return (
                <motion.div
                  key={member.id}
                  initial={false}
                  animate={{
                    scale: isActive ? 1 : 0.85,
                    rotateY: offset === -1 ? 22 : offset === 1 ? -22 : 0,
                    x: offset === -1 ? "-60%" : offset === 1 ? "60%" : "0%",
                    z: isActive ? 0 : -140,
                    opacity: isActive ? 1 : 0.45,
                    filter: isActive ? "blur(0px)" : "blur(2px)",
                  }}
                  transition={{
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  onClick={() => setCurrentIndex(index)}
                  style={{
                    transformStyle: "preserve-3d",
                    zIndex: isActive ? 20 : 10 - Math.abs(offset),
                  }}
                  className={`absolute w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 backdrop-blur-xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-colors duration-300 ${
                    isActive
                      ? "border-zinc-500/80 shadow-[0_0_35px_rgba(255,255,255,0.08)]"
                      : "pointer-events-auto hover:border-zinc-700"
                  }`}
                >
                  {/* Chrome Specular Top Highlight */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-200/60 to-transparent" />

                  {/* ID Badge */}
                  <div className="absolute top-4 right-5 font-mono text-xs text-zinc-600 tracking-widest">
                    // {member.id}
                  </div>

                  {/* Profile Header */}
                  <div className="flex items-center gap-4 sm:gap-5">
                    {/* Metallic Photo Frame */}
                    <div className="relative shrink-0 w-20 h-24 sm:w-24 sm:h-28 rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-900 shadow-md">
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-full object-cover grayscale contrast-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    </div>

                    {/* Member Title */}
                    <div className="flex-1 text-left">
                      <span className="inline-block text-[9px] sm:text-[10px] font-extralight uppercase tracking-[0.25em] text-zinc-400">
                        {member.role}
                      </span>
                      <h3 className="mt-0.5 text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
                        <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                          {member.name}
                        </span>
                      </h3>
                    </div>
                  </div>

                  {/* Excerpt Bio */}
                  <p className="mt-5 text-xs sm:text-sm font-extralight text-zinc-300 leading-relaxed text-left">
                    {member.excerpt}
                  </p>

                  {/* Single Motto Box */}
                  <div className="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-center">
                    <p className="text-[10px] sm:text-xs font-extralight uppercase tracking-[0.25em] text-zinc-300">
                      {member.motto}
                    </p>
                  </div>

                  {/* VIEW MORE Chrome Button */}
                  <div className="mt-6 pt-4 border-t border-zinc-900/80 flex justify-center">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ to: "/about" });
                      }}
                      className="group relative overflow-hidden rounded-full py-2.5 px-6 backdrop-blur-md bg-white/10 hover:bg-white/20 text-white font-aura text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] border border-white/40 hover:border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(255,255,255,0.35)] transition-all duration-300 cursor-pointer"
                    >
                      {/* Specular Shimmer Beam */}
                      <motion.span
                        className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] pointer-events-none"
                        animate={{ x: ["-150%", "300%"] }}
                        transition={{
                          duration: 2.8,
                          repeat: Infinity,
                          repeatDelay: 1.2,
                          ease: "easeInOut",
                        }}
                      />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        VIEW MORE
                        <svg
                          className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                          />
                        </svg>
                      </span>
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Desktop Right Arrow */}
          <button
            onClick={handleNext}
            aria-label="Next Team Member"
            className="hidden md:flex absolute right-2 lg:right-12 z-30 items-center justify-center w-12 h-12 rounded-full border border-white/30 bg-black/60 text-white backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.3)] hover:bg-white hover:text-black hover:border-white hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all duration-300 cursor-pointer group"
          >
            <svg
              className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Mobile Swipe Hint & Page Bullets */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 md:hidden">
            ← Swipe to explore →
          </p>

          <div className="flex items-center gap-2">
            {teamMembers.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === idx
                    ? "w-8 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                    : "w-2 bg-zinc-800 hover:bg-zinc-600"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}