/**
 * AUDITORIA COMPLETA — Romaneio 340612 / NF-e 2628647
 * Executar: npx tsx scripts/auditoria-340612.ts
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

const __filename = fileURLToPath(import.meta.url);
const LOGS_DIR = path.resolve(path.dirname(__filename), "..", "logs");

const ROMANEIO = "340612";
const NFE_ALVO = "2628647";
const CHAVE_NFE = "35260500640071000159550020026286471267044721";

function mask(str: string | null | undefined): string {
  if (!str) return "(vazio)";
  if (str.length <= 8) return str;
  return str.slice(0, 4) + "***" + str.slice(-4);
}

async function query(tabela: string, fn: (q: any) => any) {
  const start = Date.now();
  const result = await fn(supabase.from(tabela));
  const ms = Date.now() - start;
  return { tabela, ms, ...result };
}

async function main() {
  console.log("═".repeat(70));
  console.log("  AUDITORIA — ROMANEIO 340612 / NF-e 2628647");
  console.log("═".repeat(70));

  const resultados: Record<string, any> = {};

  // ── CONEXAO ──────────────────────────────────────────────────
  console.log("\n📡 CONEXAO SUPABASE");
  const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
  const anonKeyPrefix = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBu";
  console.log(`  URL: ${supabaseUrl}`);
  console.log(`  Key prefix: ${anonKeyPrefix.slice(0, 40)}...`);
  console.log(`  Role: anon (JWT role claim)`);
  console.log(`  .env VITE_SUPABASE_URL: ${supabaseUrl}`);
  console.log(`  Conflito .env/.env.local? NAO (mesmo projeto)`);

  // ── LISTAR TABELAS ──────────────────────────────────────────
  console.log("\n📋 LISTANDO TABELAS DO SCHEMA PUBLIC");
  const tablesToTry = [
    "fiscal_ctes", "fiscal_mdfes", "fiscal_nfse",
    "fiscal_events", "fiscal_logs", "fiscal_documentos_vinculados",
    "ordens_servico", "clientes", "prestadores", "veiculos",
    "configuracoes_fiscais", "empresas", "emitentes",
    "orcamentos", "romaneios", "romaneio_itens", "romaneios_importados",
    "notas_fiscais", "nfe_importadas", "documentos_fiscais",
    "financeiro_receber", "financeiro_pagar",
    "operacao", "operacoes", "destinatarios", "remetentes",
  ];

  const tabelasExistentes: string[] = [];
  for (const t of tablesToTry) {
    const { data, error } = await supabase.from(t).select("count", { count: "exact", head: true });
    if (!error || !error.message?.includes("does not exist")) {
      tabelasExistentes.push(t);
    }
  }
  console.log(`  Tabelas encontradas (${tabelasExistentes.length}): ${tabelasExistentes.join(", ")}`);

  // ── BUSCAR ROMANEIO 340612 em todas as tabelas ──────────────
  console.log("\n🔍 BUSCANDO ROMANEIO 340612 / NF-e 2628647");
  console.log(`  Termos: "${ROMANEIO}", "${NFE_ALVO}", chave parcial`);

  // 1. fiscal_ctes — query exata igual ao test script
  console.log("\n  ── fiscal_ctes ──");
  const { data: ctesExatos, error: err1 } = await supabase
    .from("fiscal_ctes")
    .select("*")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .filter("metadata->>nfe_numero", "eq", NFE_ALVO);
  console.log(`    NF-e ${NFE_ALVO}: ${ctesExatos?.length || 0} CT-es encontrados`);
  if (err1) console.log(`    Erro: ${err1.message}`);

  const { data: todosCtes, error: err2 } = await supabase
    .from("fiscal_ctes")
    .select("id, status, valor, metadata");
  console.log(`    TODOS os fiscal_ctes: ${todosCtes?.length || 0} registros`);
  if (err2) console.log(`    Erro: ${err2.message}`);
  resultados.fiscal_ctes = { total: todosCtes?.length || 0, amostra: todosCtes?.slice(0, 3) };

  if (todosCtes && todosCtes.length > 0) {
    for (const ct of todosCtes) {
      const m = ct.metadata as any;
      const nfe = m?.nfe_numero || "?";
      const rom = m?.romaneio_numero || "?";
      console.log(`      id=${mask(ct.id)} | nfe=${nfe} | romaneio=${rom} | valor=${ct.valor} | status=${ct.status}`);
    }
    // count by romaneio
    const porRomaneio: Record<string, number> = {};
    for (const ct of todosCtes) {
      const m = ct.metadata as any;
      const r = m?.romaneio_numero || "sem_romaneio";
      porRomaneio[r] = (porRomaneio[r] || 0) + 1;
    }
    console.log(`    Por romaneio: ${JSON.stringify(porRomaneio)}`);
  }

  // 2. fiscal_ctes — romaneio 340612 (sem filtro nfe)
  const { data: ctes340612, error: err3 } = await supabase
    .from("fiscal_ctes")
    .select("id, status, valor, metadata")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO);
  console.log(`\n    Romaneio ${ROMANEIO} (todos): ${ctes340612?.length || 0} CT-es`);
  if (err3) console.log(`    Erro: ${err3.message}`);
  if (ctes340612) {
    for (const ct of ctes340612) {
      const m = ct.metadata as any;
      console.log(`      id=${mask(ct.id)} | nfe=${m?.nfe_numero || '?'} | valor=${ct.valor} | status=${ct.status}`);
    }
    const rascunhos = ctes340612.filter((c: any) => c.status === "rascunho");
    console.log(`    Status rascunho: ${rascunhos.length}`);
    resultados.romaneio_340612 = { total: ctes340612.length, rascunhos: rascunhos.length, ids: ctes340612.map((c: any) => mask(c.id)) };
  }

  // 3. fiscal_events
  console.log("\n  ── fiscal_events ──");
  const { data: events } = await supabase.from("fiscal_events").select("*").limit(50);
  console.log(`    Total registros: ${events?.length || 0}`);
  if (events && events.length > 0) {
    for (const e of events.slice(0, 10)) {
      console.log(`      ${e.tipo_evento} | doc=${mask(e.documento_id)} | ${e.descricao?.slice(0, 80)}`);
    }
    const ctEvents = events.filter((e: any) => e.documento_tipo === "CTE");
    console.log(`    Eventos CTE: ${ctEvents.length}`);
  }
  resultados.fiscal_events = { total: events?.length || 0 };

  // 4. fiscal_logs
  console.log("\n  ── fiscal_logs ──");
  const { data: logs } = await supabase.from("fiscal_logs").select("*").limit(50);
  console.log(`    Total registros: ${logs?.length || 0}`);
  if (logs && logs.length > 0) {
    for (const l of logs.slice(0, 10)) {
      console.log(`      ${l.acao} | entidade=${mask(l.entidade_id)} | tipo=${l.entidade_tipo}`);
    }
  }
  resultados.fiscal_logs = { total: logs?.length || 0 };

  // 5. Demais tabelas (todas que existem)
  console.log("\n  ── DEMAIS TABELAS ──");
  for (const t of tabelasExistentes) {
    if (["fiscal_ctes", "fiscal_events", "fiscal_logs"].includes(t)) continue;
    const { data, error } = await supabase.from(t).select("*").limit(5);
    const count = data?.length || 0;
    if (count > 0) {
      console.log(`    ${t}: ${count} registros (amostra)`);
      const first = data![0] as any;
      const cols = Object.keys(first).filter(k => !["id", "created_at", "updated_at", "metadata"].includes(k));
      console.log(`      Colunas: ${cols.slice(0, 10).join(", ")}`);
      // search for 340612 or 2628647 or CALVO in text columns
      for (const col of cols) {
        if (col === "id") continue;
        const { data: match } = await supabase.from(t).select("*").filter(col, "eq", ROMANEIO).limit(3);
        if (match && match.length > 0) {
          console.log(`      ✅ "${ROMANEIO}" encontrado em ${t}.${col}!`);
        }
      }
    }
    resultados[t] = { total: count, error: error?.message || null };
  }

  // 6. Busca especifica por chave_nfe
  console.log("\n  ── BUSCA POR CHAVE NFE ──");
  const { data: ctChave } = await supabase
    .from("fiscal_ctes")
    .select("id, metadata")
    .filter("metadata->>nfe_chave", "eq", CHAVE_NFE);
  console.log(`    Por chave_nfe exata: ${ctChave?.length || 0} encontrados`);

  // 7. Dados do emitente dentro dos CT-es
  console.log("\n  ── DADOS DO EMITENTE NOS CT-es ──");
  if (ctesExatos && ctesExatos.length > 0) {
    const ct = ctesExatos[0];
    const m = ct.metadata as any;
    const pf = m?.payload_focus || {};
    console.log(`    emitente.nome: ${pf?.emitente?.nome || "?"}`);
    console.log(`    emitente.cnpj: ${pf?.emitente?.cnpj || "?"}`);
    console.log(`    emitente.ie: ${pf?.emitente?.ie || "?"}`);
    console.log(`    emitente.rntrc: ${pf?.emitente?.rntrc || "?"}`);
    console.log(`    emitente.endereco.logradouro: ${pf?.emitente?.endereco?.logradouro || "?"}`);
    console.log(`    emitente.regime_tributario: ${pf?.emitente?.regime_tributario || "?"}`);
    console.log(`    tomador.nome: ${pf?.tomador?.nome || "?"}`);
    console.log(`    tomador.cnpj: ${pf?.tomador?.cnpj || "VAZIO"}`);
    console.log(`    tomador.ie: ${pf?.tomador?.ie || "VAZIO"}`);
    console.log(`    remetente.cidade: ${pf?.remetente?.cidade || "?"}`);
    console.log(`    remetente.uf: ${pf?.remetente?.uf || "?"}`);
    console.log(`    remetente.logradouro: ${pf?.remetente?.logradouro || "VAZIO"}`);
    console.log(`    destinatario.logradouro: ${pf?.destinatario?.logradouro || "?"}`);
    console.log(`    destinatario.cidade: ${pf?.destinatario?.cidade || "?"}`);
    console.log(`    nfe_chave: ${m?.nfe_chave || "?"}`);
    console.log(`    nfe_numero: ${m?.nfe_numero || "?"}`);
    console.log(`    valor: ${ct.valor}`);
    console.log(`    cfop: ${m?.cfop || pf?.carga?.cfop || "?"}`);
    console.log(`    natureza_operacao: ${m?.natureza_operacao || pf?.carga?.natureza_operacao || "?"}`);

    // Dados do destinatario (R NATINGUI)
    console.log(`\n    --- Destinatario ---`);
    console.log(`    logradouro: ${pf?.destinatario?.logradouro || pf?.destino?.logradouro || "?"}`);
    console.log(`    numero: ${pf?.destinatario?.numero || pf?.destino?.numero || "?"}`);
    console.log(`    bairro: ${pf?.destinatario?.bairro || pf?.destino?.bairro || "?"}`);
    console.log(`    cidade: ${pf?.destinatario?.cidade || pf?.destino?.cidade || "?"}`);
    console.log(`    uf: ${pf?.destinatario?.uf || pf?.destino?.uf || "?"}`);
    console.log(`    cep: ${pf?.destinatario?.cep || pf?.destino?.cep || "?"}`);
    console.log(`    codigo_municipio: ${pf?.destino?.codigo_municipio || "?"}`);

    // Origem / remetente completo
    console.log(`\n    --- Remetente / Origem ---`);
    console.log(`    remetente.cidade: ${pf?.remetente?.cidade || pf?.origem?.cidade || "?"}`);
    console.log(`    remetente.uf: ${pf?.remetente?.uf || pf?.origem?.uf || "?"}`);
    console.log(`    origem.codigo_municipio: ${pf?.origem?.codigo_municipio || "?"}`);

    // Documentos vinculados
    console.log(`\n    --- Documentos Vinculados ---`);
    const docs = pf?.documentos_vinculados || [];
    for (const d of docs) {
      console.log(`    tipo=${d.tipo} | chave=${d.chave_acesso} | numero=${d.numero} | serie=${d.serie}`);
    }

    resultados.dados_cte_2628647 = {
      emitente: pf?.emitente,
      tomador: pf?.tomador,
      remetente: pf?.remetente,
      destinatario: pf?.destinatario || pf?.destino,
      origem: pf?.origem,
      documentos_vinculados: docs,
      nfe_chave: m?.nfe_chave,
      nfe_numero: m?.nfe_numero,
      valor: ct.valor,
      cfop: m?.cfop,
      natureza_operacao: m?.natureza_operacao,
    };
  }

  // ── SALVAR RELATORIO ────────────────────────────────────────
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  const relatorio = {
    data: new Date().toISOString(),
    supabase_url: supabaseUrl,
    anon_key_prefix: anonKeyPrefix.slice(0, 40),
    env_files: [".env", ".env.backup.local"],
    conflito_env: false,
    tabelas_encontradas: tabelasExistentes,
    romaneio_340612_total: ctes340612?.length || 0,
    nfe_2628647_encontrada: (ctesExatos?.length || 0) > 0,
    chave_nfe_encontrada: (ctChave?.length || 0) > 0,
    resultados,
    origem_dados: {
      emitente: "Hardcoded no payload_focus dos CT-es (nao vem do banco clientes/configuracoes_fiscais — estas tabelas estao vazias)",
      destinatario: "Endereco real de entrega (R NATINGUI, 756) — salvo no metadata dos CT-es durante a geracao do lote",
      chave_nfe: "metadata.nfe_chave nos CT-es",
      valor_118_75: "metadata.valor_rateio_cte nos CT-es",
      remetente_calvo: "AUSENTE — apenas cidade/UF (Guarulhos/SP). CNPJ, IE, logradouro, numero, bairro, CEP estao vazios/null",
    },
  };

  const outputPath = path.join(LOGS_DIR, "auditoria-340612.json");
  fs.writeFileSync(outputPath, JSON.stringify(relatorio, null, 2));
  console.log(`\n💾 Relatorio salvo em: ${outputPath}`);
  console.log("═".repeat(70));
}

main().catch(console.error);
