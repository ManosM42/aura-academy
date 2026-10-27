// src/components/aura/chrome.tsx
// Shared chrome-silver building blocks for the book pages.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const CHROME_TEXT =
  "linear-gradient(90deg, #595959 0%, #b3b3b3 25%, #ffffff 50%, #b3b3b3 75%, #595959 100%)";
export const CHROME_FILL =
  "linear-gradient(180deg, #ffffff 0%, #e6e6ea 30%, #b4b4bc 48%, #8a8a92 52%, #bdbdc4 74%, #f4f4f6 100%)";
export const FRAME_BORDER =
  "linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.06) 65%, rgba(255,255,255,0.4))";

export const fieldClass =
  "w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white/90 outline-none transition-all duration-300 placeholder:text-white/25 focus:border-white/50 focus:bg-black/80 focus:shadow-[0_0_26px_rgba(255,255,255,0.1)] focus:ring-2 focus:ring-white/15 disabled:opacity-50";

/** Animated chrome gradient text. */
export function ChromeText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      initial={{ backgroundPosition: "0% 50%" }}
      animate={reduce ? undefined : { backgroundPosition: "100% 50%" }}
      transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
      style={{
        backgroundImage: CHROME_TEXT,
        backgroundSize: "300% auto",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
      className={`inline-block drop-shadow-[0_0_28px_rgba(255,255,255,0.45)] ${className}`}
    >
      {children}
    </motion.span>
  );
}

/** 1px chrome gradient border around a dark surface. */
export function Frame({
  children,
  className = "",
  inner = "p-6",
}: {
  children: ReactNode;
  className?: string;
  inner?: string;
}) {
  return (
    <div
      className={`relative rounded-3xl p-px ${className}`}
      style={{ background: FRAME_BORDER, boxShadow: "0 0 60px rgba(0,0,0,0.9)" }}
    >
      <div className={`relative h-full overflow-hidden rounded-[23px] bg-[#0a0a0b] ${inner}`}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)" }}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

export function Sheen() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent"
      animate={{ x: ["-160%", "420%"] }}
      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3.2, ease: "easeInOut" }}
      style={{ skewX: -18 }}
    />
  );
}

const solidStyle = {
  backgroundImage: CHROME_FILL,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 30px rgba(255,255,255,0.18)",
};

const baseBtn =
  "group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-8 py-3.5 text-sm font-bold outline-none transition-shadow duration-300 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40";
const solidCls = "text-neutral-950 hover:shadow-[0_0_50px_rgba(255,255,255,0.4)]";
const ghostCls =
  "border border-white/25 bg-white/[0.04] text-white hover:border-white/60 hover:bg-white/[0.09] hover:shadow-[0_0_30px_rgba(255,255,255,0.14)]";

/** Animated chrome button. */
export function ChromeCTA({
  children,
  solid = true,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { solid?: boolean }) {
  return (
    <motion.div
      whileHover={rest.disabled ? undefined : { y: -2, scale: 1.03 }}
      whileTap={rest.disabled ? undefined : { scale: 0.97 }}
      className={`inline-block ${className}`}
    >
      <button
        {...rest}
        className={`${baseBtn} ${solid ? solidCls : ghostCls} w-full`}
        style={solid ? solidStyle : undefined}
      >
        {solid && <Sheen />}
        <span className="relative inline-flex items-center gap-2.5">{children}</span>
      </button>
    </motion.div>
  );
}

/** Animated chrome link-button. */
export function ChromeCTALink({
  to,
  children,
  solid = true,
  arrow = true,
  className = "",
}: {
  to: string;
  children: ReactNode;
  solid?: boolean;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <motion.div whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }} className={`inline-block ${className}`}>
      <Link
        to={to as never}
        className={`${baseBtn} ${solid ? solidCls : ghostCls}`}
        style={solid ? solidStyle : undefined}
      >
        {solid && <Sheen />}
        <span className="relative inline-flex items-center gap-2.5">
          {children}
          {arrow && <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />}
        </span>
      </Link>
    </motion.div>
  );
}