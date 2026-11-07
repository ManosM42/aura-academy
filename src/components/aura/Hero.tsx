// src/components/aura/Hero.tsx
import { useCallback, useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion, type Variants } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import emblem from "@/assets/aura-emblem.webp"; // optimized copy of the real aura.jpg artwork
import plate from "@/assets/aura-hero-bg.webp"; // smoke, rocks and floor from the reference

export default function Hero() {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Light parallax: emblem and copy drift at different speeds while scrolling away.
  const emblemY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 90]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 36]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const copy: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.18, delayChildren: 0.85 } },
  };
  const rise: Variants = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] } },
  };

  const scrollDown = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    window.scrollTo({ top: el.offsetTop + el.offsetHeight, behavior: reduced ? "auto" : "smooth" });
  }, [reduced]);

  return (
    <section id="top" ref={ref} className="ah-hero" aria-label="AURA Academy">
      <style>{css}</style>
      <h1 className="ah-sr">AURA Hair Method – The Ultimate Barber Education Academy</h1>

      {/* ---------- cinematic environment ---------- */}
      <motion.div aria-hidden className="ah-bg" style={{ opacity: fade }}>
        <div className="ah-drift">
          <img className="ah-plate" src={plate} alt="" draggable={false} decoding="async" />
        </div>
        <span className="ah-glow" />
        <span className="ah-fan" />
        <span className="ah-beam" />
        <span className="ah-floor" />
        <span className="ah-vignette" />
      </motion.div>

      <div className="ah-stack">
        {/* ---------- chrome emblem + wordmark (real brand asset) ---------- */}
        <motion.div
          className="ah-emblem"
          style={{ y: emblemY }}
          initial={reduced ? false : { opacity: 0, scale: 1.07 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            className="ah-emblem-img"
            src={emblem}
            alt="AURA Hair Method emblem"
            width={1500}
            height={2179}
            draggable={false}
            decoding="async"
            // @ts-expect-error fetchpriority is valid HTML, older React typings do not know it
            fetchPriority="high"
          />
          <span className="ah-flare" aria-hidden />
        </motion.div>

        {/* ---------- copy + CTA ---------- */}
        <motion.div
          className="ah-copy"
          style={{ y: copyY }}
          variants={copy}
          initial={reduced ? false : "hidden"}
          animate="show"
        >
          <p className="ah-tagline">OBSERVE. ANALYZE. EXECUTE.</p>

          <motion.div className="ah-sub-row" variants={rise}>
            <span className="ah-rule ah-rule-l" aria-hidden />
            <p className="ah-sub">The Ultimate Barber Education Academy</p>
            <span className="ah-rule ah-rule-r" aria-hidden />
          </motion.div>

          <motion.div className="ah-cta-wrap" variants={rise}>
            <button type="button" className="ah-cta" onClick={() => navigate({ to: "/pricing" })}>
              <span className="ah-cta-sheen" aria-hidden />
              <span className="ah-cta-label">START LEARNING</span>
              <ChevronRight className="ah-cta-arrow" strokeWidth={1.4} aria-hidden />
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* ---------- scroll indicator ---------- */}
      <button type="button" className="ah-scroll" onClick={scrollDown} aria-label="Scroll down">
        <span className="ah-mouse" aria-hidden>
          <i />
        </span>
        <span className="ah-scroll-line" aria-hidden />
      </button>

      <div className="ah-baseline" aria-hidden />
    </section>
  );
}

/* ------------------------------------------------------------------ */

