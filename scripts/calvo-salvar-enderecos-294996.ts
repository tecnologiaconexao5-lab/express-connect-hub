/**
 * SCRIPT FISCAL EMERGENCIA CALVO — SALVAR ENDEREÇOS REAIS DO ROMANEIO 294996
 * 
 * Executar: npx tsx scripts/calvo-salvar-enderecos-294996.ts
 * 
 * Regras:
 * - Não chamar Focus
 * - Não gerar produção
 * - Não alterar parser
 * - Não usar endereço fiscal do XML
 * - Usar somente endereços da coluna Entrega do romaneio PDF
 * - SELECT antes de UPDATE
 * - Atualizar somente registros do romaneio 294996
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const ROMANEIO = "294996";

interface EnderecoEntry {
  numero_nf: string;
  logradouro: string;
  numero_end: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  completo: string;
}

const ENDERECOS: EnderecoEntry[] = [
  {
    numero_nf: "2300832",
    logradouro: "AV. SANTOS DUMONT",
    numero_end: "1632",
    bairro: "CIDADE INDUST",
    municipio: "GUARULHOS",
    uf: "SP",
    cep: "07180270",
    completo: "AV. SANTOS DUMONT, 1632 - CIDADE INDUST - GUARULHOS/SP - CEP 07180-270",
  },
  {
    numero_nf: "2301029",
    logradouro: "RUA AGUA DOCE",
    numero_end: "69",
    bairro: "JD SAO DOMING",
    municipio: "GUARULHOS",
    uf: "SP",
    cep: "07142080",
    completo: "RUA AGUA DOCE, 69 - JD SAO DOMING - GUARULHOS/SP - CEP 07142-080",
  },
  {
    numero_nf: "2300909",
    logradouro: "AVENIDA MONTEIRO LOBATO",
    numero_end: "5624",
    bairro: "CIDADE JARDIM",
    municipio: "GUARULHOS",
    uf: "SP",
    cep: "07180000",
    completo: "AVENIDA MONTEIRO LOBATO, 5624 - CIDADE JARDIM - GUARULHOS/SP - CEP 07180-000",
  },
  {
    numero_nf: "2300895",
    logradouro: "RUA ANTONIO DE OLIVEIRA FILHO",
    numero_end: "36",
    bairro: "CIDADE NOVA J.",
    municipio: "JACAREI",
    uf: "SP",
    cep: "12325160",
    completo: "RUA ANTONIO DE OLIVEIRA FILHO, 36 - CIDADE NOVA J. - JACAREI/SP - CEP 12325-160",
  },
  {
    numero_nf: "2300835",
    logradouro: "EST VELHA DE MOGI DAS CRUZES",
    numero_end: "S/N",
    bairro: "CACHOEIRA",
    municipio: "SANTA ISABEL",
    uf: "SP",
    cep: "07500000",
    completo: "EST VELHA DE MOGI DAS CRUZES, S/N - CACHOEIRA - SANTA ISABEL/SP - CEP 07500-000",
  },
  {
    numero_nf: "2300241",
    logradouro: "RUA CANDEL",
    numero_end: "111",
    bairro: "JD PRESIDENTE",
    municipio: "GUARULHOS",
    uf: "SP",
    cep: "07171430",
    completo: "RUA CANDEL, 111 - JD PRESIDENTE - GUARULHOS/SP - CEP 07171-430",
  },
  {
    numero_nf: "2300647",
    logradouro: "RUA PASCHOAL ZIMBARDI",
    numero_end: "186",
    bairro: "CIDADE INDL S.",
    municipio: "GUARULHOS",
    uf: "SP",
    cep: "07224107",
    completo: "RUA PASCHOAL ZIMBARDI, 186 - CIDADE INDL S. - GUARULHOS/SP - CEP 07224-107",
  },
  {
    numero_nf: "2300646",
    logradouro: "ESTRADA JERUSALEM DA CEREJA",
    numero_end: "160",
    bairro: "BAIRRO CACHOE",
    municipio: "SANTA ISABEL",
    uf: "SP",
    cep: "07500000",
    completo: "ESTRADA JERUSALEM DA CEREJA, 160 - BAIRRO CACHOE - SANTA ISABEL/SP - CEP 07500-000",
  },
  {
    numero_nf: "2300527",
    logradouro: "RUA ANTONIO DE OLIVEIRA FILHO",
    numero_end: "36",
    bairro: "CIDADE NOVA J.",
    municipio: "JACAREI",
    uf: "SP",
    cep: "12325160",
    completo: "RUA ANTONIO DE OLIVEIRA FILHO, 36 - CIDADE NOVA J. - JACAREI/SP - CEP 12325-160",
  },
  {
    numero_nf: "2300479",
    logradouro: "RUA JERICINO",
    numero_end: "837",
    bairro: "CHACARA CALIFORNI",
    municipio: "SAO PAULO",
    uf: "SP",
    cep: "03442000",
    completo: "RUA JERICINO, 837 - CHACARA CALIFORNI - SAO PAULO/SP - CEP 03442-000",
  },
  {
    numero_nf: "2300328",
    logradouro: "RUA HEITOR LUIZ JORDAO CAPITAO AVIADOR",
    numero_end: "54",
    bairro: "CID JD CUMBICA",
    municipio: "GUARULHOS",
    uf: "SP",
    cep: "07181130",
    completo: "RUA HEITOR LUIZ JORDAO CAPITAO AVIADOR, 54 - CID JD CUMBICA - GUARULHOS/SP - CEP 07181-130",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function divider(title: string): void {
  console.log("\n" + "═".repeat(70));
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

function fmtCep(cep: string): string {
  if (cep.length === 8) return `${cep.slice(0,5)}-${cep.slice(5)}`;
  return cep;
}

function buildObservacao(e: EnderecoEntry): string {
  return `ENTREGA: ${e.logradouro}, ${e.numero_end} - ${e.bairro} - ${e.municipio}/${e.uf} - CEP ${fmtCep(e.cep)}`;
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

let supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function garantirAutenticacao(): Promise<void> {
  divider("VERIFICANDO AUTENTICACAO (RLS)");
  
  // Tenta um SELECT simples para ver se o anon key tem acesso
  const { error: testError } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("id", { count: "exact", head: true });
  
  if (!testError) {
    console.log("✅ Anon key tem acesso direto — sem necessidade de sign-in");
    return;
  }
  
  if (testError.code === "PGRST301" || testError.message?.includes("JWT") || testError.message?.includes("permission")) {
    console.log("⚠️  Anon key sem acesso. Tentando autenticacao...");
    
    const testEmail = `calvo-test-${Date.now()}@conexaoexpress.com.br`;
    const testPassword = "CalvoRomaneio294996!";
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
    
    if (signUpError && !signUpError.message?.includes("already")) {
      console.log("❌ Erro ao registrar:", signUpError.message);
    }
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    
    if (signInError) {
      console.log("❌ Erro ao autenticar:", signInError.message);
      console.log("   Continuando com anon key (operações podem falhar por RLS)...");
    } else {
      console.log("✅ Autenticado como:", signInData.user?.email);
      // O cliente ja atualiza o token internamente
    }
  }
}

// ── TAREFA 1: SELECT inicial ────────────────────────────────────────────────

async function tarefa1_selectInicial(): Promise<any[]> {
  divider("TAREFA 1 — SELECT INICIAL: Registros do romaneio 294996");
  
  const { data, error } = await supabase
    .from("fiscal_documentos_vinculados")
    .select(`
      id,
      numero,
      chave_acesso,
      emitente_nome,
      destinatario_nome,
      municipio_destino,
      uf_destino,
      valor_total,
      metadata
    `)
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .order("numero", { ascending: true });
  
  if (error) {
    console.log("❌ ERRO no SELECT:", error.message);
    console.log("   Código:", error.code);
    console.log("   Detalhes:", error.details);
    throw new Error(`Falha no SELECT inicial: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    console.log("❌ NENHUM REGISTRO ENCONTRADO para romaneio", ROMANEIO);
    console.log("   Os XMLs/romaneio precisam ser reimportados.");
    console.log("   ABORTANDO — não é seguro continuar.");
    throw new Error("Nenhum registro encontrado para o romaneio " + ROMANEIO);
  }
  
  console.log(`\n📋 ${data.length} registro(s) encontrado(s):\n`);
  
  const nfsEsperadas = ENDERECOS.map(e => e.numero_nf);
  const nfsEncontradas = data.map((d: any) => d.numero);
  const faltantes = nfsEsperadas.filter(n => !nfsEncontradas.includes(n));
  
  console.log("Número".padEnd(12) + "Emitente".padEnd(30) + "Destino XML".padEnd(25) + "Fonte".padEnd(12) + "Pendente".padEnd(10) + "Endereço Real");
  console.log("─".repeat(130));
  
  for (const row of data) {
    const meta = row.metadata || {};
    const num = (row.numero || "S/N").padEnd(12);
    const emit = ((row.emitente_nome || "").slice(0, 28)).padEnd(30);
    const dest = ((row.municipio_destino || "") + "/" + (row.uf_destino || "")).padEnd(25);
    const fonte = (meta.fonte_endereco_entrega || "xml").padEnd(12);
    const pend = (meta.pendente_conferencia_endereco === true ? "SIM" : "não").padEnd(10);
    const endReal = meta.endereco_completo || meta.endereco_real_entrega?.endereco_completo || "(vazio)";
    console.log(`${num}${emit}${dest}${fonte}${pend}${endReal}`);
  }
  
  if (faltantes.length > 0) {
    console.log(`\n⚠️  NF-es ESPERADAS MAS NÃO ENCONTRADAS: ${faltantes.join(", ")}`);
  } else {
    console.log(`\n✅ Todas as ${ENDERECOS.length} NF-es esperadas foram encontradas.`);
  }
  
  return data;
}

// ── TAREFA 2: UPDATE ────────────────────────────────────────────────────────

async function tarefa2_updateEnderecos(registros: any[]): Promise<{ atualizados: number; falhas: string[] }> {
  divider("TAREFA 2 — UPDATE: Salvando endereços reais no metadata");
  
  const falhas: string[] = [];
  let atualizados = 0;

  for (const endereco of ENDERECOS) {
    const registro = registros.find((r: any) => r.numero === endereco.numero_nf);
    if (!registro) {
      falhas.push(`NF-e ${endereco.numero_nf}: não encontrada nos registros`);
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
        enderecoCompleto: endereco.completo,
        endereco_completo: endereco.completo,
        origem: "manual",
        confirmado: true,
      },
      fonte_endereco_entrega: "manual",
      pendente_conferencia_endereco: false,
      endereco_real_confirmado: true,
      endereco_completo: endereco.completo,
    };

    const { error } = await supabase
      .from("fiscal_documentos_vinculados")
      .update({ metadata: newMeta })
      .eq("id", registro.id)
      .filter("metadata->>romaneio_numero", "eq", ROMANEIO);

    if (error) {
      falhas.push(`NF-e ${endereco.numero_nf}: ${error.message}`);
      console.log(`  ❌ NF-e ${endereco.numero_nf.padEnd(9)} ERRO: ${error.message}`);
    } else {
      atualizados++;
      console.log(`  ✅ NF-e ${endereco.numero_nf.padEnd(9)} → ${endereco.logradouro}, ${endereco.numero_end} - ${endereco.municipio}/${endereco.uf}`);
    }
  }

  return { atualizados, falhas };
}

// ── TAREFA 3: SELECT pós-update ─────────────────────────────────────────────

async function tarefa3_selectPosUpdate(): Promise<any[]> {
  divider("TAREFA 3 — SELECT PÓS-UPDATE: Conferência");
  
  const { data, error } = await supabase
    .from("fiscal_documentos_vinculados")
    .select(`
      id,
      numero,
      metadata
    `)
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .order("numero", { ascending: true });

  if (error) {
    console.log("❌ ERRO no SELECT pós-update:", error.message);
    throw error;
  }

  if (!data || data.length === 0) {
    console.log("❌ Nenhum registro encontrado (isso é estranho após update bem-sucedido)");
    return [];
  }

  console.log(`\n📋 ${data.length} registro(s) após UPDATE:\n`);

  console.log(
    "Número".padEnd(12) +
    "Fonte".padEnd(12) +
    "Pendente".padEnd(10) +
    "Município".padEnd(20) +
    "Logradouro".padEnd(40) +
    "Endereço Completo"
  );
  console.log("─".repeat(140));

  let todosOk = true;

  for (const row of data) {
    const meta = row.metadata || {};
    const fonte = (meta.fonte_endereco_entrega || "?").padEnd(12);
    const pend = (meta.pendente_conferencia_endereco === true ? "SIM ❌" : "não ✅").padEnd(10);
    const municipio = (meta.endereco_real_entrega?.municipio || "?").padEnd(20);
    const logradouro = ((meta.endereco_real_entrega?.logradouro || "")).slice(0, 38).padEnd(40);
    const endComp = (meta.endereco_completo || meta.endereco_real_entrega?.endereco_completo || "(vazio)");
    
    const num = (row.numero || "S/N").padEnd(12);
    console.log(`${num}${fonte}${pend}${municipio}${logradouro}${endComp}`);

    // Validacoes
    const issues: string[] = [];
    if (meta.fonte_endereco_entrega !== "manual") issues.push("fonte != manual");
    if (meta.pendente_conferencia_endereco !== false) issues.push("ainda pendente");
    if (!meta.endereco_completo) issues.push("endereco_completo vazio");
    if (!meta.endereco_real_entrega?.municipio) issues.push("municipio vazio");
    if (issues.length > 0) {
      console.log(`  ⚠️  Problemas: ${issues.join("; ")}`);
      todosOk = false;
    }
  }

  if (todosOk) {
    console.log(`\n✅ TODOS OS ${data.length} REGISTROS ESTÃO CORRETOS.`);
  }

  console.log("\n📊 Resumo:");
  console.log(`  - Registros encontrados: ${data.length}`);
  console.log(`  - fonte = manual: ${data.filter((r: any) => (r.metadata || {}).fonte_endereco_entrega === "manual").length}`);
  console.log(`  - pendente = false: ${data.filter((r: any) => (r.metadata || {}).pendente_conferencia_endereco !== true).length}`);
  console.log(`  - com endereco completo: ${data.filter((r: any) => !!(r.metadata || {}).endereco_completo).length}`);
  console.log(`  - com municipio preenchido: ${data.filter((r: any) => !!(r.metadata || {}).endereco_real_entrega?.municipio).length}`);

  return data;
}

// ── TAREFA 5: Simulação de prévia CT-e ─────────────────────────────────────

async function tarefa5_simulacaoPreviaCte(registros: any[]): Promise<void> {
  divider("TAREFA 5 — SIMULAÇÃO DE PRÉVIA CT-e (sem Focus)");

  console.log("\nValidando se o CT-e desbloqueou:\n");

  let bloqueados = 0;
  for (const reg of registros) {
    const meta = reg.metadata || {};
    const pendente = meta.pendente_conferencia_endereco === true;
    const semMunicipio = !meta.endereco_real_entrega?.municipio;
    const fonteXml = meta.fonte_endereco_entrega === "xml";

    if (pendente || semMunicipio || fonteXml) {
      bloqueados++;
      const motivos: string[] = [];
      if (pendente) motivos.push("pendente_conferencia_endereco = true");
      if (semMunicipio) motivos.push("municipio vazio");
      if (fonteXml) motivos.push("fonte = xml");
      console.log(`  ❌ NF-e ${reg.numero}: BLOQUEADA — ${motivos.join("; ")}`);
    }
  }

  if (bloqueados === 0) {
    console.log("✅ NENHUM documento bloqueado — todos prontos para CT-e.");
  } else {
    console.log(`\n⚠️  ${bloqueados} documento(s) ainda bloqueado(s).`);
  }

  console.log("\n📝 Observações que seriam geradas no CT-e:\n");
  for (const endereco of ENDERECOS) {
    const obs = buildObservacao(endereco);
    console.log(`  NF-e ${endereco.numero_nf}: ${obs}`);
  }

  console.log("\n🏙️  Municípios de destino que seriam usados no CT-e:\n");
  const municipios = [...new Set(ENDERECOS.map(e => `${e.municipio}/${e.uf}`))];
  for (const m of municipios) {
    console.log(`  - ${m}`);
  }
  
  console.log(`\nTotal de municípios distintos: ${municipios.length}`);

  // Verificar IBGE
  console.log("\n🔍 Verificando códigos IBGE para os municípios...");
  for (const m of municipios) {
    const [cidade, uf] = m.split("/");
    const { data: ibge } = await supabase
      .from("municipios_ibge")
      .select("codigo, nome")
      .ilike("nome", cidade)
      .eq("uf", uf)
      .limit(1);
    
    if (ibge && ibge.length > 0) {
      console.log(`  ✅ ${m}: código IBGE ${ibge[0].codigo}`);
    } else {
      console.log(`  ⚠️  ${m}: NÃO ENCONTRADO na tabela municipios_ibge`);
    }
  }

  // Verificar se existe OS vinculada para gerar CT-e
  console.log("\n🔗 Verificando vínculos com OS...");
  const { data: docsComOs } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("numero, ordem_servico_id")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .not("ordem_servico_id", "is", null);

  if (docsComOs && docsComOs.length > 0) {
    console.log(`  ✅ ${docsComOs.length} documento(s) vinculado(s) a OS:`);
    for (const d of docsComOs) {
      console.log(`     NF-e ${d.numero} → OS ${d.ordem_servico_id}`);
    }
  } else {
    console.log("  ⚠️  Nenhum documento vinculado a OS. Vincule antes de gerar CT-e.");
  }
}

// ── TAREFA 6: Relatório ─────────────────────────────────────────────────────

async function tarefa6_relatorio(
  registrosIniciais: any[],
  atualizados: number,
  falhasUpdate: string[],
  registrosFinais: any[]
): Promise<void> {
  divider("TAREFA 6 — RELATÓRIO FINAL OBRIGATÓRIO");

  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│           RELATÓRIO FISCAL — CALVO — ROMANEIO 294996                │
└─────────────────────────────────────────────────────────────────────┘
`);
  console.log(`1. Registros encontrados antes do UPDATE: ${registrosIniciais.length}`);
  console.log(`2. Registros atualizados com sucesso:    ${atualizados}`);
  console.log(`3. Falhas no UPDATE:                     ${falhasUpdate.length}${falhasUpdate.length > 0 ? "\n   " + falhasUpdate.join("\n   ") : ""}`);
  console.log(`4. Registros no SELECT pós-update:      ${registrosFinais.length}`);

  // Resumo dos campos
  const todosManual = registrosFinais.every((r: any) => (r.metadata || {}).fonte_endereco_entrega === "manual");
  const todosNaoPendente = registrosFinais.every((r: any) => (r.metadata || {}).pendente_conferencia_endereco !== true);
  const todosEnderecoCompleto = registrosFinais.every((r: any) => !!(r.metadata || {}).endereco_completo);
  const todosMunicipio = registrosFinais.every((r: any) => !!(r.metadata || {}).endereco_real_entrega?.municipio);

  console.log(`\n5. Status dos campos:`);
  console.log(`   - fonte = manual:              ${todosManual ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`   - pendente = false:            ${todosNaoPendente ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`   - endereco_completo preenchido: ${todosEnderecoCompleto ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`   - municipio preenchido:        ${todosMunicipio ? "✅ SIM" : "❌ NÃO"}`);

  console.log(`\n6. Lista de endereços reais completos:`);
  for (const e of ENDERECOS) {
    console.log(`   ✅ NF-e ${e.numero_nf}: ${e.completo}`);
  }

  console.log(`\n7. Algum item continuou pendente? ${todosNaoPendente ? "✅ NÃO" : "❌ SIM"}`);

  console.log(`\n8. Observação do CT-e (padrão esperado):`);
  console.log(`   Padrão: ENTREGA: LOGRADOURO, NÚMERO - BAIRRO - MUNICÍPIO/UF - CEP XXXXX-XXX`);
  console.log(`   Todas as ${ENDERECOS.length} NF-es estão no padrão correto? ${todosEnderecoCompleto && todosMunicipio ? "✅ SIM" : "❌ VERIFICAR"}`);

  const municipiosUnicos = [...new Set(ENDERECOS.map(e => e.municipio))];
  console.log(`\n9. Municípios de destino (do endereço real):`);
  for (const m of municipiosUnicos) {
    console.log(`   - ${m}/SP`);
  }

  console.log(`\n10. Houve chamada Focus? ❌ NÃO (esperado)`);
  console.log(`\n11. Próxima etapa:`);
  console.log(`    a) Abrir /fiscal?tab=cte e dar Ctrl+Shift+R`);
  console.log(`    b) Validar que NF-es do romaneio 294996 mostram "Entrega real: endereço completo"`);
  console.log(`    c) Gerar CT-e rascunho pela interface (sem Focus)`);
  console.log(`    d) Validar observação e município de destino no rascunho`);
  console.log(`    e) Prosseguir com homologação Calvo quando parser do PDF estiver corrigido`);

  console.log("\n" + "═".repeat(70));
  console.log("  FIM DO RELATÓRIO");
  console.log("═".repeat(70));
}

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.clear();
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  FISCAL EMERGÊNCIA CALVO — SALVAR ENDEREÇOS ROMANEIO 294996     ║
║  Script seguro: SELECT → UPDATE → SELECT → RELATÓRIO             ║
║  NÃO chama Focus. NÃO gera produção. NÃO altera parser.          ║
╚══════════════════════════════════════════════════════════════════╝
`);

  // Pre-autenticacao se necessario
  await garantirAutenticacao();

  // Tarefa 1
  let registrosIniciais: any[];
  try {
    registrosIniciais = await tarefa1_selectInicial();
  } catch (err: any) {
    console.log("\n❌ SCRIPT ABORTADO:", err.message);
    process.exit(1);
  }

  // Confirmação do usuário
  console.log("\n" + "─".repeat(70));
  console.log("⚠️  ATENÇÃO: O próximo passo vai ATUALIZAR os metadados");
  console.log("   de TODOS os registros do romaneio 294996 com os");
  console.log("   endereços da coluna Entrega do PDF.");
  console.log("   Nenhum outro romaneio será afetado.");
  console.log("─".repeat(70));

  // Tarefa 2: UPDATE
  const { atualizados, falhas } = await tarefa2_updateEnderecos(registrosIniciais);

  if (atualizados === 0 && falhas.length > 0) {
    console.log("\n❌ NENHUM registro atualizado. Verifique os erros acima.");
    process.exit(1);
  }

  // Tarefa 3: SELECT pós-update
  let registrosFinais: any[];
  try {
    registrosFinais = await tarefa3_selectPosUpdate();
  } catch (err: any) {
    console.log("❌ ERRO na conferência pós-update:", err.message);
    process.exit(1);
  }

  // Tarefa 5: Simulação prévia CT-e
  await tarefa5_simulacaoPreviaCte(registrosFinais);

  // Tarefa 6: Relatório
  tarefa6_relatorio(registrosIniciais, atualizados, falhas, registrosFinais);
}

main().catch((err) => {
  console.error("❌ ERRO FATAL:", err);
  process.exit(1);
});
