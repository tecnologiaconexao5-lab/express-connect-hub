import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
const LOGS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "logs");

function somenteNumeros(v: any): string { return String(v || "").replace(/[^0-9]/g, ""); }
function str(v: any): string { return (v != null ? String(v) : ""); }
function mask(s: string | null | undefined): string { if (!s) return "(vazio)"; if (s.length <= 10) return s; return s.slice(0, 6) + "***" + s.slice(-4); }

function converterPayload(payload: any, cliente?: any): Record<string, any> {
  const r: Record<string, any> = {};
  const emit = payload.emitente || {}, tom = payload.tomador || {}, rem = payload.remetente || {};
  const dest = payload.destinatario || payload.destino || {}, orig = payload.origem || {};
  const carga = payload.carga || {}, fisc = payload.fiscal || {}, vals = payload.valores || {};
  const docs = payload.documentos_vinculados || [];
  const regime = (emit.regime_tributario || "").toLowerCase();
  const oc = str(orig.cidade || rem.cidade || ""), ouf = str(orig.uf || rem.uf || "");
  const dc = str(dest.cidade || ""), duf = str(dest.uf || "");
  const co = orig.codigo_municipio || rem.codigo_municipio || null;
  const cd = dest.codigo_municipio || null;
  const vt = vals.valor_total ?? vals.valor_frete ?? 0;
  const rntrcRaw = somenteNumeros(emit.rntrc || "");
  const rv = (rntrcRaw.length === 8) ? rntrcRaw : (rntrcRaw ? rntrcRaw : "");
  const cnpjR = cliente?.cnpj || tom.cnpj || null;
  const ieR = cliente?.ie || tom.ie || null;
  const nomeR = cliente?.razao_social || cliente?.nome_fantasia || tom.nome || "";

  r.cfop = parseInt(str(carga.cfop || fisc.cfop || "0"), 10) || undefined;
  r.natureza_operacao = str(carga.natureza_operacao || fisc.natureza_operacao || "");
  r.data_emissao = new Date().toISOString(); r.tipo_documento = 0;
  r.municipio_envio = oc; r.uf_envio = ouf; r.municipio_inicio = oc; r.uf_inicio = ouf;
  r.municipio_fim = dc; r.uf_fim = duf;
  if (co) { r.codigo_municipio_envio = parseInt(co, 10); r.codigo_municipio_inicio = parseInt(co, 10); }
  else if (oc === "GUARULHOS" && ouf === "SP") { r.codigo_municipio_envio = 3518800; r.codigo_municipio_inicio = 3518800; }
  if (cd) { r.codigo_municipio_fim = parseInt(cd, 10); }
  else if (dc === "SAO PAULO" && duf === "SP") { r.codigo_municipio_fim = 3550308; }
  r.modal = str(payload.modal || "01"); r.tipo_servico = payload.tipo_servico ?? 0;
  r.cnpj_emitente = somenteNumeros(emit.cnpj || "");
  r.inscricao_estadual_emitente = str(emit.ie || emit.inscricao_estadual || "");
  r.nome_emitente = str(emit.nome || "");
  const endEmit = emit.endereco || {};
  if (endEmit.logradouro) {
    r.logradouro_emitente = str(endEmit.logradouro); r.numero_emitente = str(endEmit.numero || "");
    r.bairro_emitente = str(endEmit.bairro || ""); r.municipio_emitente = str(endEmit.cidade || "");
    r.cep_emitente = somenteNumeros(endEmit.cep || ""); r.uf_emitente = str(endEmit.uf || "");
  }
  if (regime.includes("normal")) r.regime_tributario_emitente = 3;
  else if (regime.includes("simples")) r.regime_tributario_emitente = 1;

  if (cnpjR) r.cnpj_remetente = somenteNumeros(cnpjR);
  r.nome_remetente = str(nomeR);
  if (cliente?.logradouro || rem.logradouro) {
    r.logradouro_remetente = str(cliente?.logradouro || rem.logradouro || "");
    r.numero_remetente = str(cliente?.numero || rem.numero || "");
    r.bairro_remetente = str(cliente?.bairro || rem.bairro || "");
    r.cep_remetente = somenteNumeros(cliente?.cep || rem.cep || "");
  }
  r.municipio_remetente = oc; r.uf_remetente = ouf;
  if (co) r.codigo_municipio_remetente = parseInt(co, 10);
  else if (cliente?.codigo_ibge) r.codigo_municipio_remetente = cliente.codigo_ibge;
  else if (oc === "GUARULHOS" && ouf === "SP") r.codigo_municipio_remetente = 3518800;
  r.pais_remetente = str(rem.pais || "Brasil"); r.codigo_pais_remetente = 1058;
  if (ieR && cnpjR) r.inscricao_estadual_remetente = str(ieR);

  r.nome_destinatario = str(dest.nome || nomeR || "");
  r.logradouro_destinatario = str(dest.logradouro || "");
  r.numero_destinatario = str(dest.numero || ""); r.bairro_destinatario = str(dest.bairro || "");
  r.municipio_destinatario = dc; r.uf_destinatario = duf;
  r.cep_destinatario = somenteNumeros(dest.cep || "");
  if (cd) r.codigo_municipio_destinatario = parseInt(cd, 10);
  else if (dc === "SAO PAULO" && duf === "SP") r.codigo_municipio_destinatario = 3550308;
  r.pais_destinatario = str(dest.pais || "Brasil"); r.codigo_pais_destinatario = 1058;

  r.tomador = 0;
  const ieTR = (ieR || tom.ie || "").trim().toUpperCase();
  if (ieTR === "ISENTO") r.indicador_inscricao_estadual_tomador = 2;
  else if (tom.indicador_ie === "2") r.indicador_inscricao_estadual_tomador = 2;
  else if (ieTR) r.indicador_inscricao_estadual_tomador = 1;
  else if (tom.indicador_ie === "9") r.indicador_inscricao_estadual_tomador = 9;
  else r.indicador_inscricao_estadual_tomador = 9;

  r.valor_total = vt; r.valor_receber = vt;
  if (regime.includes("simples")) { r.icms_indicador_simples_nacional = 1; r.icms_situacao_tributaria = "90_simples_nacional"; }
  else { r.icms_situacao_tributaria = "00"; }
  r.icms_base_calculo = fisc.icms_base_calculo ?? vt; r.icms_aliquota = fisc.icms_aliquota ?? 12;
  r.icms_valor = fisc.icms_valor ?? parseFloat((vt * 12 / 100).toFixed(2));
  r.valor_total_carga = carga.valor_declarado ?? 0;
  r.produto_predominante = str(carga.descricao || "");
  const peso = carga.peso_kg ?? 0;
  if (peso > 0) r.quantidades = [{ codigo_unidade_medida: "01", tipo_medida: "PESO BRUTO", quantidade: peso }];
  if (docs.length > 0) r.nfes = docs.filter((d: any) => d.chave_acesso).map((d: any) => ({ chave_nfe: str(d.chave_acesso || "") }));
  r.rntrc = rv; r.modal_rodoviario = { rntrc: rv };
  r.observacao = str(payload.observacao || ""); r.retirar_mercadoria = 1; r.detalhes_retirar = "";
  Object.keys(r).forEach(k => { if (r[k] === undefined || r[k] === null || r[k] === "") delete r[k]; });
  return r;
}

