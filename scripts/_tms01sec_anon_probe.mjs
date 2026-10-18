/**
 * TMS-01-SEC — Prova de exposicao com chave ANON (sem autenticacao). SOMENTE LEITURA.
 * Saida: scripts/_tms01sec_anon_probe.json
 */
import fs from "node:fs";
import { BASE, ANON } from "./_adm_app_02d2_env.mjs";

const alvos = ["tenant_usuarios", "ordens_servico", "clientes", "prestadores", "pagamentos_prestadores", "financeiro_pagar", "financeiro_receber", "documentos_prestadores"];
const out = { ts: new Date().toISOString(), base: BASE, probes: [] };

for (const t of alvos) {
  const url = `${BASE}/rest/v1/${t}?select=*&limit=3`;
  try {
    const r = await fetch(url, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    const n = Array.isArray(body) ? body.length : -1;
    const item = { tabela: t, status: r.status, linhas_retornadas: n, erro: Array.isArray(body) ? null : (body?.message || body) };
    out.probes.push(item);
    console.log(`${t}: HTTP ${r.status} | linhas=${n}${item.erro ? " | " + JSON.stringify(item.erro).slice(0,120) : ""}`);
  } catch (e) {
    out.probes.push({ tabela: t, erro: String(e.message) });
    console.log(`${t}: ERRO ${e.message}`);
  }
}
fs.writeFileSync("scripts/_tms01sec_anon_probe.json", JSON.stringify(out, null, 2));
console.log("\nEVIDENCIA: scripts/_tms01sec_anon_probe.json");
