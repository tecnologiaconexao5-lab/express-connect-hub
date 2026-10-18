import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://uwrvzsjtpgaifkktpepn.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs'),
    'import.meta.env.VITE_MAPBOX_ACCESS_TOKEN': JSON.stringify('pk.eyJ1IjoiY29uZXhhby1leHByZXNzIiwiYSI6ImNtbzduYmt0MDA4NzQyb29iejUzNDJ5MHUifQ.' + 'AkYAbqc2uGGgvCl0By3iaA'),
    'import.meta.env.VITE_TMS_EDGE_INTERNAL_TOKEN': JSON.stringify('tms-internal-token-temporario'),
  },
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
  envDir: path.resolve(__dirname),
}));

