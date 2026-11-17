import { createFileRoute } from "@tanstack/react-router";
import AuraAI from "@/components/aura/AuraAI";

export const Route = createFileRoute("/ai")({ component: AuraAI });