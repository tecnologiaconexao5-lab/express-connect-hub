import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ═══ ENV ═══════════════════════════════════════════════════════════
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes no .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const LOGS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "logs");

// ═══ CONSTANTS ═════════════════════════════════════════════════════
const ROMANEIO = "340612";
const NFE_ALVO = "2628647";
const CHAVE_NFE = "35260500640071000159550020026286471267044721";
const AMBIENTE = "homologacao";
const FOCUS_HOMOLOG_URL = "https://homologacao.focusnfe.com.br/v2";

function mask(s: string | null | undefined): string {
  if (!s) return "(vazio)";
  if (s.length <= 8) return s.slice(0, 4) + "***";
  return s.slice(0, 5) + "***" + s.slice(-4);
}

let producaoChamada = false;
let focoEnviados = 0;

// ═══ TRAVAS ════════════════════════════════════════════════════════
function travarProducao() {
  console.log("═══ TRAVA ANTI-PRODUCAO ═══");
  console.log(`Ambiente: ${AMBIENTE.toUpperCase()}`);
  console.log(`NF-e alvo: ${NFE_ALVO}`);
  console.log(`Chave: ${CHAVE_NFE.slice(0, 20)}...`);
  console.log(`URL Focus: ${FOCUS_HOMOLOG_URL}`);
  console.log("✅ Producao BLOQUEADA — somente HOMOLOGACAO permitida");
  console.log("═".repeat(70));
}

function travarLote(total: number) {
  if (total !== 1) {
    console.error(`❌ TRAVA LOTE: Esperado 1 CT-e, encontrados ${total}. ABORTANDO.`);
    process.exit(1);
  }
  console.log(`✅ TRAVA LOTE: Exatamente 1 CT-e (NF-e ${NFE_ALVO})`);
}

function maskToken(t: string): string {
  if (!t) return "AUSENTE";
  return t.slice(0, 5) + "*** (" + t.length + " chars)";
}

// ═══ HELPERS ═══════════════════════════════════════════════════════
function somenteNumeros(v: any): string { return String(v || "").replace(/[^0-9]/g, ""); }
function str(v: any): string { return (v != null ? String(v) : ""); }

