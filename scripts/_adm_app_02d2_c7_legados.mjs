// ADM-APP-02D.2 — C7: evidência dos docs legados pós-privatização (read-only).
// Para cada linha de documentos_prestadores: normaliza a URL/path antiga e tenta
// createSignedUrl (service_role, TTL 600). Espera-se ~29 assináveis, 2 órfãos
// (path não existe no storage) e 1 URL vazia, conforme baseline 02D.1.
import { createClient } from "@supabase/supabase-js";
import { BASE, SR } from "./_adm_app_02d2_env.mjs";

const BUCKET = "documentos_prestadores";
const admin = createClient(BASE, SR, { auth: { persistSession: false } });

function paraPath(bruto) {
  if (!bruto) return null;
  const s = String(bruto).trim();
  if (!s) return null;
  const marker = `/object/public/${BUCKET}/`;
  if (s.includes(marker)) return decodeURIComponent(s.split(marker)[1].split("?")[0]);
  const signed = `/object/sign/${BUCKET}/`;
  if (s.includes(signed)) return decodeURIComponent(s.split(signed)[1].split("?")[0]);
  if (s.startsWith(`${BUCKET}/`)) return s.slice(BUCKET.length + 1);
  if (s.includes("://")) return null;
  return s;
}

const { data: rows, error } = await admin
  .from("documentos_prestadores")
  .select("*");
if (error) throw new Error(`select: ${error.message}`);

const resumo = { total: rows.length, url_vazia: 0, path_nulo: 0, assinaveis: [], orfaos: [], erros: [] };
for (const r of rows) {
  const url = r.url ?? r.arquivo ?? null;
  const path = paraPath(url);
  if (!url || !String(url).trim()) { resumo.url_vazia++; continue; }
  if (!path) { resumo.path_nulo++; continue; }
  const { data, error: e } = await admin.storage.from(BUCKET).createSignedUrl(path, 600);
  if (e || !data?.signedUrl) {
    resumo.orfaos.push({ id: r.id, path, erro: e?.message || "sem signedUrl" });
  } else {
    resumo.assinaveis.push({ id: r.id, prestador_id: r.prestador_id, path });
  }
}

const saida = {
  ts: new Date().toISOString(),
  bucket: BUCKET,
  total: resumo.total,
  assinaveis: resumo.assinaveis.length,
  orfaos: resumo.orfaos.length,
  url_vazia: resumo.url_vazia,
  path_nulo: resumo.path_nulo,
  orfaos_detalhe: resumo.orfaos,
  paths_assinaveis: resumo.assinaveis.map((a) => a.path),
  ok: resumo.assinaveis.length === 29 && resumo.orfaos.length === 2 && resumo.url_vazia + resumo.path_nulo === 1,
};
const fs = await import("node:fs");
fs.writeFileSync(new URL("./_adm_app_02d2_c7_legados.out.json", import.meta.url), JSON.stringify(saida, null, 2));
console.log(JSON.stringify({ total: saida.total, assinaveis: saida.assinaveis, orfaos: saida.orfaos, url_vazia: saida.url_vazia, path_nulo: saida.path_nulo, ok: saida.ok }));
process.exit(saida.ok ? 0 : 1);
