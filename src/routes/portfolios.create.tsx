// src/routes/portfolios.create.tsx  ->  /portfolios/create  (create AND edit)
import { createFileRoute } from "@tanstack/react-router";
import PortfolioCreatePage from "@/components/aura/portfolio/PortfolioCreatePage";

export const Route = createFileRoute("/portfolios/create")({
  component: PortfolioCreatePage,
});