async function main() {
  console.log("═".repeat(70));
  console.log("  VALIDACAO FINAL — NF-e 2628647");
  console.log("═".repeat(70));

  // Get CT-e + Calvo from DB
  const { data: all } = await s.from("fiscal_ctes").select("id, metadata").filter("metadata->>romaneio_numero","eq","340612");
  const cte = all?.find((c: any) => c.metadata?.nfe_numero === "2628647") || null;
  if (!cte) { console.log("❌ CT-e nao encontrado"); return; }

  const meta = cte.metadata || {}, pf = meta.payload_focus || {};
  console.log(`CT-e: ${mask(cte.id)} | NF-e: ${meta.nfe_numero}`);

  // Get Calvo from clientes
  const { data: calvo } = await s.from("clientes").select("cnpj, ie, razao_social, nome_fantasia").or("razao_social.ilike.%calvo%,nome_fantasia.ilike.%calvo%").limit(1).maybeSingle();
  console.log(`Calvo no banco: ${calvo ? "✅ " + calvo.razao_social + " CNPJ " + mask(calvo.cnpj) : "❌"}`);

  // Use Calvo from DB or from payload
  const cliente = calvo && calvo.cnpj ? calvo : null;
  const po = converterPayload(pf, cliente);

  // Save
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOGS_DIR, "payload-focus-cte-final-pos-cadastro-oficial.json"), JSON.stringify(po, null, 2));

  // Validate
  const erros: string[] = [], avisos: string[] = [];
  const check = (c: string, v: any, o = true) => {
    if (o && (v === undefined || v === null || v === "" || (typeof v === "string" && v.trim() === ""))) { erros.push(`❌ ${c}: AUSENTE`); }
    else if (!o && (v === undefined || v === null || v === "")) { avisos.push(`⚠️ ${c}: vazio`); }
  };

  ["cfop","natureza_operacao","data_emissao","tipo_documento","modal","tipo_servico"].forEach(f => check(f, po[f]));
  ["municipio_envio","uf_envio","municipio_inicio","uf_inicio","municipio_fim","uf_fim"].forEach(f => check(f, po[f]));
  ["cnpj_emitente","inscricao_estadual_emitente","nome_emitente","logradouro_emitente","numero_emitente","bairro_emitente","cep_emitente","uf_emitente"].forEach(f => check(f, po[f]));
  ["cnpj_remetente","nome_remetente","logradouro_remetente","numero_remetente","bairro_remetente","municipio_remetente","uf_remetente","cep_remetente"].forEach(f => check(f, po[f]));
  check("inscricao_estadual_remetente", po.inscricao_estadual_remetente, true);
  check("codigo_municipio_remetente", po.codigo_municipio_remetente, false);
  ["nome_destinatario","logradouro_destinatario","numero_destinatario","bairro_destinatario","municipio_destinatario","uf_destinatario","cep_destinatario"].forEach(f => check(f, po[f]));
  check("codigo_municipio_destinatario", po.codigo_municipio_destinatario, false);
  ["valor_total","valor_receber"].forEach(f => check(f, po[f]));
  if (po.valor_total <= 0) erros.push("❌ valor_total <= 0");
  ["icms_situacao_tributaria","icms_indicador_simples_nacional","icms_base_calculo","icms_aliquota","icms_valor"].forEach(f => check(f, po[f]));
  check("rntrc", po.rntrc); check("modal_rodoviario.rntrc", po.modal_rodoviario?.rntrc);
  check("nfes", po.nfes);
  if (po.nfes?.length > 0 && po.nfes[0].chave_nfe?.length !== 44) erros.push("❌ chave_nfe sem 44 digitos");

  // Anti-aninhados
  ["emitente","fiscal","valores","origem","destino","remetente","destinatario","documentos_vinculados"].forEach(antigo => {
    if (po[antigo] !== undefined) erros.push(`❌ '${antigo}' no root`);
  });

  const fonteCalvo = calvo ? "tabela clientes" : "payload_focus do CT-e (fallback)";

  const resultado = {
    data: new Date().toISOString(), nfe: "2628647",
    cte_id: cte.id,
    calvo_fonte: fonteCalvo,
    calvo_cnpj: mask(cliente?.cnpj || pf.tomador?.cnpj),
    calvo_ie: mask(cliente?.ie || pf.tomador?.ie),
    erros: erros.length, lista_erros: erros,
    avisos: avisos.length, lista_avisos: avisos,
    pode_enviar: erros.length === 0,
    payload: po,
  };
  fs.writeFileSync(path.join(LOGS_DIR, "payload-focus-cte-final-pos-cadastro-validacao.json"), JSON.stringify(resultado, null, 2));

  console.log(`\nFonte Calvo: ${fonteCalvo}`);
  console.log(`Erros: ${erros.length} ${erros.length === 0 ? "✅" : "❌"}`);
  erros.forEach(e => console.log(`  ${e}`));
  console.log(`Avisos: ${avisos.length}`);
  avisos.forEach(a => console.log(`  ${a}`));
  console.log(`\nPode enviar para Focus? ${erros.length === 0 ? "✅ SIM" : "❌ NAO"}`);
  console.log(`JSONs salvos em ${LOGS_DIR}`);
  console.log("═".repeat(70));
}

main().catch(console.error);
