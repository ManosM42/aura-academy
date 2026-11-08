// src/components/aura/portfolio/pfStyles.ts
// Shared chrome-silver styles for the portfolio pages and dialogs (prefix: pf-).
export const pfCss = `
@keyframes pf-spin { to { transform: rotate(360deg); } }
@keyframes pf-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes pf-skel { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes pf-pop { 0% { transform: scale(.6); } 55% { transform: scale(1.28); } 100% { transform: scale(1); } }
@keyframes pf-sweep { 0% { transform: translateX(-130%) skewX(-18deg); } 100% { transform: translateX(260%) skewX(-18deg); } }

/* ---------- backdrop ---------- */
.pf-grid-bg {
  background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size: 58px 58px;
  -webkit-mask-image: radial-gradient(ellipse 75% 45% at 50% 12%, #000 15%, transparent 75%);
          mask-image: radial-gradient(ellipse 75% 45% at 50% 12%, #000 15%, transparent 75%);
  pointer-events: none;
}
.pf-orb { position: absolute; border-radius: 9999px; pointer-events: none; filter: blur(46px);
  background: radial-gradient(circle at 35% 30%, rgba(232,236,242,.15), rgba(160,168,180,.05) 45%, transparent 70%); }

/* ---------- type ---------- */
.pf-title {
  background: linear-gradient(110deg, #6b7280 0%, #f8fafc 22%, #9ca3af 42%, #ffffff 58%, #8b93a1 78%, #f1f5f9 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: pf-shimmer 8s linear infinite;
}
.pf-kicker { display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: .5em; text-transform: uppercase; color: rgba(255,255,255,.55); }

/* ---------- surfaces ---------- */
.pf-panel {
  border-radius: 1.4rem; border: 1px solid rgba(255,255,255,.1);
  background: linear-gradient(180deg, rgba(22,23,29,.94), rgba(9,10,13,.97));
  box-shadow: 0 30px 80px -40px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.05);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
}

/* ---------- controls ---------- */
.pf-btn {
  position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; gap: .55rem;
  padding: .65rem 1.1rem; border-radius: .8rem; font-size: 12px; font-weight: 500; letter-spacing: .04em; color: #e8ecf2; cursor: pointer;
  border: 1px solid rgba(255,255,255,.16); background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.02));
  transition: border-color .25s, box-shadow .25s, transform .15s, opacity .2s;
}
.pf-btn:hover:not(:disabled) { border-color: rgba(255,255,255,.45); box-shadow: 0 0 28px -8px rgba(232,236,242,.6); transform: translateY(-1px); }
.pf-btn:active:not(:disabled) { transform: translateY(1px); }
.pf-btn:disabled { opacity: .4; cursor: not-allowed; }
.pf-btn::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.2), transparent); transform: translateX(-130%) skewX(-18deg); }
.pf-btn:hover:not(:disabled)::after { animation: pf-sweep .9s ease; }
.pf-btn-solid { color: #0b0b0c; border-color: rgba(255,255,255,.65); font-weight: 600;
  background: linear-gradient(180deg, #ffffff, #aab0ba); box-shadow: 0 0 32px -8px rgba(232,236,242,.65), inset 0 1px 0 rgba(255,255,255,.95); }
.pf-btn-solid:hover:not(:disabled) { box-shadow: 0 0 44px -6px rgba(232,236,242,.9), inset 0 1px 0 #fff; }
.pf-btn-danger { color: #fca5a5; border-color: rgba(248,113,113,.4); }
.pf-btn-danger:hover:not(:disabled) { border-color: rgba(248,113,113,.8); box-shadow: 0 0 28px -8px rgba(248,113,113,.6); }

.pf-input {
  width: 100%; padding: .75rem .95rem; border-radius: .8rem; font-size: 14px; color: #f3f4f6; outline: none;
  border: 1px solid rgba(255,255,255,.13); background: rgba(0,0,0,.42); transition: border-color .25s, box-shadow .25s;
}
.pf-input::placeholder { color: rgba(255,255,255,.28); }
.pf-input:focus { border-color: rgba(232,236,242,.55); box-shadow: 0 0 0 1px rgba(232,236,242,.3), 0 0 26px -8px rgba(232,236,242,.45); }

.pf-chip { display: inline-flex; align-items: center; gap: .5rem; padding: .45rem .95rem; border-radius: 9999px; font-size: 12px; color: rgba(255,255,255,.6); cursor: pointer;
  border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.03); transition: color .2s, border-color .2s, background .2s, box-shadow .2s; }
.pf-chip:hover { color: #fff; border-color: rgba(255,255,255,.35); }
.pf-chip-on { color: #fff; border-color: rgba(232,236,242,.6); background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.03)); box-shadow: 0 0 24px -8px rgba(232,236,242,.6); }

.pf-iconbtn { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 9999px; color: #f1f5f9; cursor: pointer;
  border: 1px solid rgba(232,236,242,.28); background: radial-gradient(circle at 30% 20%, rgba(255,255,255,.14), rgba(255,255,255,.02) 70%), #0c0c0d;
  box-shadow: 0 6px 14px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18); transition: transform .15s, border-color .2s, box-shadow .2s; }
.pf-iconbtn:hover:not(:disabled) { border-color: rgba(255,255,255,.6); box-shadow: 0 8px 18px rgba(0,0,0,.6), 0 0 22px -6px rgba(232,236,242,.55); }
.pf-iconbtn:active:not(:disabled) { transform: scale(.94); }
.pf-iconbtn:disabled { opacity: .35; cursor: not-allowed; }

/* ---------- avatar with a rotating chrome ring ---------- */
.pf-ring { position: relative; display: inline-grid; place-items: center; flex-shrink: 0; padding: 3px; border-radius: 9999px; overflow: hidden; isolation: isolate; background: rgba(255,255,255,.12); }
.pf-ring::before { content: ""; position: absolute; inset: -60%; z-index: -1;
  background: conic-gradient(from 0deg, transparent 0 45%, rgba(255,255,255,.1) 55%, rgba(232,236,242,1) 74%, rgba(255,255,255,.1) 90%, transparent 100%); animation: pf-spin 6s linear infinite; }
.pf-ring-inner { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 9999px; overflow: hidden; color: #e5e7eb;
  background: radial-gradient(circle at 30% 25%, #3a3b40, #131416); border: 2px solid #0a0a0b; }
.pf-ring-inner img { width: 100%; height: 100%; object-fit: cover; }

.pf-elite-badge { display: inline-flex; align-items: center; gap: .35rem; padding: .18rem .6rem; border-radius: 9999px; font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: #f1f5f9;
  border: 1px solid rgba(232,236,242,.45); background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.03)); box-shadow: 0 0 20px -6px rgba(232,236,242,.7); }

/* ---------- board cards ---------- */
.pf-bcard { position: relative; display: block; height: 100%; padding: 1px; border-radius: 1.4rem; overflow: hidden; isolation: isolate; background: rgba(255,255,255,.1);
  transition: transform .5s cubic-bezier(.22,1,.36,1), box-shadow .5s, background .5s; }
.pf-bcard:hover { transform: translateY(-6px); background: rgba(255,255,255,.28); box-shadow: 0 34px 90px -34px rgba(220,228,240,.4); }
.pf-bcard-in { position: relative; height: 100%; border-radius: calc(1.4rem - 1px); overflow: hidden; background: linear-gradient(180deg, rgba(22,23,29,.97), rgba(8,9,12,.99)); }
.pf-bcard-cover { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: radial-gradient(circle at 30% 20%, #2a2b30, #0d0d0f); }
.pf-bcard-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform .8s cubic-bezier(.22,1,.36,1); }
.pf-bcard:hover .pf-bcard-cover img { transform: scale(1.07); }
.pf-bcard-cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(8,9,12,.95)); pointer-events: none; }
.pf-bcard-sheen { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .4s;
  background: radial-gradient(320px circle at var(--mx, 50%) var(--my, 0%), rgba(255,255,255,.1), transparent 60%); }
.pf-bcard:hover .pf-bcard-sheen { opacity: 1; }

/* ---------- profile grid ---------- */
.pf-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; }
@media (min-width: 640px) { .pf-tiles { gap: 14px; } }
.pf-tile { position: relative; aspect-ratio: 1; overflow: hidden; cursor: pointer; background: #0d0d0f; border-radius: 2px; }
@media (min-width: 640px) { .pf-tile { border-radius: .9rem; border: 1px solid rgba(255,255,255,.08); } }
.pf-tile img { width: 100%; height: 100%; object-fit: cover; transition: transform .7s cubic-bezier(.22,1,.36,1); }
.pf-tile:hover img { transform: scale(1.06); }
.pf-tile-over { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: .5rem; font-weight: 600; color: #fff; opacity: 0; transition: opacity .3s;
  background: linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55)); }
.pf-tile:hover .pf-tile-over, .pf-tile:focus-visible .pf-tile-over { opacity: 1; }

/* ---------- viewer (Instagram style) ---------- */
.pf-layer { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; padding: 0;
  background: rgba(0,0,0,.82); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
@media (min-width: 900px) { .pf-layer { padding: 1.5rem 4.5rem; } }
.pf-viewer { position: relative; display: flex; flex-direction: column; width: 100%; max-height: 100dvh; overflow-y: auto; background: linear-gradient(180deg, #121214, #070708);
  border: 1px solid rgba(232,236,242,.22); box-shadow: 0 40px 120px rgba(0,0,0,.8), 0 0 80px -30px rgba(232,236,242,.35); }
@media (min-width: 900px) {
  .pf-viewer { flex-direction: row; max-width: 1100px; height: min(88vh, 820px); overflow: hidden; border-radius: 1.2rem; }
}
.pf-viewer-media { position: relative; display: grid; place-items: center; flex: 1 1 auto; min-width: 0; background: #000; user-select: none; }
.pf-viewer-media img { display: block; width: 100%; height: auto; max-height: 70vh; object-fit: contain; }
@media (min-width: 900px) { .pf-viewer-media img { height: 100%; max-height: none; } }
.pf-viewer-side { display: flex; flex-direction: column; flex-shrink: 0; width: 100%; background: linear-gradient(180deg, #131315, #09090a); }
@media (min-width: 900px) { .pf-viewer-side { width: 380px; border-left: 1px solid rgba(255,255,255,.08); } }
.pf-viewer-scroll { flex: 1 1 auto; overflow-y: auto; padding: 1rem 1.1rem; }

.pf-heart-btn { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 9999px; cursor: pointer; color: #e8ecf2; transition: transform .15s, color .2s; }
.pf-heart-btn:hover { transform: scale(1.1); color: #fff; }
.pf-heart-btn svg { transition: fill .2s, filter .2s; }
.pf-heart-on { color: #fff; }
.pf-heart-on svg { fill: url(#pf-chrome-grad); stroke: #fff; filter: drop-shadow(0 0 10px rgba(232,236,242,.85)); animation: pf-pop .4s cubic-bezier(.2,1.4,.4,1); }
.pf-burst { position: absolute; left: 50%; top: 50%; z-index: 3; width: 96px; height: 96px; margin: -48px 0 0 -48px; pointer-events: none; filter: drop-shadow(0 0 24px rgba(232,236,242,.9)); }

.pf-nav { position: absolute; top: 50%; z-index: 4; transform: translateY(-50%); }

.pf-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 6; min-width: 190px; padding: 6px; border-radius: 1rem; background: #0c0c0d; border: 1px solid rgba(232,236,242,.3); box-shadow: 0 18px 40px rgba(0,0,0,.7); }
.pf-menu button { display: flex; align-items: center; gap: .6rem; width: 100%; padding: .65rem .8rem; border-radius: .7rem; font-size: 13px; text-align: left; color: #f3f4f6; cursor: pointer; }
.pf-menu button:hover { background: rgba(255,255,255,.07); }

/* ---------- popups / modals ---------- */
.pf-modal-layer { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: 1.25rem; background: rgba(0,0,0,.7); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.pf-modal { position: relative; width: 100%; max-width: 440px; max-height: 92dvh; overflow-y: auto; padding: 2rem; border-radius: 1.5rem; text-align: center;
  border: 1px solid rgba(232,236,242,.3); background: radial-gradient(80% 60% at 50% 0%, rgba(232,236,242,.13), transparent 70%), linear-gradient(180deg, #151517, #09090a);
  box-shadow: 0 40px 100px rgba(0,0,0,.8), 0 0 70px -24px rgba(232,236,242,.5); }
.pf-modal-wide { max-width: 560px; text-align: left; }
.pf-crown { display: inline-grid; place-items: center; width: 64px; height: 64px; border-radius: 9999px; color: #f1f5f9; border: 1px solid rgba(232,236,242,.45);
  background: radial-gradient(circle at 30% 22%, rgba(255,255,255,.26), rgba(255,255,255,.03) 70%); box-shadow: 0 0 40px -8px rgba(232,236,242,.7), inset 0 1px 0 rgba(255,255,255,.3); }

.pf-drop { display: grid; place-items: center; min-height: 220px; padding: 1.5rem; text-align: center; border-radius: 1.1rem; cursor: pointer; color: rgba(255,255,255,.55);
  border: 1.5px dashed rgba(232,236,242,.3); background: rgba(255,255,255,.02); transition: border-color .25s, background .25s, box-shadow .25s; }
.pf-drop:hover, .pf-drop-on { border-color: rgba(232,236,242,.7); background: rgba(255,255,255,.05); box-shadow: 0 0 40px -14px rgba(232,236,242,.6); }

.pf-step { position: relative; padding: 1.3rem; border-radius: 1.1rem; border: 1px solid rgba(255,255,255,.1); background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.01)); transition: border-color .3s, transform .3s, box-shadow .3s; }
.pf-step:hover { border-color: rgba(232,236,242,.4); transform: translateY(-3px); box-shadow: 0 0 40px -16px rgba(232,236,242,.5); }
.pf-step-n { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9999px; font-size: 13px; font-weight: 700; color: #0b0b0c; background: linear-gradient(180deg, #fff, #a3a9b3); box-shadow: 0 0 18px -4px rgba(232,236,242,.8); }

.pf-toast { display: flex; align-items: flex-start; gap: .6rem; padding: .7rem .9rem; border-radius: .9rem; font-size: 12.5px; color: #fecaca; background: rgba(127,29,29,.25); border: 1px solid rgba(248,113,113,.35); }
.pf-skel { background: linear-gradient(100deg, rgba(255,255,255,.04) 30%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.04) 70%); background-size: 200% 100%; animation: pf-skel 1.5s linear infinite; }

.pf-root a:focus-visible, .pf-root button:focus-visible, .pf-root input:focus-visible, .pf-root textarea:focus-visible, .pf-layer button:focus-visible, .pf-modal-layer button:focus-visible {
  outline: 2px solid rgba(232,236,242,.85); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .pf-title, .pf-ring::before, .pf-skel { animation: none !important; }
  .pf-heart-on svg { animation: none; }
}
`;