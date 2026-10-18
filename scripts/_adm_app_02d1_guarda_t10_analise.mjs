// Read-only: classifica as 32 refs de documentos_prestadores contra a guarda T10
// (caminhoPertenceAoPrestador: prefixo doc_{prestadorId}_ ou foto_{prestadorId}_)
import { readFileSync } from "node:fs";

const audit = JSON.parse(readFileSync("scripts/_adm_app_02d1_audit.out.json", "utf8"));
const linhas = audit.detalhe;

function guarda(path, prestadorId) {
  if (!path || !prestadorId) return false;
  const p = String(path).trim();
  const id = String(prestadorId).trim();
  return p.startsWith(`doc_${id}_`) || p.startsWith(`foto_${id}_`);
}

const buckets = {
  ok: [],
  sem_prestador: [],
  prestador_mas_path_fora_da_convencao: [],
  path_temp: [],
  url_vazia: [],
};

for (const r of linhas) {
  if (!r.path) {
    buckets.url_vazia.push(r);
    continue;
  }
  if (!r.prestador_id) {
    buckets.sem_prestador.push(r);
    continue;
  }
  if (guarda(r.path, r.prestador_id)) {
    buckets.ok.push(r);
  } else if (String(r.path).startsWith("foto_temp_")) {
    buckets.path_temp.push(r);
  } else {
    buckets.prestador_mas_path_fora_da_convencao.push(r);
  }
}

const resumo = {
  total_linhas: linhas.length,
  ok_guarda: buckets.ok.length,
  sem_prestador_orfaos: buckets.sem_prestador.length,
  path_temp: buckets.path_temp.length,
  fora_da_convencao: buckets.prestador_mas_path_fora_da_convencao.length,
  url_vazia: buckets.url_vazia.length,
  detalhe_fora_convencao: buckets.prestador_mas_path_fora_da_convencao.map((r) => ({
    id: r.id,
    prestador_id: r.prestador_id,
    tipo: r.tipo,
    path: r.path,
  })),
  detalhe_temp: buckets.path_temp.map((r) => ({
    id: r.id,
    prestador_id: r.prestador_id,
    tipo: r.tipo,
    path: r.path,
  })),
  detalhe_orfaos: buckets.sem_prestador.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    path: r.path,
  })),
};

console.log(JSON.stringify(resumo, null, 2));
