// src/components/aura/RankPreviewSection.tsx
import { Sparkles, Award, ShieldCheck, Zap, PackageCheck } from "lucide-react";
import { RankIcon } from "@/components/aura/RankIcon";
import type { RankKey } from "@/lib/ranks";

const PREVIEW_RANKS: { key: RankKey; title: string; points: string; desc: string }[] = [
  { key: "unranked", title: "Unranked", points: "0 - 100 XP", desc: "Το σημείο εκκίνησης. Ετοιμαστείτε για το πρώτο σας κούρεμα." },
  { key: "bronze", title: "Bronze Tier", points: "101 - 250 XP", desc: "Τα πρώτα βήματα στην τέχνη του κουρέματος." },
  { key: "silver", title: "Silver Tier", points: "251 - 600 XP", desc: "Σταθερό χέρι, καθαρές γραμμές και τεχνική." },
  { key: "gold", title: "Gold Tier", points: "601 - 1200 XP", desc: "Αναγνώριση λεπτομέρειας και επαγγελματισμός." },
  { key: "platinum", title: "Platinum Tier", points: "1201 - 2000 XP", desc: "Προχωρημένα fades και απόλυτη συμμετρία." },
  { key: "diamond", title: "Diamond Tier", points: "2001 - 3000 XP", desc: "Master level mastery στις σύγχρονες τάσεις." },
  { key: "aura_master", title: "Aura Master", points: "3000+ XP", desc: "Η κορυφή. Η απόλυτη υπογραφή στην κοινότητα." },
];

export function RankPreviewSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-black via-[#0a0a0c] to-black py-24 text-white">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-orange-600/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-orange-400 text-xs font-semibold tracking-widest uppercase mb-4 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Aura Evolution System
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-6">
            Ανεβείτε επίπεδο <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">κατακτώντας το Rank σας</span>
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
            Κάθε κούρεμα που ανεβάζετε και κάθε τεχνική δεξιότητα που πιστοποιείτε σας φέρνει πιο κοντά στην κορυφή. Η αριστεία ανταμείβεται.
          </p>
        </div>

        {/* How it works mini-cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-md flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base mb-1">1. Verified Skills</h3>
              <p className="text-zinc-400 text-sm">Ολοκληρώστε τις ενότητες της Academy και αποδείξτε τις γνώσεις σας.</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-md flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base mb-1">2. Haircut Reviews</h3>
              <p className="text-zinc-400 text-sm">Στείλτε τις δουλειές σας για επαγγελματική αξιολόγηση και πάρτε πόντους XP.</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-md flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base mb-1">3. Unlock Mastery</h3>
              <p className="text-zinc-400 text-sm">Ξεπεράστε τα όρια, κερδίστε αποκλειστικό status και γίνετε Aura Master.</p>
            </div>
          </div>
        </div>

        {/* Special Aura Master of the Month Banner */}
        <div className="relative mb-16 p-8 rounded-3xl bg-gradient-to-r from-orange-950/60 via-zinc-900/80 to-amber-950/60 border border-orange-500/30 overflow-hidden shadow-[0_0_40px_-10px_rgba(255,90,20,0.2)]">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 text-white shadow-lg shrink-0">
              <PackageCheck className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <span className="inline-block text-xs font-bold text-orange-400 tracking-widest uppercase mb-1">
                VIP Master Reward
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
                Aura Master of the Month Certification
              </h3>
              <p className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-3xl">
                Όποιος διατηρηθεί στην κορυφή ως <span className="text-orange-400 font-semibold">Aura Master για έναν ολόκληρο μήνα</span>, κερδίζει αυτόματα την επίσημη φυσική πιστοποίηση με τίτλο "Aura Master of the Month", η οποία αποστέλλεται απευθείας στη διεύθυνσή του με δικά μας έξοδα!
              </p>
            </div>
          </div>
        </div>

        {/* Ranks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {PREVIEW_RANKS.map((r) => (
            <div
              key={r.key}
              className="group relative p-6 rounded-3xl bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 border border-white/10 hover:border-orange-500/40 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(255,90,20,0.15)] flex flex-col items-center text-center"
            >
              <div className="mb-5 p-4 rounded-2xl bg-black/40 border border-white/5 group-hover:scale-110 transition-transform duration-300">
                <RankIcon rank={r.key} size={54} />
              </div>
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
                {r.points}
              </span>
              <h3 className="text-xl font-bold text-white mb-2">{r.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}