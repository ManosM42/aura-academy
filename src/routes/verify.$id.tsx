// src/routes/verify.$id.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import AuraMark from "@/components/aura/AuraMark";
import ChromeButton from "@/components/aura/ChromeButton";
import ChromeCursor from "@/components/aura/ChromeCursor";
import { db, type VerifiedCertificate } from "@/lib/db";

export const Route = createFileRoute("/verify/$id")({
  component: VerifyPage,
});

// A well-formed AURA id looks like AURA-XXXX-XXXX-XXXX.
const ID_PATTERN = /^AURA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

type Status = "loading" | "valid" | "invalid";

function VerifyPage() {
  const { id } = Route.useParams();
  const [status, setStatus] = useState<Status>("loading");
  const [cert, setCert] = useState<VerifiedCertificate | null>(null);

  useEffect(() => {
    let active = true;

    async function run() {
      if (!ID_PATTERN.test(id)) {
        if (active) setStatus("invalid");
        return;
      }

      const { data, error } = await db.rpc("verify_certificate", {
        cert_id: id,
      });

      if (!active) return;

      const row = Array.isArray(data)
        ? (data[0] as VerifiedCertificate | undefined)
        : undefined;

      if (error || !row) {
        setStatus("invalid");
      } else {
        setCert(row);
        setStatus("valid");
      }
    }

    setStatus("loading");
    run();
    return () => {
      active = false;
    };
  }, [id]);

  const issued =
    cert?.issued_at &&
    new Date(cert.issued_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-aura-bg px-6 text-aura-text">
      <div className="aura-grain" aria-hidden />
      <ChromeCursor />
      <div className="hero-atmosphere absolute inset-0" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="chrome-field relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-aura-elevated to-aura-surface p-10 text-center shadow-[0_0_70px_-34px_rgba(255,255,255,0.35)]"
      >
        <div className="chrome-line absolute left-8 right-8 top-0 h-px" />

        <div className="flex justify-center">
          <AuraMark />
        </div>
        <span className="chrome-text font-aura mt-6 inline-block text-xs font-semibold uppercase tracking-[0.5em]">
          Aura Certification
        </span>

        {status === "loading" && (
          <p className="font-aura mt-8 text-sm text-aura-text-secondary">
            Verifying credential…
          </p>
        )}

        {status === "valid" && cert && (
          <>
            <div className="mt-8 flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 shadow-[0_0_24px_-4px_rgba(255,255,255,0.5)]">
                <span className="chrome-text font-aura text-2xl font-bold">✓</span>
              </div>
              <h1 className="chrome-text font-aura mt-6 text-3xl font-bold tracking-tight">
                Verified Credential
              </h1>
              <p className="font-aura mt-3 max-w-sm text-sm text-aura-text-secondary">
                This certificate is authentic and issued by AURA
                {cert.holder_name ? ` to ${cert.holder_name}` : ""}.
              </p>
            </div>

            <h2 className="font-aura mt-8 text-xl font-bold text-aura-text">
              {cert.title}
            </h2>

            <div className="certificate-strip mt-8 justify-center">
              <div className="text-left">
                <p className="font-aura text-[0.6rem] uppercase tracking-[0.24em] text-aura-text-muted">
                  Verification ID
                </p>
                <p className="font-aura mt-1 font-mono text-sm text-aura-text">
                  {cert.certificate_id}
                </p>
              </div>
              {issued && (
                <div className="text-left">
                  <p className="font-aura text-[0.6rem] uppercase tracking-[0.24em] text-aura-text-muted">
                    Issued
                  </p>
                  <p className="font-aura mt-1 text-sm text-aura-text">{issued}</p>
                </div>
              )}
            </div>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 className="font-aura mt-8 text-3xl font-bold tracking-tight text-aura-text">
              Credential not recognized
            </h1>
            <p className="font-aura mt-3 text-sm text-aura-text-secondary">
              The ID <span className="font-mono text-aura-text">{id}</span> is
              not a valid AURA verification code.
            </p>
          </>
        )}

        <div className="mt-10">
          <Link to="/">
            <ChromeButton variant="secondary">Back to AURA</ChromeButton>
          </Link>
        </div>

        <div className="chrome-line absolute bottom-0 left-8 right-8 h-px" />
      </motion.div>
    </div>
  );
}