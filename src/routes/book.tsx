// src/routes/book.tsx  ->  /book
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  Compass,
  Crown,
  Layers,
  MessageCircle,
  Ruler,
  Scissors,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Book3D, { CHAPTERS } from "@/components/aura/Book3D";
import BookCheckoutModal from "@/components/aura/BookCheckoutModal";
import { ChromeCTA, ChromeText, EASE, Frame } from "@/components/aura/chrome";
import { formatMoney, getBookSettings, type BookSettings } from "@/lib/book";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [{ title: "AURA — The Barbering Book" }] }),
  component: BookPage,
});

const TOPICS = [
  { icon: Ruler, title: "Cutting geometry", text: "The angles, sections and shapes behind every clean haircut." },
  { icon: Scissors, title: "Every tool, mastered", text: "Scissors, razor and clipper technique, explained step by step." },
  { icon: Layers, title: "Fades and blending", text: "From fast fades to photo-ready transitions." },
  { icon: Compass, title: "Face shapes", text: "Read the client and choose the cut that suits them." },
  { icon: MessageCircle, title: "Client experience", text: "Consultation and service that turn visitors into regulars." },
  { icon: Crown, title: "Professional mindset", text: "The standards, image and confidence behind the chair." },
];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

function BookPage() {
  const reduce = useReducedMotion();
  const [settings, setSettings] = useState<BookSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getBookSettings()
      .then((s) => alive && setSettings(s))
      .catch((e: Error) => alive && setLoadError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const soldOut = settings?.stock != null && settings.stock <= 0;
  const available = !!settings && settings.is_active && settings.price_cents > 0 && !soldOut;
  const lowStock = settings?.stock != null && settings.stock > 0 && settings.stock <= 10;

  return (
    <main className="relative isolate overflow-hidden px-4 pb-28 pt-32 text-white sm:px-6 sm:pt-40 md:px-10">
      {/* ambient glow + watermark */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 aspect-square w-[min(1000px,130%)] -translate-x-1/2 -translate-y-1/4 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(170,180,190,0.04) 40%, transparent 70%)" }}
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-24 -z-10 select-none text-center font-serif text-[24vw] font-bold leading-none tracking-[0.12em] text-white/[0.025]">
        ΛURΛ
      </div>

      <div className="mx-auto max-w-7xl">
        {/* ------------------------------ HERO ------------------------------ */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
            <motion.div variants={fadeUp} className="mb-5 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
              <span className="h-px w-10 bg-gradient-to-r from-white/70 to-transparent" />
              The ΛURΛ book
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              <ChromeText>Years of chair time, bound in one book.</ChromeText>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              The AURA physical book is a barbering reference built to live at your station. Clear technique
              breakdowns, cutting geometry, fades from clean to photo-ready, and the client skills that keep your
              chair full.
            </motion.p>

            {/* price + order */}
            <motion.div variants={fadeUp} className="mt-9">
              <Frame inner="p-5 sm:p-6">
                {loading ? (
                  <div className="h-16 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
                ) : loadError || !settings ? (
                  <p className="text-sm text-white/55">The book is not available to order right now. Please check back soon.</p>
                ) : (
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">Price</p>
                      <p className="mt-1 text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.45)]">
                        {settings.price_cents > 0 ? formatMoney(settings.price_cents, settings.currency) : "—"}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {settings.shipping_cents > 0
                          ? `+ ${formatMoney(settings.shipping_cents, settings.currency)} shipping`
                          : "Free shipping"}
                      </p>
                      {lowStock && (
                        <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-white">
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-70" />
                            <span className="relative inline-flex size-2 rounded-full bg-white" />
                          </span>
                          Only {settings.stock} left
                        </p>
                      )}
                    </div>
                    <ChromeCTA type="button" disabled={!available} onClick={() => setOrderOpen(true)} className="sm:min-w-[210px]">
                      <BookOpen className="size-4" />
                      {soldOut ? "Sold out" : "Order the book"}
                    </ChromeCTA>
                  </div>
                )}
              </Frame>
            </motion.div>

            <motion.ul variants={fadeUp} className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/55">
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-white/80" /> Secure payment</li>
              <li className="flex items-center gap-2"><Truck className="size-4 text-white/80" /> Shipped to your address</li>
              <li className="flex items-center gap-2"><BookOpen className="size-4 text-white/80" /> Hardcover edition</li>
            </motion.ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}>
            <Book3D />
          </motion.div>
        </section>

        {/* ---------------------------- WHAT'S INSIDE ---------------------------- */}
        <section className="mt-24 sm:mt-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE }}
            className="mb-10 text-center"
          >
            <p className="text-xs uppercase tracking-[0.4em] text-white/45">Table of contents</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl"><ChromeText>What is inside.</ChromeText></h2>
          </motion.div>

          <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
            {CHAPTERS.map((c, i) => (
              <motion.div
                key={c}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease: EASE, delay: (i % 2) * 0.08 }}
                whileHover={{ x: 4 }}
                className={i === CHAPTERS.length - 1 && CHAPTERS.length % 2 === 1 ? "sm:col-span-2" : ""}
              >
                <div className="group flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4 transition-all duration-300 hover:border-white/40 hover:bg-white/[0.06] hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]">
                  <span className="w-9 shrink-0 font-serif text-2xl text-white/35 transition-colors group-hover:text-white">{ROMAN[i]}</span>
                  <span className="text-sm font-medium text-white/85 group-hover:text-white">{c}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ------------------------------ TOPICS ------------------------------ */}
        <section className="mt-24 sm:mt-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE }}
            className="mb-10 text-center"
          >
            <p className="text-xs uppercase tracking-[0.4em] text-white/45">Inside the book</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl"><ChromeText>Everything behind the chair.</ChromeText></h2>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t, i) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.7, ease: EASE, delay: (i % 3) * 0.08 }}
                whileHover={{ y: -6 }}
                className="group"
              >
                <Frame className="h-full" inner="p-6">
                  <span className="flex size-12 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-zinc-200 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:border-white/50 group-hover:text-white group-hover:shadow-[0_0_26px_rgba(255,255,255,0.4)]">
                    <t.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-white">{t.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t.text}</p>
                </Frame>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ------------------------------ DETAILS ------------------------------ */}
        <section className="mt-24 sm:mt-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE }}
            className="mx-auto max-w-4xl"
          >
            <Frame inner="p-6 sm:p-10">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl"><ChromeText>Edition and delivery.</ChromeText></h2>
              <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
                <Detail label="Format" value="Hardcover, black pages" />
                <Detail label="Title" value={settings?.title ?? "ΛURΛ — The Barbering Book"} />
                <Detail
                  label="Price"
                  value={settings && settings.price_cents > 0 ? formatMoney(settings.price_cents, settings.currency) : "—"}
                />
                <Detail
                  label="Shipping"
                  value={settings ? (settings.shipping_cents > 0 ? formatMoney(settings.shipping_cents, settings.currency) : "Free") : "—"}
                />
                <Detail label="Delivery" value="Shipped to the address you enter at checkout" />
                <Detail label="Payment" value="Secure card payment, right here on the site" />
              </dl>

              <div className="mt-10 flex flex-col items-start gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-sm leading-relaxed text-white/55">
                  Order in less than a minute. Enter your shipping details, pay securely, and we take care of the rest.
                </p>
                <ChromeCTA type="button" disabled={!available} onClick={() => setOrderOpen(true)}>
                  <BookOpen className="size-4" />
                  {soldOut ? "Sold out" : "Order the book"}
                </ChromeCTA>
              </div>
            </Frame>
          </motion.div>
        </section>
      </div>

      {settings && (
        <BookCheckoutModal open={orderOpen} onClose={() => setOrderOpen(false)} settings={settings} />
      )}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/[0.07] pb-4">
      <dt className="text-[11px] uppercase tracking-[0.3em] text-white/40">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium text-white/90">{value}</dd>
    </div>
  );
}