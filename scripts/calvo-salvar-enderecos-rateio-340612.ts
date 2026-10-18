/**
 * SCRIPT FISCAL EMERGENCIA CALVO — ROMANEIO 340612
 * Salva endereços reais (coluna Entrega) + rateio (coluna Rateio)
 * 
 * Executar: npx tsx scripts/calvo-salvar-enderecos-rateio-340612.ts
 * 
 * Regras:
 * - Não chamar Focus
 * - Não gerar produção
 * - Não alterar parser
 * - Não usar endereço fiscal do XML como entrega
 * - Endereço da observação = coluna Entrega do romaneio
 * - Município destino = município da coluna Entrega
 * - Valor de cada CT-e = valor da coluna Rateio
 * - Total do lote = soma dos rateios = R$ 600,00
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const ROMANEIO = "340612";
const VALOR_TOTAL_LOTE = 600.00;
const COD_IBGE_SAO_PAULO = "3550308";

interface EnderecoEntry {
  numero_nf: string;
  logradouro: string;
  numero_end: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  cep_formatado: string;
  completo: string;
  rateio: number;
}

const ENDERECOS: EnderecoEntry[] = [
  { numero_nf: "2628639", logradouro: "R. HUMAITÁ", numero_end: "107", bairro: "BELA VISTA", municipio: "SAO PAULO", uf: "SP", cep: "01504000", cep_formatado: "01504-000", completo: "R. HUMAITÁ, 107 - BELA VISTA - SAO PAULO/SP - CEP 01504-000", rateio: 6.25 },
  { numero_nf: "2628647", logradouro: "R NATINGUI", numero_end: "756", bairro: "VL MADALENA", municipio: "SAO PAULO", uf: "SP", cep: "05443001", cep_formatado: "05443-001", completo: "R NATINGUI, 756 - VL MADALENA - SAO PAULO/SP - CEP 05443-001", rateio: 118.75 },
  { numero_nf: "2628646", logradouro: "RUA JOAO MOURA", numero_end: "455", bairro: "PINHEIROS", municipio: "SAO PAULO", uf: "SP", cep: "05412001", cep_formatado: "05412-001", completo: "RUA JOAO MOURA, 455 - PINHEIROS - SAO PAULO/SP - CEP 05412-001", rateio: 6.25 },
  { numero_nf: "2628645", logradouro: "AV PAULO VI", numero_end: "136", bairro: "SUMARE", municipio: "SAO PAULO", uf: "SP", cep: "01262010", cep_formatado: "01262-010", completo: "AV PAULO VI, 136 - SUMARE - SAO PAULO/SP - CEP 01262-010", rateio: 6.25 },
  { numero_nf: "2628644", logradouro: "R. SAO JOAQUIM", numero_end: "129", bairro: "LIBERDADE", municipio: "SAO PAULO", uf: "SP", cep: "01504000", cep_formatado: "01504-000", completo: "R. SAO JOAQUIM, 129 - LIBERDADE - SAO PAULO/SP - CEP 01504-000", rateio: 68.75 },
  { numero_nf: "2628643", logradouro: "RUA SETE DE ABRIL", numero_end: "230", bairro: "CENTRO", municipio: "SAO PAULO", uf: "SP", cep: "01044000", cep_formatado: "01044-000", completo: "RUA SETE DE ABRIL, 230 - CENTRO - SAO PAULO/SP - CEP 01044-000", rateio: 6.25 },
  { numero_nf: "2628642", logradouro: "AV LINS DE VASCONCELOS", numero_end: "73", bairro: "CAMBUCI", municipio: "SAO PAULO", uf: "SP", cep: "01537000", cep_formatado: "01537-000", completo: "AV LINS DE VASCONCELOS, 73 - CAMBUCI - SAO PAULO/SP - CEP 01537-000", rateio: 25.00 },
  { numero_nf: "2628641", logradouro: "R. LÍBERO BADARÓ", numero_end: "382", bairro: "CENTRO HISTÓRICO DE SÃO PAULO", municipio: "SAO PAULO", uf: "SP", cep: "01008000", cep_formatado: "01008-000", completo: "R. LÍBERO BADARÓ, 382 - CENTRO HISTÓRICO DE SÃO PAULO - SAO PAULO/SP - CEP 01008-000", rateio: 62.50 },
  { numero_nf: "2628540", logradouro: "RUA PADRE JOÃO MANUEL", numero_end: "758", bairro: "CERQUEIRA CÉSAR", municipio: "SAO PAULO", uf: "SP", cep: "01411000", cep_formatado: "01411-000", completo: "RUA PADRE JOÃO MANUEL, 758 - CERQUEIRA CÉSAR - SAO PAULO/SP - CEP 01411-000", rateio: 12.50 },
  { numero_nf: "2628638", logradouro: "R. HUMAITÁ", numero_end: "107", bairro: "BELA VISTA", municipio: "SAO PAULO", uf: "SP", cep: "01504000", cep_formatado: "01504-000", completo: "R. HUMAITÁ, 107 - BELA VISTA - SAO PAULO/SP - CEP 01504-000", rateio: 6.25 },
  { numero_nf: "2628637", logradouro: "RUA BARAO DE CAMPINAS", numero_end: "631", bairro: "CAMPOS ELISEOS", municipio: "SAO PAULO", uf: "SP", cep: "01201001", cep_formatado: "01201-001", completo: "RUA BARAO DE CAMPINAS, 631 - CAMPOS ELISEOS - SAO PAULO/SP - CEP 01201-001", rateio: 131.25 },
  { numero_nf: "2628583", logradouro: "RUA BAR DE CAPANEMA", numero_end: "112", bairro: "CERQUEIRA CESAR", municipio: "SAO PAULO", uf: "SP", cep: "01411010", cep_formatado: "01411-010", completo: "RUA BAR DE CAPANEMA, 112 - CERQUEIRA CESAR - SAO PAULO/SP - CEP 01411-010", rateio: 50.00 },
  { numero_nf: "2628581", logradouro: "RUA BAR DE CAPANEMA", numero_end: "112", bairro: "CERQUEIRA CESAR", municipio: "SAO PAULO", uf: "SP", cep: "01411010", cep_formatado: "01411-010", completo: "RUA BAR DE CAPANEMA, 112 - CERQUEIRA CESAR - SAO PAULO/SP - CEP 01411-010", rateio: 50.00 },
  { numero_nf: "2628579", logradouro: "RUA BAR DE CAPANEMA", numero_end: "112", bairro: "CERQUEIRA CESAR", municipio: "SAO PAULO", uf: "SP", cep: "01411010", cep_formatado: "01411-010", completo: "RUA BAR DE CAPANEMA, 112 - CERQUEIRA CESAR - SAO PAULO/SP - CEP 01411-010", rateio: 31.25 },
  { numero_nf: "2628544", logradouro: "RUA PADRE JOÃO MANUEL", numero_end: "758", bairro: "CERQUEIRA CÉSAR", municipio: "SAO PAULO", uf: "SP", cep: "01411000", cep_formatado: "01411-000", completo: "RUA PADRE JOÃO MANUEL, 758 - CERQUEIRA CÉSAR - SAO PAULO/SP - CEP 01411-000", rateio: 12.50 },
  { numero_nf: "2628542", logradouro: "RUA PADRE JOÃO MANUEL", numero_end: "758", bairro: "CERQUEIRA CÉSAR", municipio: "SAO PAULO", uf: "SP", cep: "01411000", cep_formatado: "01411-000", completo: "RUA PADRE JOÃO MANUEL, 758 - CERQUEIRA CÉSAR - SAO PAULO/SP - CEP 01411-000", rateio: 6.25 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function divider(title: string): void {
  console.log("\n" + "═".repeat(70));
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

function buildObservacao(e: EnderecoEntry): string {
  return `ENTREGA: ${e.logradouro}, ${e.numero_end} - ${e.bairro} - ${e.municipio}/${e.uf} - CEP ${e.cep_formatado}`;
}

// ── Main ────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main(): Promise<void> {
  console.clear();
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  FISCAL EMERGÊNCIA CALVO — ROMANEIO 340612                     ║
║  Endereços (coluna Entrega) + Rateio (coluna Rateio)            ║
║  Total lote: R$ 600,00 — 16 NF-es                              ║
║  NÃO chama Focus. NÃO gera produção. NÃO altera parser.         ║
╚══════════════════════════════════════════════════════════════════╝
`);

  // ════════════════════════════════════════════════════════════════
  // TAREFA 1: Verificar XMLs importados
  // ════════════════════════════════════════════════════════════════
  divider("TAREFA 1 — SELECT INICIAL: XMLs do romaneio 340612");

  const { data: registros, error: errSelect } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("id,numero,emitente_nome,metadata")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .order("numero", { ascending: true });

  if (errSelect) {
    console.log("❌ ERRO no SELECT:", errSelect.message);
    process.exit(1);
  }

  if (!registros || registros.length === 0) {
    console.log("❌ NENHUM REGISTRO para romaneio", ROMANEIO);
    console.log("   XMLs/romaneio precisam ser reimportados.");
    process.exit(1);
  }

  const nfsEsperadas = ENDERECOS.map(e => e.numero_nf);
  const nfsEncontradas = registros.map((r: any) => r.numero);
  const faltantes = nfsEsperadas.filter(n => !nfsEncontradas.includes(n));

  console.log(`\n📋 ${registros.length} registro(s) encontrado(s):\n`);
  console.log("NF-e".padEnd(12) + "Fonte".padEnd(14) + "Pendente".padEnd(10) + "Endereço Real");
  console.log("─".repeat(100));
  for (const r of registros) {
    const meta = r.metadata || {};
    console.log(
      (r.numero || "S/N").padEnd(12) +
      (meta.fonte_endereco_entrega || "?").padEnd(14) +
      (meta.pendente_conferencia_endereco === true ? "SIM" : "não").padEnd(10) +
      (meta.endereco_completo || "(vazio)")
    );
  }

  if (faltantes.length > 0) {
    console.log(`\n❌ NF-es FALTANTES: ${faltantes.join(", ")}`);
    console.log("   ABORTANDO — reimporte os XMLs faltantes antes de continuar.");
    process.exit(1);
  }
  console.log(`\n✅ Todas as ${nfsEsperadas.length} NF-es encontradas.`);

  // ════════════════════════════════════════════════════════════════
  // TAREFA 4: Validar soma do rateio
  // ════════════════════════════════════════════════════════════════
  divider("TAREFA 4 — VALIDAR SOMA DO RATEIO");

  const somaRateio = ENDERECOS.reduce((acc, e) => acc + e.rateio, 0);
  const somaArredondada = Math.round(somaRateio * 100) / 100;
  console.log(`\n  Soma dos rateios: R$ ${somaArredondada.toFixed(2)}`);
  console.log(`  Valor esperado:   R$ ${VALOR_TOTAL_LOTE.toFixed(2)}`);

  if (Math.abs(somaArredondada - VALOR_TOTAL_LOTE) > 0.01) {
    console.log("\n❌ SOMA NÃO BATE COM R$ 600,00 — ABORTANDO!");
    console.log(`   Diferença: R$ ${(somaArredondada - VALOR_TOTAL_LOTE).toFixed(2)}`);
    process.exit(1);
  }
  console.log("✅ Soma confere: R$ 600,00");

  // ════════════════════════════════════════════════════════════════
  // TAREFA 2/3: UPDATE — endereços + rateio
  // ════════════════════════════════════════════════════════════════
  divider("TAREFA 2/3 — UPDATE: Endereços reais + Rateio");

  let atualizados = 0;
  const falhas: string[] = [];

  for (const endereco of ENDERECOS) {
    const registro = registros.find((r: any) => r.numero === endereco.numero_nf);
    if (!registro) {
      falhas.push(`NF-e ${endereco.numero_nf}: não encontrada`);
      continue;
    }

    const currentMeta = registro.metadata || {};

    const newMeta = {
      ...currentMeta,
      endereco_real_entrega: {
        logradouro: endereco.logradouro,
        numero: endereco.numero_end,
        bairro: endereco.bairro,
        municipio: endereco.municipio,
        uf: endereco.uf,
        cep: endereco.cep,
        codigo_ibge: COD_IBGE_SAO_PAULO,
        enderecoCompleto: endereco.completo,
        endereco_completo: endereco.completo,
        origem: "manual",
        confirmado: true,
      },
      fonte_endereco_entrega: "manual",
      pendente_conferencia_endereco: false,
      endereco_real_confirmado: true,
      endereco_completo: endereco.completo,
      valor_rateio_cte: endereco.rateio,
      romaneio_valor_total: VALOR_TOTAL_LOTE,
      romaneio_numero: ROMANEIO,
    };

    const { error } = await supabase
      .from("fiscal_documentos_vinculados")
      .update({ metadata: newMeta })
      .eq("id", registro.id)
      .filter("metadata->>romaneio_numero", "eq", ROMANEIO);

    if (error) {
      falhas.push(`NF-e ${endereco.numero_nf}: ${error.message}`);
      console.log(`  ❌ ${endereco.numero_nf} ERRO: ${error.message}`);
    } else {
      atualizados++;
      console.log(`  ✅ ${endereco.numero_nf.padEnd(9)} R$${endereco.rateio.toFixed(2).padStart(7)} → ${endereco.logradouro}, ${endereco.numero_end} - ${endereco.bairro}`);
    }
  }

  console.log(`\n  Atualizados: ${atualizados} | Falhas: ${falhas.length}`);
  if (falhas.length > 0) console.log("  Falhas:", falhas.join("; "));

  // ════════════════════════════════════════════════════════════════
  // TAREFA 6: Validar banco pós-update
  // ════════════════════════════════════════════════════════════════
  divider("TAREFA 6 — VALIDAÇÃO PÓS-UPDATE");

  const { data: posUpdate } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("numero,metadata")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .order("numero", { ascending: true });

  if (!posUpdate) {
    console.log("❌ ERRO ao consultar pós-update");
    process.exit(1);
  }

  console.log(`\n📋 ${posUpdate.length} registro(s):\n`);
  console.log(
    "NF-e".padEnd(12) +
    "Fonte".padEnd(10) +
    "Pendente".padEnd(10) +
    "Rateio".padEnd(10) +
    "Município".padEnd(18) +
    "Endereço Completo"
  );
  console.log("─".repeat(120));

  let somaPosUpdate = 0;
  let todosOk = true;

  for (const r of posUpdate) {
    const m = r.metadata || {};
    const rateio = m.valor_rateio_cte ?? 0;
    somaPosUpdate += rateio;

    const fonteOk = m.fonte_endereco_entrega === "manual";
    const pendOk = m.pendente_conferencia_endereco !== true;
    const endOk = !!m.endereco_completo;
    const rateioOk = typeof m.valor_rateio_cte === "number";
    const munOk = !!m.endereco_real_entrega?.municipio;

    const status = (fonteOk && pendOk && endOk && rateioOk && munOk) ? "✅" : "⚠️";

    console.log(
      status + " " +
      (r.numero || "?").padEnd(10) +
      (m.fonte_endereco_entrega || "?").padEnd(10) +
      (m.pendente_conferencia_endereco === true ? "SIM ❌" : "não").padEnd(10) +
      `R$ ${rateio.toFixed(2)}`.padEnd(10) +
      (m.endereco_real_entrega?.municipio || "?").padEnd(18) +
      (m.endereco_completo || "(vazio)").slice(0, 60)
    );

    if (!(fonteOk && pendOk && endOk && rateioOk && munOk)) todosOk = false;
  }

  console.log(`\n  Soma rateios pós-update: R$ ${somaPosUpdate.toFixed(2)}`);
  console.log(`  Todos os campos OK: ${todosOk ? "✅ SIM" : "❌ NÃO — verificar acima"}`);

  // ════════════════════════════════════════════════════════════════
  // TAREFA 10: Verificar IBGE
  // ════════════════════════════════════════════════════════════════
  divider("TAREFA 10 — CÓDIGO IBGE SAO PAULO/SP = 3550308");

  const { data: ibge } = await supabase
    .from("municipios_ibge")
    .select("codigo,nome,uf")
    .eq("codigo", COD_IBGE_SAO_PAULO)
    .maybeSingle();

  if (ibge) {
    console.log(`  ✅ Código ${COD_IBGE_SAO_PAULO} → ${ibge.nome}/${ibge.uf}`);
  } else {
    console.log(`  ⚠️  Código ${COD_IBGE_SAO_PAULO} NÃO encontrado na tabela municipios_ibge`);
    console.log(`      Verificar se a tabela está populada.`);
  }

  // Verificar total
  const { count: totalIbge } = await supabase
    .from("municipios_ibge")
    .select("*", { count: "exact", head: true });
  console.log(`  Total de registros em municipios_ibge: ${totalIbge ?? 0}`);

  // ════════════════════════════════════════════════════════════════
  // TAREFA 9: Verificar vínculo OS
  // ════════════════════════════════════════════════════════════════
  divider("TAREFA 9 — VERIFICAR VÍNCULO COM OS");

  const { data: docsComOs } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("numero,ordem_servico_id")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .not("ordem_servico_id", "is", null);

  const vinculados = docsComOs?.length || 0;

  if (vinculados > 0) {
    console.log(`  ✅ ${vinculados} documento(s) vinculado(s) a OS:`);
    for (const d of docsComOs || []) {
      console.log(`     NF-e ${d.numero} → OS ${d.ordem_servico_id}`);
    }
  } else {
    console.log("  ⚠️  NENHUM documento vinculado a OS.");
    console.log("     Vincule as NF-es na tela /fiscal?tab=cte antes de gerar CT-e.");
  }

  // ════════════════════════════════════════════════════════════════
  // TAREFA 11: Simulação prévia CT-e
  // ════════════════════════════════════════════════════════════════
  divider("TAREFA 11 — SIMULAÇÃO PRÉVIA CT-e (sem Focus)");

  console.log("\n📝 Observações que seriam geradas:\n");
  for (const e of ENDERECOS) {
    console.log(`  ${e.numero_nf} (R$${e.rateio.toFixed(2)}): ${buildObservacao(e)}`);
  }

  console.log("\n📊 Resumo do lote:");
  console.log(`  Total de CT-es previstos: ${ENDERECOS.length}`);
  console.log(`  Soma dos valores:        R$ ${somaArredondada.toFixed(2)}`);
  console.log(`  Município destino:       SAO PAULO/SP (IBGE: ${COD_IBGE_SAO_PAULO})`);

  // Distribuição por valor
  console.log("\n💵 Distribuição dos valores rateados:");
  const porValor = new Map<number, string[]>();
  for (const e of ENDERECOS) {
    const key = e.rateio;
    if (!porValor.has(key)) porValor.set(key, []);
    porValor.get(key)!.push(e.numero_nf);
  }
  for (const [valor, nfs] of [...porValor.entries()].sort((a, b) => b[0] - a[0])) {
    console.log(`  R$ ${valor.toFixed(2).padStart(7)} → ${nfs.length}x (${nfs.join(", ")})`);
  }

  // Bloqueios
  console.log("\n🔒 Verificação de bloqueios:");
  let bloqueios = 0;
  for (const r of posUpdate || []) {
    const m = r.metadata || {};
    const pendente = m.pendente_conferencia_endereco === true;
    const semMunicipio = !m.endereco_real_entrega?.municipio;
    const semRateio = typeof m.valor_rateio_cte !== "number";
    if (pendente || semMunicipio || semRateio) {
      bloqueios++;
      console.log(`  ❌ NF-e ${r.numero}: ${[pendente ? "pendente" : "", semMunicipio ? "sem município" : "", semRateio ? "sem rateio" : ""].filter(Boolean).join(", ")}`);
    }
  }
  console.log(bloqueios === 0 ? "  ✅ NENHUM bloqueio — todos prontos!" : `  ⚠️ ${bloqueios} bloqueio(s)`);

  // ════════════════════════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ════════════════════════════════════════════════════════════════
  divider("RELATÓRIO FINAL OBRIGATÓRIO");

  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│        RELATÓRIO FISCAL — CALVO — ROMANEIO 340612                   │
└─────────────────────────────────────────────────────────────────────┘
`);
  console.log(` 1. XMLs encontrados:                    ${registros.length}/16`);
  console.log(` 2. Endereços atualizados:               ${atualizados}/16`);
  console.log(` 3. Soma do rateio:                      R$ ${somaArredondada.toFixed(2)}`);
  console.log(` 4. Valor por NF-e:                      ${porValor.size} valores distintos (ver acima)`);
  console.log(` 5. Lista mostrou endereço completo?     ${todosOk ? "✅ SIM" : "❌ VERIFICAR"}`);
  console.log(` 6. Documentos vinculados a OS?          ${vinculados > 0 ? `✅ ${vinculados} vinculados` : "⚠️  NENHUM — vincular antes de CT-e"}`);
  console.log(` 7. IBGE SAO PAULO (3550308) encontrado? ${ibge ? "✅ SIM" : "⚠️  NÃO — verificar tabela municipios_ibge"}`);
  console.log(` 8. Prévia CT-e:                         ${bloqueios === 0 ? "✅ Pronto para gerar" : "❌ " + bloqueios + " bloqueio(s)"}`);
  console.log(` 9. Total dos CT-es:                     R$ ${somaArredondada.toFixed(2)} ${Math.abs(somaArredondada - 600) < 0.01 ? "✅" : "❌"}`);
  console.log(`10. Houve chamada Focus?                 ❌ NÃO (esperado)`);
  console.log(``);
  console.log(`11. Próximas etapas:`);
  console.log(`    a) Abrir /fiscal?tab=cte e dar Ctrl+Shift+R`);
  console.log(`    b) Validar que NF-es mostram "Entrega real: endereço completo"`);
  console.log(`    c) Vincular NF-es a uma OS`);
  console.log(`    d) Garantir IBGE SAO PAULO = 3550308 na tabela municipios_ibge`);
  console.log(`    e) Gerar CT-e rascunho/ prévia SEM Focus`);
  console.log(`    f) Validar observação e município destino`);
  console.log(`    g) Ajustar código para usar metadata.valor_rateio_cte (Task 8)`);

  console.log("\n" + "═".repeat(70));
  console.log("  FIM DO RELATÓRIO");
  console.log("═".repeat(70));
}

main().catch((err) => {
  console.error("❌ ERRO FATAL:", err);
  process.exit(1);
});
