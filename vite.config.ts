import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const ENV_DIR = path.resolve(__dirname);

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host === "[::1]") return true;
  if (host === "127.0.0.1" || host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

/**
 * Em producao o build so pode apontar para a nuvem.
 * Falha cedo (na Vercel) se VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
 * estiverem ausentes ou se a URL for localhost/IP da rede local.
 */
function validarAmbienteProducao(env: Record<string, string>): void {
  const url = (env.VITE_SUPABASE_URL || "").trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || "").trim();

  if (!url || !anonKey) {
    throw new Error(
      "[build] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao obrigatorias em producao. " +
        "Configure-as nas Environment Variables da Vercel.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[build] VITE_SUPABASE_URL invalida: "${url}".`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error("[build] VITE_SUPABASE_URL deve usar HTTPS em producao.");
  }

  if (isLocalOrPrivateHost(parsed.hostname)) {
    throw new Error(
      `[build] VITE_SUPABASE_URL aponta para "${parsed.hostname}" (localhost/IP local). ` +
        "Em producao use a URL publica do Supabase.",
    );
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, "VITE_");

  // Vercel define VERCEL=1 no build, independentemente do mode usado.
  if (mode === "production" || process.env.VERCEL) {
    validarAmbienteProducao(env);
  }

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
