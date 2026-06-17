import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  // Fix npm workspaces: resolve react/react-dom from the workspace root
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  server: {
    proxy: {
      "/api/nvidia": {
        target: "https://integrate.api.nvidia.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, ""),
      },
    },
    fs: {
      // Allow Vite to serve files from the monorepo root node_modules
      allow: [path.resolve(__dirname, "../")],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Gesfit Pro",
        short_name: "Gesfit",
        description: "Plataforma fitness: gestão de personal trainers, alunos, aulas e resultados.",
        theme_color: "#065f46",
        background_color: "#f7f4ed",
        display: "standalone",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
        ],
      },
    }),
  ],
});
