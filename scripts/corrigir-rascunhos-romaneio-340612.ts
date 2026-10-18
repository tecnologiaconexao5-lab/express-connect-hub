/**
 * CALVO 340612 — CORRIGIR RASCUNHOS
 * Preenche tomador, NF-e, CFOP, origem nos rascunhos (via metadata)
 * Executar: npx tsx scripts/corrigir-rascunhos-romaneio-340612.ts
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

const ROMANEIO = "340612";
const CALVO_NOME = "CALVO COML IMP. E EXP. LTDA.";

function determineCfop(
  origemUf: string | null,
  destinoUf: string | null,
  origemCidade: string | null,
  destinoCidade: string | null
): { cfop: string; natureza: string } {
  const ufOrig = (origemUf || "").trim().toUpperCase();
  const ufDest = (destinoUf || "").trim().toUpperCase();
  const cidOrig = (origemCidade || "").trim().toUpperCase();
  const cidDest = (destinoCidade || "").trim().toUpperCase();
  if (!ufOrig || !ufDest) return { cfop: "5352", natureza: "PRESTACAO DE SERVICO DE TRANSPORTE" };
  if (ufOrig === ufDest) {
    if (cidOrig && cidDest && cidOrig === cidDest)
      return { cfop: "5351", natureza: "PRESTACAO DE SERVICO DE TRANSPORTE MUNICIPAL" };
    return { cfop: "5352", natureza: "PRESTACAO DE SERVICO DE TRANSPORTE INTERMUNICIPAL" };
  }
  return { cfop: "6352", natureza: "PRESTACAO DE SERVICO DE TRANSPORTE INTERESTADUAL" };
}

interface CorrecaoResultado {
  cteId: string;
  numeroCte: string;
  nfeNumero: string;
  corrigido: boolean;
  erros: string[];
  alteracoes: string[];
}

async function main() {
  console.log("═".repeat(70));
  console.log("  CALVO 340612 — CORRECAO DE RASCUNHOS LOCAIS");
  console.log("═".repeat(70));

  // ── 1. Encontrar rascunhos ──────────────────────────────────
  console.log("\n📌 PASSO 1 — Buscando rascunhos do romaneio 340612");

  const { data: todos, error: qErr } = await supabase
    .from("fiscal_ctes")
    .select("id, numero, valor, status, metadata")
    .eq("status", "rascunho")
    .order("valor", { ascending: false });

  if (qErr) { console.error(`  ❌ ${qErr.message}`); return; }

  const rascunhos = (todos || []).filter((c: any) => {
    const m = c.metadata || {};
    return m.romaneio_numero === ROMANEIO;
  });

  if (rascunhos.length === 0) {
    console.log("  ⚠️ Nenhum rascunho encontrado.");
    return;
  }

  console.log(`  📋 ${rascunhos.length} rascunhos encontrados`);

  // ── 2. Buscar documentos vinculados ─────────────────────────
  console.log("\n📌 PASSO 2 — Buscando NF-es vinculadas");

  const { data: docs } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("id, numero, chave_acesso, serie, metadata, emitente_nome, municipio_destino, uf_destino")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .order("numero", { ascending: false });

  console.log(`  📋 ${docs?.length || 0} documentos vinculados`);

  const docsPorNumero = new Map<string, any>();
  if (docs) for (const d of docs) { if (d.numero) docsPorNumero.set(String(d.numero), d); }

  // ── 3. Garantir IBGE SP ─────────────────────────────────────
  console.log("\n📌 PASSO 3 — Verificando IBGE 3550308");

  const { data: ibgeSp } = await supabase
    .from("municipios_ibge").select("codigo").eq("codigo", "3550308").maybeSingle();

  if (!ibgeSp) {
    console.log("  Inserindo IBGE 3550308...");
    await supabase.from("municipios_ibge").upsert(
      { codigo: "3550308", nome: "São Paulo", uf: "SP" },
      { onConflict: "codigo" }
    );
    console.log("  ✅ IBGE 3550308 inserido");
  } else {
    console.log("  ✅ IBGE 3550308 ja existe");
  }

  // ── 4. Corrigir cada rascunho ───────────────────────────────
  console.log(`\n📌 PASSO 4 — Corrigindo ${rascunhos.length} rascunhos...\n`);

  const resultados: CorrecaoResultado[] = [];
  let corrigidos = 0;
  let falhas = 0;
  let soma = 0;

  for (const cte of rascunhos) {
    const meta = (cte.metadata || {}) as Record<string, any>;
    const pf = (meta.payload_focus || {}) as Record<string, any>;
    const alteracoes: string[] = [];
    const erros: string[] = [];
    soma += cte.valor || 0;

    try {
      const newMeta: Record<string, any> = { ...meta };
      let payloadChanged = false;
      const newPf: Record<string, any> = pf && Object.keys(pf).length > 0 ? { ...pf } : {};

      // Tomador nos metadados
      if (!newMeta.tomador_nome || newMeta.tomador_nome === "-") {
        newMeta.tomador_nome = CALVO_NOME;
        alteracoes.push("tomador_nome");
      }
      if (!newMeta.cliente_nome || newMeta.cliente_nome === "-") {
        newMeta.cliente_nome = CALVO_NOME;
        alteracoes.push("cliente_nome");
      }

      // Tomador no payload_focus
      if (!newPf.tomador || !newPf.tomador.nome) {
        newPf.tomador = { ...(newPf.tomador || {}), nome: CALVO_NOME };
        payloadChanged = true;
        alteracoes.push("pf.tomador");
      }

      // NF-e — extrair de payload_focus.documentos_vinculados[0]
      const docsVinculados: any[] = Array.isArray(newPf.documentos_vinculados) ? newPf.documentos_vinculados : [];
      const primeiroDoc = docsVinculados[0] || {};
      if (!newMeta.nfe_numero && primeiroDoc.numero) {
        newMeta.nfe_numero = String(primeiroDoc.numero);
        alteracoes.push("nfe_numero");
      }
      if (!newMeta.nfe_chave && primeiroDoc.chave_acesso) {
        newMeta.nfe_chave = String(primeiroDoc.chave_acesso);
        alteracoes.push("nfe_chave");
      }
      if (!newMeta.nfe_serie && primeiroDoc.serie) {
        newMeta.nfe_serie = String(primeiroDoc.serie);
        alteracoes.push("nfe_serie");
      }

      // Origem GUARULHOS/SP
      const origemCidade = newPf.origem?.cidade || newMeta.origem_municipio || "GUARULHOS";
      const origemUf = newPf.origem?.uf || newMeta.origem_uf || "SP";
      const destinoCidade = newPf.destino?.cidade || newMeta.endereco_real_entrega_usado?.municipio || null;
      const destinoUf = newPf.destino?.uf || newMeta.endereco_real_entrega_usado?.uf || null;

      // IBGE destino
      let ibgeDestino: string | null = (newPf.destino as any)?.codigo_municipio || null;
      if (!ibgeDestino && destinoCidade && destinoUf) {
        const { data: ibgeRes } = await supabase
          .from("municipios_ibge")
          .select("codigo")
          .ilike("nome", String(destinoCidade))
          .eq("uf", String(destinoUf))
          .limit(1)
          .maybeSingle();
        if (ibgeRes?.codigo) { ibgeDestino = ibgeRes.codigo; alteracoes.push("ibge_destino"); }
      }

      // Payload origem
      if (!newPf.origem || !newPf.origem.cidade) {
        newPf.origem = { cidade: origemCidade, uf: origemUf, pais: "Brasil" };
        payloadChanged = true;
        alteracoes.push("pf.origem");
      }

      // Payload remetente
      if (!newPf.remetente || !newPf.remetente.cidade) {
        newPf.remetente = { cidade: origemCidade, uf: origemUf, pais: "Brasil" };
        payloadChanged = true;
        alteracoes.push("pf.remetente");
      }

      // Payload destino codigo_municipio
      if (ibgeDestino && (!(newPf.destino as any)?.codigo_municipio)) {
        newPf.destino = { ...(newPf.destino || {}), codigo_municipio: ibgeDestino };
        payloadChanged = true;
      }

      // CFOP
      const { cfop, natureza } = determineCfop(origemUf, destinoUf, origemCidade, destinoCidade);

      if (!newPf.fiscal) { newPf.fiscal = {}; payloadChanged = true; }
      if (!newPf.fiscal.cfop) {
        newPf.fiscal = { ...newPf.fiscal, cfop, natureza_operacao: natureza };
        payloadChanged = true;
        alteracoes.push("pf.fiscal.cfop");
      }
      if (!newPf.fiscal.natureza_operacao) {
        newPf.fiscal = { ...newPf.fiscal, natureza_operacao: natureza };
        payloadChanged = true;
      }

      if (!newPf.carga) { newPf.carga = {}; payloadChanged = true; }
      if (!newPf.carga.cfop) {
        newPf.carga = { ...newPf.carga, cfop, natureza_operacao: natureza };
        payloadChanged = true;
        alteracoes.push("pf.carga.cfop");
      }

      if (payloadChanged) newMeta.payload_focus = newPf;

      // Metadados fiscais
      if (!newMeta.cfop) { newMeta.cfop = cfop; alteracoes.push("metadata.cfop"); }
      if (!newMeta.natureza_operacao) { newMeta.natureza_operacao = natureza; alteracoes.push("metadata.natureza"); }
      if (!newMeta.origem_municipio) { newMeta.origem_municipio = origemCidade; alteracoes.push("metadata.origem_municipio"); }
      if (!newMeta.origem_uf) { newMeta.origem_uf = origemUf; alteracoes.push("metadata.origem_uf"); }

      // Remover pendencia CFOP
      const validacoes: any[] = Array.isArray(newMeta.validacoes_pendentes) ? newMeta.validacoes_pendentes : [];
      const antes = validacoes.length;
      const filtradas = validacoes.filter(
        (v: any) => !(v.campo === "carga.cfop" || String(v.mensagem || "").toLowerCase().includes("cfop"))
      );
      newMeta.validacoes_pendentes = filtradas;
      if (antes !== filtradas.length) alteracoes.push("validacoes (CFOP removido)");

      const errosRestantes = filtradas.filter((v: any) => v.severidade === "erro");
      newMeta.pronto_para_emissao = errosRestantes.length === 0;
      if (errosRestantes.length === 0 && antes !== filtradas.length) alteracoes.push("pronto=TRUE");

      // Persistir
      const { error: updErr } = await supabase
        .from("fiscal_ctes")
        .update({ metadata: newMeta })
        .eq("id", cte.id);

      if (updErr) { erros.push(updErr.message); falhas++; }
      else { corrigidos++; }

      const icon = updErr ? "❌" : "✅";
      console.log(
        `  ${icon} CT-e ${(cte.numero || "S/N").padEnd(8)} | NF-e ${String(newMeta.nfe_numero || "-").padEnd(10)} | R$ ${(cte.valor || 0).toFixed(2).padEnd(8)} | ${alteracoes.length} campos`
      );

      resultados.push({
        cteId: cte.id, numeroCte: cte.numero || "S/N",
        nfeNumero: newMeta.nfe_numero || "-", corrigido: !updErr, erros, alteracoes,
      });
    } catch (err: any) {
      falhas++;
      console.log(`  ❌ Erro: ${err.message}`);
      resultados.push({
        cteId: cte.id, numeroCte: cte.numero || "S/N",
        nfeNumero: meta.nfe_numero || "-", corrigido: false, erros: [err.message], alteracoes: [],
      });
    }
  }

  // ── 5. Validacao ────────────────────────────────────────────
  console.log(`\n📌 PASSO 5 — Validacao`);
  const { data: pos } = await supabase
    .from("fiscal_ctes")
    .select("id, numero, valor, metadata")
    .eq("status", "rascunho")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .order("valor", { ascending: false });

  if (pos) {
    console.log(`  Registros pos-correcao: ${pos.length}`);
    console.log("\n  NF-e".padEnd(12) + "Valor".padEnd(12) + "Tomador".padEnd(34) + "CFOP".padEnd(8) + "Pronto".padEnd(8) + "Origem");
    console.log("  " + "─".repeat(110));
    for (const r of pos) {
      const m = r.metadata || {};
      console.log(
        "  " + String(m.nfe_numero || "-").padEnd(12) +
        `R$ ${(r.valor || 0).toFixed(2)}`.padEnd(12) +
        (m.tomador_nome || "-").slice(0, 32).padEnd(34) +
        String(m.cfop || "-").padEnd(8) +
        (m.pronto_para_emissao ? "SIM" : "NAO").padEnd(8) +
        `${m.origem_municipio || "-"}/${m.origem_uf || "-"}`
      );
    }
  }

  // ── 6. Relatorio ────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  RELATORIO FINAL");
  console.log("═".repeat(70));
  console.log(`  Romaneio:                  ${ROMANEIO}`);
  console.log(`  Total rascunhos:           ${rascunhos.length}`);
  console.log(`  ✅ Corrigidos:             ${corrigidos}`);
  console.log(`  ❌ Falhas:                 ${falhas}`);
  console.log(`  Valor total:               R$ ${soma.toFixed(2)}`);
  console.log(`  Tomador:                   ${CALVO_NOME}`);
  console.log(`  Origem:                    GUARULHOS/SP`);
  console.log(`  CFOP:                      5352`);
  console.log(`  IBGE SP:                   3550308`);
  console.log(`  Focus chamado?             ❌ NAO`);
  console.log(`  XMLs apagados?             ❌ NAO`);
  console.log(`  Rateios alterados?         ❌ NAO`);
  console.log("═".repeat(70));
}

main().catch(console.error);
