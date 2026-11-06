// src/components/aura/elite/EliteLocked.tsx
import { Link } from "@tanstack/react-router";
import { Check, Crown, Gem, Lock } from "lucide-react";
import { getPlan } from "@/lib/plans";

// Change these paths if your routes are named differently.
const UPGRADE_PATH = "/pricing";
const LOGIN_PATH = "/login";
const BACK_PATH = "/academy";

export default function EliteLocked({ signedOut = false }: { signedOut?: boolean }) {
  const elite = getPlan("high");
  // Skip "all PRO perks" (first line) and show the Elite-only highlights.
  const perks = elite?.features.slice(1, 5) ?? [];

  return (
    <div className="el-root">
      <style>{css}</style>

      <div className="el-card">
        <span className="el-crown">
          <Crown className="size-8" aria-hidden />
        </span>

        <p className="el-eyebrow">
          <Gem className="size-3.5" aria-hidden /> ELITE EXCLUSIVE
        </p>

        <h1 className="el-title">{signedOut ? "SIGN IN TO JOIN" : "UPGRADE TO ELITE TO JOIN"}</h1>
        <span className="el-rule" aria-hidden />

        <p className="el-text">
          This private community is reserved for AURA Elite members.
          {signedOut ? " Sign in with your Elite account to enter." : " Upgrade your plan to unlock the group."}
        </p>

        {elite && !signedOut && (
          <div className="el-plan">
            <div className="el-plan-head">
              <span className="el-plan-name">{elite.name}</span>
              <span className="el-plan-price">
                {elite.priceLabel}
                <small> / month</small>
              </span>
            </div>
            <ul className="el-perks">
              {perks.map((f) => (
                <li key={f}>
                  <Check className="size-4 shrink-0" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link to={signedOut ? LOGIN_PATH : UPGRADE_PATH} className="el-cta">
          <Lock className="size-4" aria-hidden />
          {signedOut ? "Sign in" : "Upgrade to Elite"}
        </Link>
        <Link to={BACK_PATH} className="el-back">
          Back to Academy
        </Link>
      </div>
    </div>
  );
}

const css = `
.el-root{
  position:fixed; inset:0; z-index:10; display:grid; place-items:center; padding:24px; overflow-y:auto;
  color:#f3f4f6;
  background:
    radial-gradient(110% 70% at 50% -10%,rgba(255,255,255,.08),transparent 60%),
    linear-gradient(180deg,#0b0b0b,#050505);
}
.el-card{
  width:min(100%,460px); margin:auto; padding:40px 28px 32px; text-align:center; border-radius:1.6rem;
  display:flex; flex-direction:column; align-items:center;
  border:1px solid transparent;
  background:linear-gradient(180deg,rgba(18,18,19,.94),rgba(7,7,8,.96)) padding-box,
             linear-gradient(145deg,rgba(255,255,255,.6),rgba(255,255,255,.06) 35%,rgba(232,236,242,.4) 70%,rgba(255,255,255,.1)) border-box;
  box-shadow:0 30px 70px -30px #000, 0 0 70px -34px rgba(232,236,242,.5);
  animation: el-in .5s cubic-bezier(.22,1,.36,1);
}
@keyframes el-in{ from{opacity:0; transform:translateY(16px) scale(.98)} to{opacity:1; transform:none} }

.el-crown{
  display:grid; place-items:center; width:72px; height:72px; border-radius:9999px; color:#eef1f5; margin-bottom:18px;
  border:1px solid rgba(232,236,242,.45);
  background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.25),rgba(255,255,255,.03) 70%);
  box-shadow:0 0 36px -6px rgba(232,236,242,.6), inset 0 1px 0 rgba(255,255,255,.3);
}
.el-eyebrow{ display:inline-flex; align-items:center; gap:8px; font-size:11px; letter-spacing:.35em; color:rgba(255,255,255,.55); }
.el-title{
  margin-top:14px; font-family:"Cormorant Garamond",Georgia,serif; font-size:clamp(1.6rem,6vw,2.1rem);
  line-height:1.15; letter-spacing:.08em; font-weight:500;
  background:linear-gradient(115deg,#8b93a1 0%,#fff 28%,#aeb4bf 48%,#fff 62%,#8b93a1 82%,#f1f5f9 100%);
  background-size:260% 100%; -webkit-background-clip:text; background-clip:text; color:transparent;
  animation: el-shimmer 8s linear infinite;
}
@keyframes el-shimmer{ 0%{background-position:200% 0} 100%{background-position:-200% 0} }
.el-rule{ width:60%; height:1px; margin:18px 0; background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent); }
.el-text{ font-size:14px; line-height:1.6; color:rgba(255,255,255,.55); max-width:330px; }

.el-plan{
  width:100%; margin-top:22px; padding:16px 16px 12px; text-align:left; border-radius:1.1rem;
  border:1px solid rgba(232,236,242,.22);
  background:radial-gradient(90% 100% at 50% 0%,rgba(232,236,242,.1),transparent 70%),rgba(255,255,255,.02);
}
.el-plan-head{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:12px; }
.el-plan-name{ font-size:12px; font-weight:600; letter-spacing:.25em; color:#e8ecf2; }
.el-plan-price{ font-family:"Cormorant Garamond",Georgia,serif; font-size:1.5rem; color:#fff; }
.el-plan-price small{ font-family:inherit; font-size:11px; letter-spacing:.1em; color:rgba(255,255,255,.45); }
.el-perks{ display:flex; flex-direction:column; gap:9px; }
.el-perks li{ display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.45; color:rgba(255,255,255,.65); }
.el-perks svg{ margin-top:2px; color:#e8ecf2; }

.el-cta{
  margin-top:26px; display:inline-flex; align-items:center; gap:10px; padding:.95rem 2rem; border-radius:9999px;
  font-size:13px; font-weight:600; letter-spacing:.2em; text-transform:uppercase; color:#101012;
  background:radial-gradient(circle at 32% 22%,#fff 0%,#e0e4ea 22%,#98a0ab 60%,#5a606a 100%);
  box-shadow:0 1px 0 rgba(255,255,255,.95) inset, 0 -6px 12px rgba(0,0,0,.3) inset, 0 12px 22px rgba(0,0,0,.7), 0 0 30px -6px rgba(232,236,242,.6);
  transition:transform .15s, filter .2s;
}
.el-cta:hover{ filter:brightness(1.08); transform:translateY(-1px); }
.el-cta:active{ transform:translateY(2px) scale(.97); }
.el-back{ margin-top:16px; font-size:12px; letter-spacing:.15em; color:rgba(255,255,255,.4); transition:color .2s; }
.el-back:hover{ color:#fff; }
.el-cta:focus-visible,.el-back:focus-visible{ outline:2px solid rgba(232,236,242,.8); outline-offset:3px; }

@media (prefers-reduced-motion: reduce){
  .el-card,.el-title{ animation:none !important; }
}
`;
