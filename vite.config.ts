import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(),
    react(),
    nitro({ preset: "node-server" }), // ← fixed: preset is top-level, not nested
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  environments: {
    ssr: {
      build: {
        rollupOptions: { input: "./src/server.ts" },
      },
    },
  },
});