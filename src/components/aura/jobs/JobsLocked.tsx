// src/components/aura/jobs/JobsLocked.tsx
import { Link } from "@tanstack/react-router";
import { Briefcase, Lock } from "lucide-react";
import { getPlan } from "@/lib/plans";
import { jobsCss } from "./jobsTheme";

// Change these paths if your routes are named differently.
const UPGRADE_PATH = "/pricing";
const LOGIN_PATH = "/login";

export default function JobsLocked({ signedOut = false }: { signedOut?: boolean }) {
  const basic = getPlan("low");

  return (
    <div className="fj-root">
      <style>{jobsCss}</style>
      <div className="fj-wrap">
        <div className="fj-lock">
          <span className="fj-lock-icon">
            <Briefcase className="size-8" aria-hidden />
          </span>
          <h1 className="fj-title fj-chrome" style={{ fontSize: "clamp(1.8rem,6vw,2.4rem)" }}>
            {signedOut ? "Sign in to continue" : "Unlock Find Job"}
          </h1>
          <span className="fj-rule" aria-hidden />
          <p className="fj-sub" style={{ fontSize: ".98rem" }}>
            {signedOut
              ? "Sign in with your AURA account to see the barbershops that are hiring."
              : "Find Job is available with any AURA plan. Choose a plan to see open positions from our partner barbershops."}
          </p>
          {!signedOut && basic && (
            <p style={{ marginTop: 14, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,.5)" }}>
              Plans from {basic.priceLabel} / month
            </p>
          )}

          <Link to={signedOut ? LOGIN_PATH : UPGRADE_PATH} className="fj-btn fj-btn-chrome" style={{ marginTop: 26, height: 52, padding: "0 30px" }}>
            <Lock className="size-4" aria-hidden />
            {signedOut ? "Sign in" : "View plans"}
          </Link>
        </div>
      </div>
    </div>
  );
}