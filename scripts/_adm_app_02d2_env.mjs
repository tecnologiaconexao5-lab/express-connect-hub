import fs from "node:fs";

const PROJETO = "uwrvzsjtpgaifkktpepn";
const APP_SETUP = "C:/src/conexao_prestador/scripts/setup_completo.ps1";

function linhasFontes() {
  const out = [];
  for (const f of [".env", ".env.qa", ".env.production"]) {
    if (fs.existsSync(f)) out.push(...fs.readFileSync(f, "utf8").split(/\r?\n/));
  }
  if (fs.existsSync(APP_SETUP)) out.push(fs.readFileSync(APP_SETUP, "utf8"));
  return out;
}

export function pick(re) {
  const vals = linhasFontes().map(l => { const m = l.match(re); return m ? m[1].trim() : null; }).filter(Boolean);
  if (!vals.length) throw new Error("variavel nao encontrada: " + re);
  return vals[0];
}

export function projetoDoJwt(token) {
  try { return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).ref; } catch { return null; }
}

export const BASE = pick(/^VITE_SUPABASE_URL\s*=\s*(.+)$/);
export const ANON = pick(/^VITE_SUPABASE_ANON_KEY\s*=\s*(.+)$/);
export const DB = pick(/^DATABASE_URL\s*=\s*(.+)$/);

// service_role: aceita somente chave cujo `ref` = projeto ativo
const candidatos = [
  ...[".env", ".env.qa", ".env.production"].flatMap(f => {
    if (!fs.existsSync(f)) return [];
    const m = fs.readFileSync(f, "utf8").match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(\S+)$/m);
    return m ? [m[1].trim()] : [];
  }),
  ...(() => {
    if (!fs.existsSync(APP_SETUP)) return [];
    const m = fs.readFileSync(APP_SETUP, "utf8").match(/ServiceRoleKey\s*=\s*"([^"]+)"/);
    return m ? [m[1].trim()] : [];
  })(),
];
const valido = candidatos.find(k => projetoDoJwt(k) === PROJETO);
if (!valido) throw new Error("SUPABASE_SERVICE_ROLE_KEY do projeto " + PROJETO + " nao encontrada");
export const SR = valido;
