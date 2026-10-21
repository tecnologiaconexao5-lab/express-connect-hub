import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const ENV_DIR = path.resolve(__dirname);

export default defineConfig(({ mode }) => {
  return {
    // IMPORTANTE: nenhuma credencial/URL fica fixa aqui.
    // Todas as variaveis VITE_* vem exclusivamente do ambiente de build
    // (Vercel Environment Variables em producao ou .env local em dev).
    server: {
      host: "::",
      port: 8800,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    optimizeDeps: {
      include: ["react-map-gl", "mapbox-gl"],
    },
    // Carrega automaticamente .env.development, .env.qa ou .env.production
    // conforme o modo (development / qa / production).
    // O Vite por padrao carrega .env.[mode] em cima de .env.
    envDir: ENV_DIR,
  };
});
