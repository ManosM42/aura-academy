// src/components/aura/portfolio/CreatePortfolioButton.tsx
// Drop this at the START of the Profile page: <CreatePortfolioButton userId={user.id} />
// Shows only for active AURA ELITE members.
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Images, Sparkles } from "lucide-react";
import { useIsElite, useMyPortfolio } from "@/lib/portfolio";
import { pfCss } from "./pfStyles";

export default function CreatePortfolioButton({ userId }: { userId: string | undefined }) {
  const { isElite, loading: eliteLoading } = useIsElite(userId);
  const { portfolio, loading: pfLoading } = useMyPortfolio(userId);

  if (!userId || eliteLoading || pfLoading || !isElite) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="pf-root mb-8 flex justify-center"
    >
      <style>{pfCss}</style>
      {portfolio ? (
        <Link to="/portfolios/$slug" params={{ slug: portfolio.slug }} className="pf-btn pf-btn-solid px-7 py-3.5 tracking-[0.16em]">
          <Images className="size-4" /> ΤΟ PORTFOLIO ΜΟΥ
        </Link>
      ) : (
        <Link to="/portfolios/create" className="pf-btn pf-btn-solid px-7 py-3.5 tracking-[0.16em]">
          <Sparkles className="size-4" /> ΔΗΜΙΟΥΡΓΗΣΕ ΤΟ PORTFOLIO ΣΟΥ
        </Link>
      )}
    </motion.div>
  );
}