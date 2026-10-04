// src/components/aura/AuraIntro.tsx
//
// First-visit cinematic intro for the AURA platform.
//   1. Letterbox opens on black, the logo glitches into existence
//   2. ΛURΛ / HAIR METHOD (same lettering as the navbar) glitches in
//   3. A single chrome START button appears
//   4. START (click / Enter / Space) -> welcome.MOV plays full screen
//   5. The video dips to black, then the black fades out onto the page
//
// Only plays once per browser (localStorage). Clear AURA_INTRO_KEY to replay.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion } from "motion/react";
import logo from "@/assets/logo.jpg";
import welcomeVideo from "@/assets/welcome.MOV";

export const AURA_INTRO_KEY = "aura:intro-seen";

type Phase = "menu" | "playing" | "outro" | "reveal" | "done";

const EASE = [0.22, 1, 0.36, 1] as const;
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface AuraIntroProps {
  onComplete?: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Glitching text, same lettering as the navbar                              */
/* -------------------------------------------------------------------------- */

function GlitchText({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  return (
    <span className="relative inline-block notranslate">
      <span
        className={`ag-base relative block ${className}`}
        style={chromeText}
      >
        {text}
      </span>
      <span
        aria-hidden
        className={`ag-ch ag-t-r absolute inset-0 block ${className}`}
      >
        {text}
      </span>
      <span
        aria-hidden
        className={`ag-ch ag-t-c absolute inset-0 block ${className}`}
      >
        {text}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function AuraIntro({ onComplete }: AuraIntroProps) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [stage, setStage] = useState(0); // 0 black, 1 logo, 2 title, 3 button
  const [burst, setBurst] = useState(true); // heavy glitch while things appear

  const videoRef = useRef<HTMLVideoElement>(null);
  const finishing = useRef(false);
  const videoFailed = useRef(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Returning visitor: skip before the first paint (no flash, SSR-safe).
  useIsoLayoutEffect(() => {
    try {
      if (localStorage.getItem(AURA_INTRO_KEY)) {
        setPhase("done");
        onCompleteRef.current?.();
      }
    } catch {
      /* storage blocked: just play the intro */
    }
  }, []);

  // Lock page scroll while the intro is up.
  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase === "done"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Boot sequence.
  useEffect(() => {
    if (phase !== "menu") return;
    const t = [
      window.setTimeout(() => setStage(1), 500),
      window.setTimeout(() => setStage(2), 1600),
      window.setTimeout(() => setStage(3), 2700),
      window.setTimeout(() => setBurst(false), 3300),
    ];
    return () => t.forEach(window.clearTimeout);
  }, [phase]);

  // Video -> black -> page.
  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    setPhase("outro"); // video dips to black (0.9s)
    window.setTimeout(() => setPhase("reveal"), 900); // black fades away (1.2s)
    window.setTimeout(() => {
      setPhase("done");
      onCompleteRef.current?.();
    }, 2100);
  }, []);

  const start = useCallback(() => {
    if (phase !== "menu" || stage < 3) return;
    try {
      localStorage.setItem(AURA_INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    setBurst(true);
    setPhase("playing");

    const v = videoRef.current;
    if (!v || videoFailed.current) return finish();
    v.currentTime = 0;
    v.play().catch(finish);
  }, [phase, stage, finish]);

  // Keyboard: Enter/Space starts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "menu" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, start]);

  if (phase === "done") return null;

  const inMenu = phase === "menu";
  const burstCls = burst ? "ag-burst" : "";

  return (
    <motion.div
      role="dialog"
      aria-label="Welcome to AURA"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "reveal" ? 0 : 1 }}
      transition={{ duration: 1.2, ease: EASE }}
      style={{ pointerEvents: phase === "reveal" ? "none" : "auto" }}
      className="fixed inset-0 z-[100] overflow-hidden bg-black"
    >
      <style>{css}</style>

      {/* ------------------------------ MENU ------------------------------ */}
      <motion.div
        aria-hidden={!inMenu}
        animate={{
          opacity: inMenu ? 1 : 0,
          scale: inMenu ? 1 : 1.05,
          filter: inMenu ? "blur(0px)" : "blur(10px)",
        }}
        transition={{ duration: 0.7, ease: EASE }}
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{ pointerEvents: inMenu ? "auto" : "none" }}
      >
        {/* atmosphere */}
        <div className="ag-spot pointer-events-none absolute inset-0" />
        <div className="ag-streak pointer-events-none absolute left-0 right-0 top-[40%] h-px" />

        {/* logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={
            stage >= 1
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.9 }
          }
          transition={{ duration: 0.9, ease: EASE }}
          className={`ag relative ${burstCls}`}
        >
          <div className="relative h-32 w-32 sm:h-40 sm:w-40 md:h-48 md:w-48">
            <img
              src={logo}
              alt="AURA"
              draggable={false}
              className="ag-base h-full w-full select-none rounded-full border border-white/20 object-cover shadow-[0_0_70px_rgba(255,255,255,0.10)]"
            />
            <img
              src={logo}
              alt=""
              aria-hidden
              draggable={false}
              className="ag-ch ag-r h-full w-full rounded-full object-cover"
            />
            <img
              src={logo}
              alt=""
              aria-hidden
              draggable={false}
              className="ag-ch ag-c h-full w-full rounded-full object-cover"
            />
          </div>
        </motion.div>

        {/* wordmark */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: stage >= 2 ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          className={`ag mt-10 flex flex-col items-center sm:mt-12 ${burstCls}`}
        >
          <div className="origin-center scale-x-125">
            <GlitchText
              text="ΛURΛ"
              className="pl-[0.45em] text-5xl font-extralight leading-none tracking-[0.45em] sm:text-7xl md:text-8xl"
            />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 2 ? 1 : 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-5 origin-center scale-x-110"
          >
            <span className="notranslate inline-block pl-[0.35em] text-[10px] font-extralight uppercase leading-none tracking-[0.35em] text-neutral-400 sm:text-xs">
              HAIR METHOD
            </span>
          </motion.div>
        </motion.div>

        {/* START */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={stage >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="mt-14 flex flex-col items-center sm:mt-16"
          style={{ pointerEvents: stage >= 3 ? "auto" : "none" }}
        >
          <motion.button
            type="button"
            onClick={start}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            tabIndex={stage >= 3 ? 0 : -1}
            className="ag-start group relative min-w-[220px] cursor-pointer overflow-hidden rounded-full px-14 py-3.5 font-aura text-sm font-semibold tracking-[0.4em] text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-base"
            style={chromeButton}
          >
            <span className="ag-sheen pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
            <span
              className="relative z-10 block pl-[0.4em]"
              style={{ textShadow: "0 1px 0 rgba(255,255,255,0.55)" }}
            >
              START
            </span>
          </motion.button>

          <span className="ag-blink mt-6 hidden text-[10px] font-extralight tracking-[0.3em] text-neutral-500 sm:block">
            PRESS ENTER
          </span>
        </motion.div>
      </motion.div>

      {/* ------------------------------ VIDEO ----------------------------- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "playing" ? 1 : 0 }}
        transition={{
          duration: phase === "outro" ? 0.9 : 0.8,
          ease: "easeInOut",
        }}
        className="pointer-events-none absolute inset-0 bg-black"
      >
        <video
          ref={videoRef}
          src={welcomeVideo}
          playsInline
          preload="auto"
          disablePictureInPicture
          // object-contain shows the WHOLE frame (no crop, no zoom).
          // Black bars fill any leftover space.
          className="h-full w-full bg-black object-contain"
          onEnded={finish}
          onError={() => {
            videoFailed.current = true;
            if (phase === "playing") finish();
          }}
        />
      </motion.div>

      {/* ------------------------- FILM LAYERS (always on) ---------------- */}
      <div className="ag-scan pointer-events-none absolute inset-0" />
      <div className="ag-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="ag-grain" />
      </div>

      {/* Letterbox: opens from the centre, retracts when the video starts */}
      <motion.div
        initial={{ height: "50%" }}
        animate={{ height: inMenu ? "8vh" : "0vh" }}
        transition={{ duration: inMenu ? 1.8 : 0.8, ease: EASE, delay: inMenu ? 0.2 : 0 }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-black"
      />
      <motion.div
        initial={{ height: "50%" }}
        animate={{ height: inMenu ? "8vh" : "0vh" }}
        transition={{ duration: inMenu ? 1.8 : 0.8, ease: EASE, delay: inMenu ? 0.2 : 0 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-black"
      />
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const chromeText: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(180deg, #ffffff 0%, #e6e6ea 32%, #8d8d95 50%, #3a3a40 52%, #a9a9b1 72%, #f4f4f6 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
};

const chromeButton: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(180deg, #ffffff 0%, #e6e6ea 30%, #b4b4bc 48%, #8a8a92 52%, #bdbdc4 74%, #f4f4f6 100%)",
  boxShadow: [
    "inset 0 1px 0 rgba(255,255,255,0.95)",
    "inset 0 -1px 0 rgba(0,0,0,0.45)",
    "0 0 0 1px rgba(255,255,255,0.35)",
    "0 12px 32px rgba(0,0,0,0.65)",
    "0 0 46px rgba(255,255,255,0.14)",
  ].join(", "),
};

const grainSvg =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const css = `
/* ---- glitch layers ---- */
.ag-ch{position:absolute;inset:0;mix-blend-mode:screen;pointer-events:none;opacity:0;will-change:transform,clip-path}
.ag-r{filter:grayscale(1) brightness(1.5) contrast(1.1)}
.ag-c{filter:grayscale(1) brightness(.7) contrast(1.4)}
.ag-t-r{color:#ffffff}
.ag-t-c{color:#6f6f78}

/* idle: a short glitch twice every ~5s */
.ag-r,.ag-t-r{animation:ag-idle-a 5.2s step-end infinite}
.ag-c,.ag-t-c{animation:ag-idle-b 5.2s step-end infinite}
.ag-base{animation:ag-idle-base 5.2s step-end infinite}

/* burst: heavy glitching while elements appear / when START is pressed */
.ag-burst .ag-r,.ag-burst .ag-t-r{animation:ag-burst-a .34s step-end infinite}
.ag-burst .ag-c,.ag-burst .ag-t-c{animation:ag-burst-b .29s step-end infinite}
.ag-burst .ag-base{animation:ag-burst-base .34s step-end infinite}

@keyframes ag-idle-a{
  0%{opacity:0}
  41%{opacity:1;clip-path:inset(18% 0 62% 0);transform:translate(-9px,0)}
  42%{opacity:1;clip-path:inset(58% 0 22% 0);transform:translate(7px,0)}
  43%{opacity:1;clip-path:inset(82% 0 6% 0);transform:translate(-5px,0)}
  44%{opacity:0}
  78%{opacity:1;clip-path:inset(34% 0 48% 0);transform:translate(11px,0)}
  79.5%{opacity:0}
}
@keyframes ag-idle-b{
  0%{opacity:0}
  41.5%{opacity:1;clip-path:inset(40% 0 40% 0);transform:translate(9px,0)}
  42.5%{opacity:1;clip-path:inset(8% 0 80% 0);transform:translate(-7px,0)}
  44%{opacity:0}
  78.4%{opacity:1;clip-path:inset(66% 0 18% 0);transform:translate(-10px,0)}
  80%{opacity:0}
}
@keyframes ag-idle-base{
  0%{transform:none;filter:none}
  41%{transform:translate(2px,0);filter:brightness(1.35)}
  43%{transform:translate(-2px,1px)}
  44%{transform:none;filter:none}
  78%{transform:translate(-3px,0);filter:brightness(1.5)}
  79.5%{transform:none;filter:none}
}
@keyframes ag-burst-a{
  0%{opacity:1;clip-path:inset(10% 0 70% 0);transform:translate(-14px,0)}
  14%{opacity:1;clip-path:inset(60% 0 12% 0);transform:translate(12px,0)}
  28%{opacity:0}
  40%{opacity:1;clip-path:inset(35% 0 40% 0);transform:translate(-18px,0)}
  57%{opacity:1;clip-path:inset(78% 0 4% 0);transform:translate(9px,0)}
  71%{opacity:0}
  85%{opacity:1;clip-path:inset(0 0 85% 0);transform:translate(16px,0)}
}
@keyframes ag-burst-b{
  0%{opacity:1;clip-path:inset(48% 0 30% 0);transform:translate(13px,0)}
  18%{opacity:0}
  30%{opacity:1;clip-path:inset(4% 0 82% 0);transform:translate(-15px,0)}
  52%{opacity:1;clip-path:inset(70% 0 10% 0);transform:translate(17px,0)}
  66%{opacity:0}
  80%{opacity:1;clip-path:inset(24% 0 56% 0);transform:translate(-11px,0)}
}
@keyframes ag-burst-base{
  0%{transform:translate(3px,0);filter:brightness(1.6);opacity:1}
  14%{transform:translate(-4px,1px);opacity:.55}
  28%{transform:none;filter:none;opacity:1}
  40%{transform:translate(5px,-1px);filter:brightness(1.8);opacity:.7}
  57%{transform:translate(-2px,0);filter:none;opacity:1}
  71%{transform:none}
  85%{transform:translate(4px,0);filter:brightness(1.4);opacity:.6}
}

/* ---- film atmosphere ---- */
.ag-grain{position:absolute;inset:-60%;opacity:.09;background-image:${grainSvg};animation:ag-grain .8s steps(1) infinite}
@keyframes ag-grain{
  0%{transform:translate(0,0)}
  20%{transform:translate(-4%,3%)}
  40%{transform:translate(3%,-5%)}
  60%{transform:translate(-6%,-2%)}
  80%{transform:translate(5%,4%)}
}
.ag-vignette{background:radial-gradient(ellipse at center,transparent 38%,rgba(0,0,0,.88) 100%)}
.ag-scan{background:repeating-linear-gradient(to bottom,rgba(255,255,255,.025) 0 1px,transparent 1px 3px)}
.ag-spot{background:radial-gradient(circle at 50% 38%,rgba(255,255,255,.10),transparent 55%);animation:ag-breathe 6s ease-in-out infinite}
@keyframes ag-breathe{0%,100%{opacity:.5}50%{opacity:1}}
.ag-streak{background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:ag-streak 7s ease-in-out infinite}
@keyframes ag-streak{0%,100%{opacity:0;transform:scaleX(.5)}50%{opacity:.5;transform:scaleX(1)}}

/* ---- START button ---- */
.ag-sheen{animation:ag-sheen 4.8s ease-in-out infinite}
@keyframes ag-sheen{
  0%,55%{transform:translateX(-160%) skewX(-18deg)}
  100%{transform:translateX(520%) skewX(-18deg)}
}
.ag-start{animation:ag-glow 3.2s ease-in-out infinite}
@keyframes ag-glow{
  0%,100%{filter:drop-shadow(0 0 6px rgba(255,255,255,.10))}
  50%{filter:drop-shadow(0 0 18px rgba(255,255,255,.30))}
}
.ag-blink{animation:ag-blink 1.6s ease-in-out infinite}
@keyframes ag-blink{0%,100%{opacity:.25}50%{opacity:.8}}

@media (prefers-reduced-motion:reduce){
  .ag-ch{display:none}
  .ag-base,.ag-grain,.ag-spot,.ag-streak,.ag-sheen,.ag-start,.ag-blink{animation:none!important}
}
`;