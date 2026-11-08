// src/routes/portfolios.$slug.tsx  ->  /portfolios/:slug
import { createFileRoute } from "@tanstack/react-router";
import PortfolioProfilePage from "@/components/aura/portfolio/PortfolioProfilePage";

export const Route = createFileRoute("/portfolios/$slug")({
  component: function PortfolioRoute() {
    const { slug } = Route.useParams();
    return <PortfolioProfilePage slug={slug} />;
  },
});