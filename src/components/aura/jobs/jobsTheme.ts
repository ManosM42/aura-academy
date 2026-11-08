// src/components/aura/jobs/jobsTheme.ts
// One stylesheet shared by the Find Job page, its locked screen and the admin page.

export const jobsCss = `
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap");

.fj-root{
  /* Height of YOUR root navbar. Change if the page sits too high / low. */
  --fj-nav: clamp(84px, 11vh, 116px);
  --fj-rim: conic-gradient(from 200deg, #ffffff 0deg, #7b828e 55deg, #eef1f6 110deg, #3f444c 170deg, #cfd4dc 230deg, #ffffff 290deg, #6b717c 330deg, #ffffff 360deg);
  --fj-brush: repeating-linear-gradient(90deg, rgba(255,255,255,.026) 0 1px, transparent 1px 3px);
  --fj-serif: "Cormorant Garamond", "Times New Roman", Georgia, serif;

  position:relative; isolation:isolate; min-height:100vh; padding-top:var(--fj-nav); overflow-x:clip;
  color:#f3f4f6; background:#050505;
}
.fj-root::before{
  content:""; position:absolute; inset:0; z-index:-2; pointer-events:none;
  background:
    radial-gradient(90% 46% at 50% -6%, rgba(255,255,255,.15), transparent 62%),
    radial-gradient(60% 40% at 100% 34%, rgba(232,236,242,.05), transparent 70%),
    radial-gradient(60% 40% at 0% 72%, rgba(232,236,242,.04), transparent 70%),
    linear-gradient(180deg,#0a0a0b,#050505 42%,#020202);
}
.fj-root::after{                       /* soft rays from above */
  content:""; position:absolute; left:50%; top:0; z-index:-1; width:min(1400px,170vw); height:560px; transform:translateX(-50%); pointer-events:none;
  background:conic-gradient(from 0deg at 50% -6%, transparent 0 158deg, rgba(255,255,255,.05) 164deg, rgba(255,255,255,.12) 172deg, rgba(255,255,255,.22) 180deg, rgba(255,255,255,.12) 188deg, rgba(255,255,255,.05) 196deg, transparent 202deg 360deg);
  -webkit-mask-image:radial-gradient(ellipse 60% 100% at 50% 0%, #000, transparent 75%); mask-image:radial-gradient(ellipse 60% 100% at 50% 0%, #000, transparent 75%);
  filter:blur(1px);
}
.fj-wrap{ position:relative; width:100%; max-width:1180px; margin:0 auto; padding:0 20px 96px; }

/* ---------- chrome text ---------- */
.fj-chrome{
  background:linear-gradient(115deg,#7d8593 0%,#ffffff 24%,#aeb4bf 44%,#ffffff 58%,#7d8593 80%,#f1f5f9 100%);
  background-size:260% 100%; -webkit-background-clip:text; background-clip:text; color:transparent;
  filter:drop-shadow(0 1px 0 rgba(255,255,255,.22)) drop-shadow(0 8px 18px rgba(0,0,0,.65));
  animation:fj-shimmer 9s linear infinite;
}
@keyframes fj-shimmer{ 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ---------- header ---------- */
.fj-head{ display:flex; flex-direction:column; align-items:center; text-align:center; padding:clamp(18px,4vw,40px) 0 8px; animation:fj-rise .9s cubic-bezier(.22,1,.36,1) both; }
.fj-title{ font-family:var(--fj-serif); font-weight:500; font-size:clamp(2.3rem,7vw,4.4rem); line-height:1.05; letter-spacing:.015em; }
.fj-rule{ position:relative; width:min(360px,70%); height:1px; margin:22px 0 20px; background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent); }
.fj-rule::after{ content:""; position:absolute; left:50%; top:50%; width:8px; height:8px; transform:translate(-50%,-50%) rotate(45deg); background:linear-gradient(135deg,#fff,#7d8593); box-shadow:0 0 12px rgba(255,255,255,.8); }
.fj-sub{ max-width:620px; font-size:clamp(.95rem,2.5vw,1.12rem); line-height:1.75; color:rgba(255,255,255,.62); }
.fj-count{
  margin-top:22px; display:inline-flex; align-items:center; gap:10px; padding:.45rem 1.1rem; border-radius:9999px; font-size:12px; letter-spacing:.22em; text-transform:uppercase; color:rgba(255,255,255,.78);
  border:1.5px solid transparent;
  background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.01)) padding-box, linear-gradient(#09090a,#09090a) padding-box, var(--fj-rim) border-box;
}
.fj-count i{ width:7px; height:7px; border-radius:9999px; background:#6ee7a0; box-shadow:0 0 10px rgba(110,231,160,.9); }
@keyframes fj-rise{ from{ opacity:0; transform:translateY(16px) } to{ opacity:1; transform:none } }

/* ---------- toolbar ---------- */
.fj-toolbar{ display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:12px; margin:34px 0 26px; }
.fj-search{
  position:relative; flex:1 1 280px; max-width:440px; display:flex; align-items:center; gap:10px; height:50px; padding:0 18px; border-radius:9999px; color:rgba(255,255,255,.5);
  border:1.5px solid transparent;
  background:linear-gradient(180deg,#141415,#09090a) padding-box, var(--fj-rim) border-box; box-shadow:inset 0 2px 8px rgba(0,0,0,.65), 0 14px 30px -18px #000;
  transition:box-shadow .25s;
}
.fj-search:focus-within{ box-shadow:inset 0 2px 8px rgba(0,0,0,.65), 0 0 34px -8px rgba(232,236,242,.55); color:#fff; }
.fj-search input{ flex:1; min-width:0; background:transparent; border:0; outline:0; color:#f3f4f6; font-size:15px; }
.fj-search input::placeholder{ color:rgba(255,255,255,.35); }
.fj-select{
  height:50px; padding:0 40px 0 18px; border-radius:9999px; color:#f3f4f6; font-size:14px; cursor:pointer; appearance:none; -webkit-appearance:none; outline:0;
  border:1.5px solid transparent;
  background:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%23cfd4dc' stroke-width='1.5' stroke-linecap='round'/></svg>") no-repeat right 16px center / 12px padding-box,
    linear-gradient(180deg,#141415,#09090a) padding-box, var(--fj-rim) border-box;
}
.fj-select option{ background:#0b0b0c; color:#f3f4f6; }
.fj-pills{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
.fj-pill{
  height:42px; padding:0 18px; border-radius:9999px; font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,.6); cursor:pointer;
  border:1px solid rgba(232,236,242,.22); background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.01)),#0a0a0b; transition:color .2s, border-color .2s, box-shadow .2s;
}
.fj-pill:hover{ color:#fff; border-color:rgba(255,255,255,.5); }
.fj-pill-on{
  color:#101012; border:1.5px solid transparent; font-weight:600;
  background:radial-gradient(circle at 32% 20%,#fff 0%,#e0e4ea 28%,#98a0ab 70%,#5a606a 100%) padding-box, var(--fj-rim) border-box;
  box-shadow:0 8px 16px -6px rgba(0,0,0,.8), 0 0 24px -6px rgba(232,236,242,.6);
}

/* ---------- cards ---------- */
.fj-grid{ display:grid; gap:20px; grid-template-columns:minmax(0,1fr); }
@media (min-width:720px){ .fj-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (min-width:1060px){ .fj-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); } }

.fj-card{
  position:relative; display:flex; flex-direction:column; gap:16px; padding:22px; border-radius:1.5rem; cursor:pointer; overflow:hidden; text-align:left;
  border:1.5px solid transparent;
  background:var(--fj-brush) padding-box, linear-gradient(180deg,rgba(24,24,26,.96),rgba(8,8,9,.98)) padding-box, var(--fj-rim) border-box;
  box-shadow:0 24px 50px -30px #000, inset 0 1px 0 rgba(255,255,255,.12);
  transition:transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s;
  animation:fj-rise .7s cubic-bezier(.22,1,.36,1) both; animation-delay:calc(var(--i,0) * 60ms);
}
.fj-card::before{                      /* glossy top reflection */
  content:""; position:absolute; left:10px; right:10px; top:1px; height:38%; border-radius:1.3rem 1.3rem 70% 70% / 1.3rem 1.3rem 26% 26%;
  background:linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,0)); pointer-events:none;
}
.fj-card::after{                       /* light sweep on hover */
  content:""; position:absolute; top:0; bottom:0; left:0; width:42%; transform:translateX(-170%) skewX(-22deg); pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.13),transparent);
}
@media (hover:hover){
  .fj-card:hover{ transform:translateY(-5px); box-shadow:0 34px 60px -28px #000, 0 0 50px -18px rgba(232,236,242,.5), inset 0 1px 0 rgba(255,255,255,.2); }
  .fj-card:hover::after{ animation:fj-sweep 1.1s ease-out 1; }
}
.fj-card:active{ transform:translateY(-1px) scale(.992); }
@keyframes fj-sweep{ from{ transform:translateX(-170%) skewX(-22deg) } to{ transform:translateX(430%) skewX(-22deg) } }

.fj-new{
  position:absolute; top:16px; right:16px; z-index:1; padding:.2rem .65rem; border-radius:9999px; font-size:10px; font-weight:600; letter-spacing:.2em; color:#101012;
  background:linear-gradient(180deg,#fff,#b9bec7); box-shadow:0 6px 14px rgba(0,0,0,.6), 0 0 18px -4px rgba(255,255,255,.7);
}
.fj-card-top{ position:relative; display:flex; align-items:center; gap:14px; }
.fj-logo{
  position:relative; display:grid; place-items:center; flex-shrink:0; padding:2px; border-radius:9999px; background:var(--fj-rim);
  box-shadow:0 8px 18px rgba(0,0,0,.6), 0 0 22px -8px rgba(232,236,242,.6);
}
.fj-logo-in{ display:grid; place-items:center; width:100%; height:100%; border-radius:9999px; overflow:hidden; background:radial-gradient(circle at 30% 25%,#3a3b40,#121316); }
.fj-logo-in img{ width:100%; height:100%; object-fit:cover; }
.fj-logo-in span{ font-family:var(--fj-serif); font-weight:600; }
.fj-shop{ font-family:var(--fj-serif); font-size:1.4rem; font-weight:600; line-height:1.15; color:#fff; overflow-wrap:anywhere; }
.fj-role{ margin-top:3px; font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.55); }
.fj-meta{ position:relative; display:flex; flex-wrap:wrap; gap:8px 16px; font-size:13px; color:rgba(255,255,255,.62); }
.fj-meta span{ display:inline-flex; align-items:center; gap:7px; }
.fj-meta svg{ color:#cfd4dc; flex-shrink:0; }
.fj-tags{ position:relative; display:flex; flex-wrap:wrap; gap:8px; }
.fj-chip{
  display:inline-flex; align-items:center; gap:6px; padding:.22rem .7rem; border-radius:9999px; font-size:11.5px; letter-spacing:.08em; color:#e8ecf2;
  border:1px solid transparent;
  background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.02)) padding-box, linear-gradient(#0b0b0c,#0b0b0c) padding-box, var(--fj-rim) border-box;
}
.fj-card-foot{ position:relative; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:auto; padding-top:16px;
  border-top:1px solid transparent; border-image:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent) 1; }
.fj-salary{ display:inline-flex; align-items:center; gap:8px; font-family:var(--fj-serif); font-size:1.3rem; font-weight:600; }
.fj-more{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.6); transition:color .2s, gap .25s; }
.fj-card:hover .fj-more{ color:#fff; gap:10px; }

/* ---------- states ---------- */
.fj-state{ display:flex; flex-direction:column; align-items:center; gap:12px; padding:70px 20px; text-align:center; color:rgba(255,255,255,.6); }
.fj-state h3{ font-family:var(--fj-serif); font-size:1.7rem; color:#fff; }
.fj-skel{ height:250px; border-radius:1.5rem; border:1px solid rgba(255,255,255,.08);
  background:linear-gradient(100deg,rgba(255,255,255,.03) 30%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.03) 70%); background-size:200% 100%; animation:fj-skel 1.5s linear infinite; }
@keyframes fj-skel{ 0%{background-position:-200% 0} 100%{background-position:200% 0} }

/* ---------- buttons ---------- */
.fj-btn{
  display:inline-flex; align-items:center; justify-content:center; gap:10px; height:46px; padding:0 22px; border-radius:9999px; cursor:pointer; color:#f3f4f6; font-size:12px; font-weight:500; letter-spacing:.16em; text-transform:uppercase;
  border:1.5px solid transparent;
  background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.02)) padding-box, linear-gradient(#0e0e0f,#0e0e0f) padding-box, var(--fj-rim) border-box;
  box-shadow:0 8px 16px -8px #000, inset 0 1px 0 rgba(255,255,255,.2); transition:transform .15s, filter .2s, box-shadow .2s;
}
.fj-btn:hover:not(:disabled){ filter:brightness(1.18); box-shadow:0 8px 16px -8px #000, 0 0 26px -6px rgba(232,236,242,.55), inset 0 1px 0 rgba(255,255,255,.3); }
.fj-btn:active:not(:disabled){ transform:translateY(1px) scale(.98); }
.fj-btn:disabled{ opacity:.45; cursor:not-allowed; }
.fj-btn-sm{ height:36px; padding:0 14px; font-size:11px; }
.fj-btn-danger{ color:#fecaca; }
.fj-btn-chrome{
  color:#101012; font-weight:600;
  background:radial-gradient(circle at 32% 20%,#ffffff 0%,#e0e4ea 24%,#98a0ab 62%,#565c66 100%) padding-box, var(--fj-rim) border-box;
  box-shadow:0 1px 0 rgba(255,255,255,.95) inset, 0 -6px 12px rgba(0,0,0,.3) inset, 0 12px 22px rgba(0,0,0,.7), 0 0 30px -6px rgba(232,236,242,.7);
}
.fj-btn-chrome:hover:not(:disabled){ filter:brightness(1.08); }
.fj-iconbtn{
  display:inline-grid; place-items:center; width:42px; height:42px; border-radius:9999px; cursor:pointer; color:#f1f5f9; flex-shrink:0;
  border:1.5px solid transparent;
  background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.18),rgba(255,255,255,.02) 70%) padding-box, linear-gradient(#0e0e0f,#0e0e0f) padding-box, var(--fj-rim) border-box;
  box-shadow:0 6px 14px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.2); transition:transform .15s, filter .2s;
}
.fj-iconbtn:hover{ filter:brightness(1.2); } .fj-iconbtn:active{ transform:scale(.94); }

/* ---------- modal ---------- */
.fj-layer{ position:fixed; inset:0; z-index:90; display:flex; align-items:flex-end; justify-content:center; background:rgba(0,0,0,.68); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); animation:fj-fade .25s ease both; }
@media (min-width:720px){ .fj-layer{ align-items:center; padding:24px; } }
@keyframes fj-fade{ from{ opacity:0 } to{ opacity:1 } }
.fj-modal{
  position:relative; width:min(100%,680px); max-height:92dvh; display:flex; flex-direction:column; overflow:hidden; border-radius:1.8rem 1.8rem 0 0;
  border:1.5px solid transparent;
  background:var(--fj-brush) padding-box, linear-gradient(180deg,#171719,#08080a) padding-box, var(--fj-rim) border-box;
  box-shadow:0 -24px 80px rgba(0,0,0,.75), 0 0 80px -30px rgba(232,236,242,.5);
  animation:fj-sheet .38s cubic-bezier(.22,1,.36,1) both;
}
@media (min-width:720px){ .fj-modal{ border-radius:1.8rem; max-height:88dvh; } }
@keyframes fj-sheet{ from{ opacity:0; transform:translateY(44px) scale(.98) } to{ opacity:1; transform:none } }
.fj-modal-head{ position:relative; display:flex; align-items:center; gap:16px; padding:24px 24px 18px; border-bottom:1px solid transparent; border-image:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent) 1; }
.fj-modal-head{ padding-right:68px; }
.fj-modal-head .fj-iconbtn{ position:absolute; top:16px; right:16px; width:38px; height:38px; }
.fj-modal-body{ flex:1 1 auto; min-height:0; overflow-y:auto; padding:22px 24px 8px; overscroll-behavior:contain; }
.fj-modal-body::-webkit-scrollbar{ width:8px; } .fj-modal-body::-webkit-scrollbar-thumb{ background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.08)); border-radius:9999px; }
.fj-h{ margin-bottom:10px; font-size:11px; letter-spacing:.3em; text-transform:uppercase; color:rgba(255,255,255,.5); }
.fj-desc{ white-space:pre-wrap; font-size:15px; line-height:1.75; color:rgba(255,255,255,.8); overflow-wrap:anywhere; }
.fj-facts{ display:grid; gap:10px; margin:22px 0; grid-template-columns:minmax(0,1fr); }
@media (min-width:560px){ .fj-facts{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
.fj-fact{
  display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border-radius:1rem; min-width:0; color:inherit;
  border:1px solid rgba(232,236,242,.16); background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01)); transition:border-color .2s, background .2s;
}
a.fj-fact:hover{ border-color:rgba(255,255,255,.5); background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.02)); }
.fj-fact svg{ margin-top:2px; color:#cfd4dc; flex-shrink:0; }
.fj-fact small{ display:block; font-size:10.5px; letter-spacing:.2em; text-transform:uppercase; color:rgba(255,255,255,.42); }
.fj-fact span{ display:block; font-size:14px; color:#f3f4f6; overflow-wrap:anywhere; }
.fj-modal-foot{ padding:16px 24px calc(20px + env(safe-area-inset-bottom,0px)); border-top:1px solid transparent; border-image:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent) 1; background:linear-gradient(180deg,rgba(255,255,255,.02),transparent); }
.fj-apply{ width:100%; height:58px; font-size:13px; letter-spacing:.24em; }
.fj-foot-note{ margin-top:10px; text-align:center; font-size:11.5px; color:rgba(255,255,255,.4); }

/* ---------- locked screen ---------- */
.fj-lock{ display:flex; flex-direction:column; align-items:center; text-align:center; width:min(100%,460px); margin:clamp(20px,6vh,60px) auto 0; padding:40px 28px 32px; border-radius:1.7rem;
  border:1.5px solid transparent; background:var(--fj-brush) padding-box, linear-gradient(180deg,rgba(20,20,22,.95),rgba(7,7,8,.97)) padding-box, var(--fj-rim) border-box;
  box-shadow:0 30px 70px -30px #000, 0 0 70px -34px rgba(232,236,242,.5); animation:fj-rise .8s cubic-bezier(.22,1,.36,1) both; }
.fj-lock-icon{ display:grid; place-items:center; width:72px; height:72px; margin-bottom:18px; border-radius:9999px; color:#eef1f5; border:1.5px solid transparent;
  background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.28),rgba(255,255,255,.03) 70%) padding-box, var(--fj-rim) border-box; box-shadow:0 0 36px -6px rgba(232,236,242,.6), inset 0 1px 0 rgba(255,255,255,.35); }

/* ---------- admin ---------- */
.fa-top{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px; margin-bottom:26px; }
.fa-title{ font-family:var(--fj-serif); font-size:clamp(1.9rem,5vw,2.8rem); font-weight:500; }
.fa-list{ display:flex; flex-direction:column; gap:14px; }
.fa-row{
  position:relative; display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:16px 18px; border-radius:1.3rem;
  border:1.5px solid transparent; background:var(--fj-brush) padding-box, linear-gradient(180deg,rgba(22,22,24,.96),rgba(8,8,9,.98)) padding-box, var(--fj-rim) border-box;
  box-shadow:0 18px 40px -28px #000, inset 0 1px 0 rgba(255,255,255,.1);
}
.fa-info{ flex:1 1 220px; min-width:0; }
.fa-info b{ display:block; font-family:var(--fj-serif); font-size:1.25rem; font-weight:600; overflow-wrap:anywhere; }
.fa-info span{ display:block; margin-top:2px; font-size:12.5px; color:rgba(255,255,255,.55); overflow-wrap:anywhere; }
.fa-actions{ display:flex; flex-wrap:wrap; gap:8px; }
.fa-badge{ display:inline-flex; align-items:center; gap:6px; padding:.18rem .7rem; border-radius:9999px; font-size:10.5px; letter-spacing:.16em; text-transform:uppercase; border:1px solid rgba(110,231,160,.5); color:#a7f3d0; background:rgba(16,185,129,.1); }
.fa-badge-off{ border-color:rgba(255,255,255,.2); color:rgba(255,255,255,.5); background:rgba(255,255,255,.04); }
.fa-form{ display:grid; gap:16px; grid-template-columns:minmax(0,1fr); padding:22px 24px 8px; }
@media (min-width:560px){ .fa-form{ grid-template-columns:repeat(2,minmax(0,1fr)); } .fa-wide{ grid-column:1 / -1; } }
.fa-field{ display:flex; flex-direction:column; gap:7px; min-width:0; }
.fa-field label{ font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:rgba(255,255,255,.55); }
.fa-field label em{ font-style:normal; color:rgba(255,255,255,.3); letter-spacing:.1em; text-transform:none; }
.fa-field label b{ color:#fca5a5; font-weight:400; }
.fa-input{
  width:100%; min-height:46px; padding:.7rem 1rem; border-radius:.95rem; color:#f3f4f6; font-size:15px; outline:0;
  border:1.5px solid rgba(232,236,242,.2); background:linear-gradient(180deg,#0f0f10,#080809); box-shadow:inset 0 2px 8px rgba(0,0,0,.6); transition:border-color .2s, box-shadow .2s;
}
.fa-input:focus{ border-color:rgba(255,255,255,.75); box-shadow:inset 0 2px 8px rgba(0,0,0,.6), 0 0 26px -8px rgba(232,236,242,.6); }
.fa-input::placeholder{ color:rgba(255,255,255,.28); }
textarea.fa-input{ min-height:150px; resize:vertical; line-height:1.6; }
select.fa-input{ appearance:none; -webkit-appearance:none; cursor:pointer; }
select.fa-input option{ background:#0b0b0c; }
.fa-err{ font-size:12px; color:#fca5a5; }
.fa-logo-row{ display:flex; align-items:center; gap:16px; }
.fa-note{ margin:0 24px 6px; padding:.65rem .9rem; border-radius:.9rem; font-size:13px; color:#fecaca; background:rgba(127,29,29,.25); border:1px solid rgba(248,113,113,.35); }
.fa-modal-foot{ display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px; padding:16px 24px calc(20px + env(safe-area-inset-bottom,0px)); border-top:1px solid transparent; border-image:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent) 1; }

.fj-root a:focus-visible,.fj-root button:focus-visible,.fj-root input:focus-visible,.fj-root select:focus-visible,.fj-root textarea:focus-visible,.fj-root [role="button"]:focus-visible{ outline:2px solid rgba(232,236,242,.85); outline-offset:3px; }
@media (prefers-reduced-motion: reduce){
  .fj-root *, .fj-root *::before, .fj-root *::after, .fj-layer, .fj-layer *{ animation:none !important; transition-duration:.001ms !important; }
}
`;