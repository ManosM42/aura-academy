import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/review/haircuts/haircut")({
  beforeLoad: () => {
    throw redirect({ to: "/review/haircuts" });
  },
});