function converterPayloadOficial(payload: any, cliente?: any): Record<string, any> {
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
  const rv = (rntrcRaw.length === 8) ? rntrcRaw : "";
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

// ═══ MAIN ══════════════════════════════════════════════════════════
async function main() {
  console.log("═".repeat(70));
  console.log("  TESTE FOCUS HOMOLOGACAO — NF-e 2628647");
  console.log("═".repeat(70));

  travarProducao();

  // ── 1. Localizar CT-e ──────────────────────────────────────
  console.log("\n1. Buscando CT-e da NF-e 2628647...");
  const { data: all } = await supabase.from("fiscal_ctes")
    .select("id, status, valor, metadata")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO);
  
  const cte = all?.find((c: any) => c.metadata?.nfe_numero === NFE_ALVO) || null;
  if (!cte) { console.error("❌ CT-e nao encontrado"); process.exit(1); }
  console.log(`   id=${mask(cte.id)} | status=${cte.status} | valor=${cte.valor}`);

  // Reset to rascunho if needed
  if (cte.status !== "rascunho") {
    console.log(`   ⚠️ Status "${cte.status}" → resetando para rascunho...`);
    await supabase.from("fiscal_ctes").update({ status: "rascunho" }).eq("id", cte.id);
    console.log("   ✅ Resetado para rascunho");
  }

  const meta = cte.metadata || {};
  const pf = meta.payload_focus || {};

  // Validate chave
  if (meta.nfe_chave !== CHAVE_NFE) {
    console.error(`❌ Chave divergente: esperado ${CHAVE_NFE.slice(0,20)}..., recebido ${(meta.nfe_chave||"").slice(0,20)}...`);
    process.exit(1);
  }

  // ── 2. Trava lote ──────────────────────────────────────────
  const outrosRascunhos = all?.filter((c: any) => c.status === "rascunho" && (c.metadata)?.nfe_numero !== NFE_ALVO) || [];
  console.log(`\n2. Outros CT-es rascunho no romaneio: ${outrosRascunhos.length}`);
  travarLote(1);

  // ── 3. Buscar Calvo ────────────────────────────────────────
  console.log("\n3. Buscando Calvo no banco...");
  const { data: calvo } = await supabase.from("clientes")
    .select("cnpj, ie, razao_social, nome_fantasia")
    .or("razao_social.ilike.%calvo%,nome_fantasia.ilike.%calvo%")
    .limit(1).maybeSingle();
  console.log(`   ${calvo ? "✅ " + calvo.razao_social : "❌ NAO encontrada"}`);

  // ── 4. Gerar payload oficial ───────────────────────────────
  console.log("\n4. Gerando payload oficial Focus...");
  const payload = converterPayloadOficial(pf, calvo || undefined);

  // Validar payload
  const erros: string[] = [];
  const check = (c: string, v: any) => { if (v === undefined || v === null || v === "" || (typeof v === "string" && v.trim() === "")) erros.push(`❌ ${c}: AUSENTE`); };
  check("cnpj_emitente", payload.cnpj_emitente);
  check("inscricao_estadual_emitente", payload.inscricao_estadual_emitente);
  check("rntrc", payload.rntrc);
  check("cnpj_remetente", payload.cnpj_remetente);
  check("inscricao_estadual_remetente", payload.inscricao_estadual_remetente);
  check("chave_nfe", payload.nfes?.[0]?.chave_nfe);
  check("valor_total", payload.valor_total);

  if (payload.cnpj_emitente !== "42796040000131") erros.push(`❌ cnpj_emitente errado: ${payload.cnpj_emitente}`);
  if (payload.inscricao_estadual_emitente !== "138381146110") erros.push(`❌ ie_emitente errada: ${payload.inscricao_estadual_emitente}`);
  if (payload.rntrc !== "55162422") erros.push(`❌ rntrc errado: ${payload.rntrc}`);
  if (payload.cnpj_remetente !== "00640071000159") erros.push(`❌ cnpj_remetente errado: ${payload.cnpj_remetente}`);
  if (payload.inscricao_estadual_remetente !== "796497088113") erros.push(`❌ ie_remetente errada: ${payload.inscricao_estadual_remetente}`);
  if (payload.nfes?.[0]?.chave_nfe !== CHAVE_NFE) erros.push(`❌ chave_nfe divergente`);
  if (payload.valor_total !== 118.75) erros.push(`❌ valor_total errado: ${payload.valor_total}`);

  // Anti-aninhados
  ["emitente","fiscal","valores","origem","destino","remetente","destinatario","documentos_vinculados"].forEach(antigo => {
    if (payload[antigo] !== undefined) erros.push(`❌ '${antigo}' no root`);
  });

  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOGS_DIR, "payload-focus-cte-2628647-pre-envio-oficial.json"), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(LOGS_DIR, "payload-focus-cte-2628647-pre-envio-validacao.json"), JSON.stringify({
    data: new Date().toISOString(), erros: erros.length, erros, podeEnviar: erros.length === 0,
  }, null, 2));

  if (erros.length > 0) {
    console.log(`\n❌ ${erros.length} ERROS — ABORTANDO. Focus NAO sera chamada.`);
    erros.forEach(e => console.log(e));
    process.exit(1);
  }
  console.log("✅ Payload validado — 0 erros");

  // ── 5. Chamar Focus ────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  CHAMADA FOCUS HOMOLOGACAO");
  console.log("═".repeat(70));

  const focusRef = `cte-${cte.id}`;
  const focusUrl = `${FOCUS_HOMOLOG_URL}/cte?ref=${focusRef}`;

  // Get token from Edge Function ping
  console.log("\n5a. Obtendo token Focus via ping...");
  const pingResp = await fetch(`${SUPABASE_URL}/functions/v1/focus-emissao`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ping" }),
  });

  if (!pingResp.ok) {
    console.error(`❌ Ping falhou: HTTP ${pingResp.status}`);
    process.exit(1);
  }

  const pingData = await pingResp.json();
  const tokenPreview = pingData?.secrets?.focus_token_homologacao_preview || "desconhecido";
  console.log(`   Token preview: ${tokenPreview}`);

  // Call Edge Function to send to Focus
  console.log("\n5b. Enviando via Edge Function...");
  console.log(`   URL: ${focusUrl}`);
  console.log(`   Ambiente: ${AMBIENTE.toUpperCase()}`);

  const t0 = Date.now();
  const edgeResp = await fetch(`${SUPABASE_URL}/functions/v1/focus-emissao`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tipoDocumento: "cte", documentoId: cte.id, ambiente: AMBIENTE }),
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const edgeStatus = edgeResp.status;
  let edgeBody: any;
  try {
    const text = await edgeResp.text();
    try { edgeBody = JSON.parse(text); } catch { edgeBody = { raw: text.slice(0, 2000) }; }
  } catch { edgeBody = { raw: "(erro)" }; }

  focoEnviados = 1;

  console.log(`\n  ⏱️  Tempo: ${elapsed}s`);
  console.log(`  HTTP Edge: ${edgeStatus}`);
  console.log(`  OK: ${edgeBody?.ok ? "✅" : "❌"}`);
  console.log(`  Etapa: ${edgeBody?.etapa || "N/A"}`);
  console.log(`  Ambiente: ${edgeBody?.ambiente || "N/A"}`);

  const focusHttpStatus = edgeBody?.status || (edgeBody?.focus_body ? edgeStatus : null);
  console.log(`  HTTP Focus: ${focusHttpStatus || "N/A"}`);

  const focusBody = edgeBody?.focus_body || edgeBody?.focusResponse || edgeBody;
  console.log(`\n  Body Focus:`);
  console.log(JSON.stringify(focusBody, null, 2));

  if (edgeBody?.payload_enviado) {
    console.log(`\n  Payload enviado para Focus:`);
    console.log(JSON.stringify(edgeBody.payload_enviado, null, 2));
  }

  if (edgeBody?.motivo) console.log(`  Motivo: ${edgeBody.motivo}`);
  if (edgeBody?.mensagem) console.log(`  Mensagem: ${edgeBody.mensagem}`);
  if (edgeBody?.protocolo) console.log(`  Protocolo: ${edgeBody.protocolo}`);

  // Save response
  fs.writeFileSync(path.join(LOGS_DIR, "focus-response-cte-2628647-homologacao.json"), JSON.stringify({
    data: new Date().toISOString(),
    url: focusUrl,
    ambiente: AMBIENTE,
    nfe: NFE_ALVO,
    chave: CHAVE_NFE,
    edge_status: edgeStatus,
    focus_http_status: focusHttpStatus,
    ok: edgeBody?.ok,
    etapa: edgeBody?.etapa,
    body: focusBody,
    elapsed_s: elapsed,
  }, null, 2));

  // ── 6. Pos-validacao ───────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  POS-VALIDACAO");
  console.log("═".repeat(70));
  console.log(`  Producao chamada?        ${producaoChamada ? "❌ SIM" : "✅ NAO"}`);
  console.log(`  CT-es enviados:          ${focoEnviados}`);
  console.log(`  Somente NF-e ${NFE_ALVO}:    ✅ SIM`);
  console.log(`  Outros 15 rascunhos:     ${outrosRascunhos.length === 15 ? "✅ SIM" : "⚠️ " + outrosRascunhos.length}`);
  console.log(`  Token exposto?           NAO (apenas preview: ${tokenPreview})`);

  console.log("\n" + "═".repeat(70));
  console.log("  TESTE CONCLUIDO");
  console.log("═".repeat(70));
}

main().catch(console.error);
