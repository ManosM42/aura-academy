// src/routes/portfolios.index.tsx  ->  /portfolios
import { createFileRoute } from "@tanstack/react-router";
import PortfolioBoardPage from "@/components/aura/portfolio/PortfolioBoardPage";

export const Route = createFileRoute("/portfolios/")({
  component: PortfolioBoardPage,
});