const css = `
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap");

.ah-hero{
  --ah-eh: clamp(300px, min(66.5svh, 122vw), 840px);   /* emblem height */
  --ah-serif: "Cormorant Garamond", "Cormorant", "Times New Roman", Georgia, serif;
  position:relative; display:flex; flex-direction:column; align-items:center;
  width:100%; min-height:100vh; min-height:100svh; overflow:hidden;
  background:#000; color:#fff;
}
.ah-sr{ position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }

/* ================= environment ================= */
.ah-bg{ position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none; background:#000; }

/* smoke / rocks / floor plate: slow drift */
.ah-drift{ position:absolute; inset:0; animation: ah-drift 46s ease-in-out infinite alternate; will-change:transform; }
.ah-plate{
  position:absolute; left:50%; bottom:0; width:max(175vw, 100%); max-width:none; height:auto; transform:translateX(-50%); filter:brightness(1.2);
  -webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 30%); mask-image:linear-gradient(180deg,transparent 0%,#000 30%);
  user-select:none;
}
@keyframes ah-drift{
  from{ transform:scale(1.05) translate3d(-1.4%,0,0); }
  to  { transform:scale(1.05) translate3d(1.4%,0,0); }
}
@media (min-width:768px){
  .ah-plate{ left:0; width:100%; height:100%; transform:none; object-fit:cover; object-position:50% 78%; -webkit-mask-image:none; mask-image:none; filter:none; }
}

/* soft halo behind the emblem */
.ah-glow{
  position:absolute; left:50%; top:3%; width:min(86vw,820px); height:70%; transform:translateX(-50%);
  background:radial-gradient(ellipse 46% 44% at 50% 38%, rgba(255,255,255,.17), rgba(255,255,255,.06) 42%, transparent 72%);
  animation: ah-breathe 9s ease-in-out infinite;
}

/* volumetric rays falling from above */
.ah-fan{
  position:absolute; left:50%; top:-3%; width:170vmax; height:112%; transform:translateX(-50%); transform-origin:50% 0;
  background:conic-gradient(from 0deg at 50% 0%,
    transparent 0deg 153deg,
    rgba(255,255,255,.05) 156deg, transparent 159deg,
    rgba(255,255,255,.10) 162deg, transparent 165deg,
    rgba(255,255,255,.07) 167.5deg, transparent 170deg,
    rgba(255,255,255,.20) 173deg, transparent 176.5deg,
    rgba(255,255,255,.34) 179deg, rgba(255,255,255,.34) 181deg, transparent 183.5deg,
    rgba(255,255,255,.20) 187deg, transparent 190deg,
    rgba(255,255,255,.07) 192.5deg, transparent 195deg,
    rgba(255,255,255,.10) 198deg, transparent 201deg,
    rgba(255,255,255,.05) 204deg, transparent 207deg 360deg);
  -webkit-mask-image:radial-gradient(ellipse 56% 72% at 50% 0%, #000 0%, rgba(0,0,0,.55) 38%, transparent 76%);
          mask-image:radial-gradient(ellipse 56% 72% at 50% 0%, #000 0%, rgba(0,0,0,.55) 38%, transparent 76%);
  filter:blur(1.2px); mix-blend-mode:screen;
  animation: ah-sway 16s ease-in-out infinite alternate;
}
/* bright central shaft (blur on the parent, shape on the child => soft edges) */
.ah-beam{
  position:absolute; left:50%; top:0; width:min(24vw,340px); height:64%; transform:translateX(-50%);
  filter:blur(12px); mix-blend-mode:screen; animation: ah-breathe 7s ease-in-out infinite;
}
.ah-beam::before{
  content:""; position:absolute; inset:0; clip-path:polygon(34% 0, 66% 0, 100% 100%, 0 100%);
  background:linear-gradient(180deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.2) 30%, rgba(255,255,255,.05) 72%, transparent 100%);
}
.ah-beam::after{
  content:""; position:absolute; left:41%; right:41%; top:0; height:46%;
  background:linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.25) 60%, transparent);
}
@keyframes ah-sway{ from{ transform:translateX(-50%) rotate(-.7deg); opacity:.88; } to{ transform:translateX(-50%) rotate(.7deg); opacity:1; } }
@keyframes ah-breathe{ 0%,100%{ opacity:.78; } 50%{ opacity:1; } }

/* reflective floor: horizon glow, warm pool under the button, faint streaks */
.ah-floor{
  position:absolute; left:0; right:0; bottom:0; height:30%;
  background:
    radial-gradient(ellipse 22% 14% at 50% 30%, rgba(255,232,210,.20), transparent 70%),
    radial-gradient(ellipse 34% 6% at 50% 3%, rgba(255,255,255,.07), transparent 80%),
    repeating-linear-gradient(90deg, transparent 0 46px, rgba(255,255,255,.012) 46px 47px),
    linear-gradient(180deg, transparent 0%, rgba(255,255,255,.028) 6%, rgba(0,0,0,0) 40%, rgba(0,0,0,.35) 100%);
}
.ah-vignette{
  position:absolute; inset:0;
  background:
    linear-gradient(180deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,0) 16%),
    radial-gradient(ellipse 78% 74% at 50% 46%, transparent 52%, rgba(0,0,0,.72) 100%);
}

/* ================= foreground ================= */
.ah-stack{
  position:relative; width:100%; display:flex; flex-direction:column; align-items:center;
  margin-block:auto; padding:clamp(40px,4.2svh,68px) 20px clamp(92px,11svh,128px);
}

/* the real emblem artwork: black drops out through "screen" so it sits inside the light */
.ah-emblem{ position:relative; z-index:1; height:var(--ah-eh); aspect-ratio:1500 / 2179; mix-blend-mode:screen; will-change:transform; }
.ah-emblem-img{ display:block; width:100%; height:100%; object-fit:contain; user-select:none; pointer-events:none; }

.ah-copy{ position:relative; z-index:2; width:100%; display:flex; flex-direction:column; align-items:center; margin-top:calc(var(--ah-eh) * -.095); }

.ah-tagline{
  font-family:var(--ah-serif); font-weight:300; text-transform:uppercase; white-space:nowrap; text-align:center;
  font-size:clamp(.64rem, 3vw, 1.6rem); letter-spacing:.36em; padding-left:.36em; color:rgba(238,238,240,.9);
  text-shadow:0 0 22px rgba(255,255,255,.18);
}
@media (min-width:768px){ .ah-tagline{ font-size:clamp(.82rem, 1.5vw, 1.6rem); letter-spacing:.6em; padding-left:.6em; } }
.ah-tagline{ animation: ah-track 1.7s cubic-bezier(.22,1,.36,1) .85s both; }
@keyframes ah-track{ from{ opacity:0; letter-spacing:1.1em; } }

.ah-sub-row{ display:flex; align-items:center; justify-content:center; gap:clamp(14px,1.8vw,30px); width:min(1100px,86vw); margin-top:clamp(12px,2.8svh,30px); }
.ah-rule{ display:none; flex:1; height:1px; }
.ah-rule-l{ background:linear-gradient(90deg,transparent,rgba(255,255,255,.4)); }
.ah-rule-r{ background:linear-gradient(270deg,transparent,rgba(255,255,255,.4)); }
@media (min-width:640px){ .ah-rule{ display:block; } }
.ah-sub{
  font-family:var(--ah-serif); font-style:italic; font-weight:300; text-align:center;
  font-size:clamp(.72rem, 3.1vw, 1.2rem); letter-spacing:.15em; color:rgba(200,200,205,.82); white-space:nowrap;
}
@media (min-width:768px){ .ah-sub{ font-size:clamp(.82rem, 1.12vw, 1.2rem); letter-spacing:.22em; } }

/* glint on the left horn, like the reference */
.ah-flare{ position:absolute; left:19.5%; top:21.8%; width:15%; height:2px; transform:translate(-50%,-50%); pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent); filter:blur(.6px); animation: ah-twinkle 6s ease-in-out infinite; }
.ah-flare::after{ content:""; position:absolute; left:50%; top:50%; width:26px; height:26px; transform:translate(-50%,-50%); border-radius:50%;
  background:radial-gradient(circle, rgba(255,255,255,.95), rgba(255,255,255,0) 68%); }
@keyframes ah-twinkle{ 0%,100%{ opacity:.55; } 50%{ opacity:1; } }

/* ---------- START LEARNING: polished black metal ---------- */
.ah-cta-wrap{ position:relative; margin-top:clamp(22px,4.6svh,46px); }
.ah-cta-wrap::after{                      /* warm reflection pooling on the floor */
  content:""; position:absolute; left:6%; right:6%; top:92%; height:38px; pointer-events:none;
  background:radial-gradient(ellipse at 50% 0%, rgba(255,226,198,.34), transparent 70%); filter:blur(9px);
}
.ah-cta{
  position:relative; z-index:1; display:inline-flex; align-items:center; justify-content:center; gap:clamp(14px,1.8vw,26px);
  height:clamp(54px,7svh,70px); padding:0 clamp(30px,3.2vw,54px) 0 clamp(36px,3.8vw,62px); border-radius:9999px; cursor:pointer; overflow:hidden;
  font-family:var(--ah-serif); font-weight:500; text-transform:uppercase; color:#fff;
  font-size:clamp(.86rem, 1.02vw, 1.08rem); letter-spacing:.27em;
  border:1.5px solid transparent;
  background:
    linear-gradient(180deg, rgba(255,255,255,.17) 0%, rgba(255,255,255,.04) 44%, rgba(255,255,255,0) 49%) padding-box,
    radial-gradient(ellipse 60% 120% at 50% 118%, rgba(255,255,255,.09), transparent 70%) padding-box,
    linear-gradient(180deg,#17171a 0%,#060607 52%,#0e0e10 100%) padding-box,
    linear-gradient(180deg,#fbfbfd 0%,#8e939d 20%,#34363c 50%,#9a9fa9 80%,#efe6dd 100%) border-box;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.34),
    inset 0 -12px 20px rgba(0,0,0,.7),
    0 0 0 1px rgba(0,0,0,.65),
    0 18px 34px -10px rgba(0,0,0,.95),
    0 0 40px -8px rgba(255,238,222,.30);
  transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .3s, filter .3s;
}
.ah-cta::before{                          /* bright flare on the top edge */
  content:""; position:absolute; left:50%; top:-1px; width:42%; height:3px; transform:translateX(-50%); border-radius:9999px; pointer-events:none;
  background:radial-gradient(ellipse at 50% 50%, rgba(255,248,240,1), rgba(255,236,220,.0) 72%); filter:blur(1.4px);
}
.ah-cta::after{                           /* dimmer flare on the bottom edge */
  content:""; position:absolute; left:50%; bottom:-1px; width:34%; height:3px; transform:translateX(-50%); border-radius:9999px; pointer-events:none;
  background:radial-gradient(ellipse at 50% 50%, rgba(255,240,226,.7), transparent 72%); filter:blur(1.6px);
}
.ah-cta-label{ position:relative; text-shadow:0 0 14px rgba(255,255,255,.28); }
.ah-cta-arrow{ position:relative; width:1.4em; height:1.4em; flex-shrink:0; transition:transform .3s cubic-bezier(.22,1,.36,1); }
.ah-cta-sheen{
  position:absolute; top:0; bottom:0; left:0; width:38%; transform:translateX(-160%) skewX(-24deg); pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);
}
@media (hover:hover){
  .ah-cta:hover{
    transform:translateY(-2px); filter:brightness(1.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.5), inset 0 -12px 20px rgba(0,0,0,.7), 0 0 0 1px rgba(0,0,0,.65),
                0 22px 38px -10px rgba(0,0,0,.95), 0 0 56px -6px rgba(255,238,222,.5);
  }
  .ah-cta:hover .ah-cta-arrow{ transform:translateX(5px); }
  .ah-cta:hover .ah-cta-sheen{ animation: ah-sheen 1.1s ease-out 1; }
}
.ah-cta:active{
  transform:translateY(1px) scale(.985); filter:brightness(.96);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), inset 0 -6px 12px rgba(0,0,0,.8), 0 0 0 1px rgba(0,0,0,.65),
              0 8px 16px -8px rgba(0,0,0,.95), 0 0 28px -8px rgba(255,238,222,.3);
}
@keyframes ah-sheen{ from{ transform:translateX(-160%) skewX(-24deg); } to{ transform:translateX(420%) skewX(-24deg); } }
.ah-cta:focus-visible,.ah-scroll:focus-visible{ outline:2px solid rgba(255,255,255,.85); outline-offset:4px; }

/* ---------- scroll indicator ---------- */
.ah-scroll{
  position:absolute; left:50%; bottom:clamp(10px,2.6svh,28px); z-index:3; transform:translateX(-50%);
  display:flex; flex-direction:column; align-items:center; gap:7px; padding:6px 10px; cursor:pointer; opacity:.88;
  transition:opacity .25s;
}
.ah-scroll:hover{ opacity:1; }
.ah-mouse{ position:relative; display:block; width:22px; height:36px; border-radius:12px; border:1.5px solid rgba(255,255,255,.72); box-shadow:0 0 12px rgba(255,255,255,.18); }
.ah-mouse i{ position:absolute; left:50%; top:7px; width:2.5px; height:6px; margin-left:-1.25px; border-radius:2px; background:#fff; animation: ah-wheel 2.1s ease-in-out infinite; }
.ah-scroll-line{ display:block; width:1px; height:clamp(14px,3svh,28px); background:linear-gradient(180deg,rgba(255,255,255,.8),transparent); transform-origin:50% 0; animation: ah-line 2.1s ease-in-out infinite; }
@keyframes ah-wheel{ 0%{ transform:translateY(0); opacity:0; } 25%{ opacity:1; } 70%{ transform:translateY(11px); opacity:0; } 100%{ opacity:0; } }
@keyframes ah-line{ 0%,100%{ transform:scaleY(.55); opacity:.45; } 50%{ transform:scaleY(1); opacity:1; } }

.ah-baseline{ position:absolute; left:50%; bottom:0; z-index:3; width:70%; max-width:760px; height:1px; transform:translateX(-50%);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent); }

@media (max-width:420px){ .ah-stack{ padding-left:14px; padding-right:14px; } }

@media (prefers-reduced-motion: reduce){
  .ah-hero *, .ah-hero *::before, .ah-hero *::after{ animation:none !important; transition-duration:.001ms !important; }
}
`;