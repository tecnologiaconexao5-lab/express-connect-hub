/**
 * configurar-emitente-real-conexao.ts
 *
 * Configura o emitente fiscal real da Conexao Express no TMS:
 * - Desativa placeholders (CNPJ ficticios)
 * - Insere registro real em configuracoes_fiscais
 * - Propaga emitente para os 16 rascunhos do romaneio Calvo 340612
 *
 * Executar: npm run configurar:emitente-real
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

const EMITENTE_REAL = {
  razao_social: "CONEXAO SERVICOES EXPRESS LTDA",
  nome_fantasia: "CONEXÃO EXPRESS",
  cnpj: "42.796.040/0001-31",
  ie: "138381146110",
  inscricao_municipal: "6.996.597-8",
  regime_tributario: "Simples Nacional",
  email: "financeiro@conexaoexpress.com.br",
  telefone: "(11) 94980-7070",
  logradouro: "Rua Antônio Macedo",
  numero: "45",
  bairro: "Parque São Jorge",
  cidade: "São Paulo",
  uf: "SP",
  cep: "03087-010",
  codigo_ibge: "3550308",
  ambiente_fiscal: "homologacao",
  rntrc: "55162422",
  ativo: true,
  padrao: true,
};

const CNPJS_PLACEHOLDER = [
  "00.000.000/0001-99",
  "11.111.111/0001-11",
];

const IES_PLACEHOLDER = ["987654321", "123456789", "000000000"];

const ROMANEIO = "340612";

// ============================================================================
// ETAPA 1: Desativar placeholders
// ============================================================================
async function desativarPlaceholders() {
  console.log("━".repeat(60));
  console.log("  ETAPA 1 — Desativar emitentes placeholder");
  console.log("━".repeat(60));

  const { data: todos } = await supabase.from("configuracoes_fiscais").select("*");
  if (!todos?.length) {
    console.log("  Nenhum registro encontrado.");
    return;
  }

  for (const cfg of todos) {
    const cnpjNum = (cfg.cnpj || "").replace(/[^0-9]/g, "");
    const ieVal = (cfg.ie || "").trim();
    const isPlaceholderCnpj = CNPJS_PLACEHOLDER.includes(cfg.cnpj) ||
      ["11111111000111", "00000000000000", "00000000000199"].includes(cnpjNum);
    const isPlaceholderIe = IES_PLACEHOLDER.includes(ieVal);
    const isPlaceholder = isPlaceholderCnpj || isPlaceholderIe;
    const isReal = cfg.cnpj === EMITENTE_REAL.cnpj;

    if (isReal) {
      console.log(`  ⏭️  Mantido (CNPJ real): ${cfg.razao_social} (CNPJ ${cfg.cnpj})`);
      continue;
    }

    if (isPlaceholder && cfg.ativo) {
      const { error } = await supabase
        .from("configuracoes_fiscais")
        .update({ ativo: false, padrao: false })
        .eq("id", cfg.id);

      if (error) {
        console.log(`  ❌ ERRO ao desativar ${cfg.razao_social}: ${error.message}`);
      } else {
        console.log(`  ✅ DESATIVADO: ${cfg.razao_social} (CNPJ ${cfg.cnpj})`);
      }
    } else if (cfg.ativo && !isPlaceholder) {
      console.log(`  ⚠️  MANTIDO ativo (CNPJ desconhecido): ${cfg.razao_social} (CNPJ ${cfg.cnpj}) — verificar se e placeholder`);
    } else {
      console.log(`  ⏭️  Ja inativo: ${cfg.razao_social}`);
    }
  }
}

// ============================================================================
// ETAPA 2: Inserir emitente real
// ============================================================================
async function inserirEmitenteReal() {
  console.log("\n" + "━".repeat(60));
  console.log("  ETAPA 2 — Inserir emitente fiscal real");
  console.log("━".repeat(60));

  // Verificar se ja existe registro com esse CNPJ
  const { data: existente } = await supabase
    .from("configuracoes_fiscais")
    .select("*")
    .eq("cnpj", EMITENTE_REAL.cnpj)
    .maybeSingle();

  if (existente) {
    console.log(`  Registro existente encontrado (id: ${existente.id.slice(0, 12)}...). Atualizando...`);
    const { error } = await supabase
      .from("configuracoes_fiscais")
      .update({ ...EMITENTE_REAL })
      .eq("id", existente.id);

    if (error) {
      console.log(`  ❌ ERRO ao atualizar: ${error.message}`);
      return null;
    }
    console.log(`  ✅ ATUALIZADO: ${EMITENTE_REAL.razao_social}`);
    console.log(`     CNPJ: ${EMITENTE_REAL.cnpj} | IE: ${EMITENTE_REAL.ie}`);
    return existente.id;
  }

  // Inserir novo
  const { data: novo, error } = await supabase
    .from("configuracoes_fiscais")
    .insert([{ ...EMITENTE_REAL }])
    .select("*")
    .single();

  if (error) {
    console.log(`  ❌ ERRO ao inserir: ${error.message}`);
    console.log(`     Detalhes: ${JSON.stringify(error)}`);
    return null;
  }

  console.log(`  ✅ INSERIDO: ${EMITENTE_REAL.razao_social}`);
  console.log(`     ID: ${novo.id}`);
  console.log(`     CNPJ: ${EMITENTE_REAL.cnpj} | IE: ${EMITENTE_REAL.ie}`);
  console.log(`     Cidade: ${EMITENTE_REAL.cidade}/${EMITENTE_REAL.uf} | IBGE: ${EMITENTE_REAL.codigo_ibge}`);
  return novo.id;
}

// ============================================================================
// ETAPA 3: Propagar emitente para os 16 rascunhos
// ============================================================================
async function propagarParaRascunhos() {
  console.log("\n" + "━".repeat(60));
  console.log("  ETAPA 3 — Propagar emitente real para rascunhos");
  console.log("━".repeat(60));

  const { data: ctes, error: cteError } = await supabase
    .from("fiscal_ctes")
    .select("id, status, valor, metadata")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO);

  if (cteError || !ctes?.length) {
    console.log(`  ❌ Nenhum CT-e encontrado: ${cteError?.message || "vazio"}`);
    return [];
  }

  console.log(`  Encontrados ${ctes.length} CT-es. Propagando emitente real...`);

  const atualizados: string[] = [];
  const erros: string[] = [];

  for (const cte of ctes) {
    const meta = { ...(cte.metadata || {}) };
    const pf = { ...(meta.payload_focus || {}) };

    // Montar novo emitente no payload_focus
    pf.emitente = {
      nome: EMITENTE_REAL.razao_social,
      cnpj: EMITENTE_REAL.cnpj,
      ie: EMITENTE_REAL.ie,
      rntrc: EMITENTE_REAL.rntrc || pf.emitente?.rntrc || null,
      inscricao_estadual: EMITENTE_REAL.ie,
      inscricao_municipal: EMITENTE_REAL.inscricao_municipal,
      regime_tributario: EMITENTE_REAL.regime_tributario,
      endereco: {
        logradouro: EMITENTE_REAL.logradouro,
        numero: EMITENTE_REAL.numero,
        complemento: null,
        bairro: EMITENTE_REAL.bairro,
        cidade: EMITENTE_REAL.cidade,
        uf: EMITENTE_REAL.uf,
        cep: EMITENTE_REAL.cep,
        latitude: null,
        longitude: null,
        pais: "Brasil",
      },
    };

    // Atualizar tambem metadata de alto nivel
    meta.emitente_razao_social = EMITENTE_REAL.razao_social;
    meta.emitente_cnpj = EMITENTE_REAL.cnpj;
    meta.emitente_ie = EMITENTE_REAL.ie;
    meta.emitente_cidade = EMITENTE_REAL.cidade;
    meta.emitente_uf = EMITENTE_REAL.uf;
    meta.emitente_cep = EMITENTE_REAL.cep;
    meta.emitente_codigo_ibge = EMITENTE_REAL.codigo_ibge;
    meta.payload_focus = pf;

    // Manter outros campos intactos
    // (nao mexemos em destino, observacao, valores, etc.)

    const { error } = await supabase
      .from("fiscal_ctes")
      .update({ metadata: meta })
      .eq("id", cte.id);

    if (error) {
      erros.push(`${cte.id.slice(0, 12)}...: ${error.message}`);
    } else {
      atualizados.push(cte.id.slice(0, 12) + "...");
    }
  }

  console.log(`  ✅ ${atualizados.length} CT-es atualizados`);
  if (erros.length > 0) {
    console.log(`  ❌ ${erros.length} erros:`);
    for (const e of erros) console.log(`     ${e}`);
  }

  return atualizados;
}

// ============================================================================
// ETAPA 4: Validacao final
// ============================================================================
async function validarFinal() {
  console.log("\n" + "═".repeat(60));
  console.log("  VALIDAÇÃO FINAL");
  console.log("═".repeat(60));

  // 4a. Configuracoes fiscais
  console.log("\n  --- configuracoes_fiscais ---");
  const { data: cfgs } = await supabase
    .from("configuracoes_fiscais")
    .select("*")
    .order("created_at");

  const ativos = (cfgs || []).filter((c: any) => c.ativo);
  const padrao = (cfgs || []).filter((c: any) => c.padrao);

  if (ativos.length === 1) {
    const a = ativos[0];
    console.log(`  ✅ 1 configuracao ativa: ${a.razao_social}`);
    console.log(`     CNPJ: ${a.cnpj} ${a.cnpj === "42.796.040/0001-31" ? "✅" : "❌"}`);
    console.log(`     IE: ${a.ie} ${a.ie === "138381146110" ? "✅" : "❌"}`);
    console.log(`     padrao: ${a.padrao} ${a.padrao === true ? "✅" : "❌"}`);
  } else {
    console.log(`  ❌ ${ativos.length} ativos (esperado 1)`);
  }

  // 4b. Nenhum placeholder ativo
  const placeholders = (cfgs || []).filter((c: any) =>
    CNPJS_PLACEHOLDER.includes(c.cnpj) && c.ativo
  );
  console.log(`  Placeholders ativos: ${placeholders.length} ${placeholders.length === 0 ? "✅" : "❌"}`);

  // 4c. Rascunhos atualizados
  console.log("\n  --- fiscal_ctes (romaneio 340612) ---");
  const { data: ctes } = await supabase
    .from("fiscal_ctes")
    .select("id, status, valor, metadata")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .order("valor");

  let comEmitenteReal = 0;
  let comEmitentePlaceholder = 0;
  let nfe2628647ok = false;

  for (const c of ctes || []) {
    const meta = c.metadata || {};
    const pf = meta.payload_focus || {};
    const emitCnpj = pf.emitente?.cnpj || "";

    if (emitCnpj === "42.796.040/0001-31") {
      comEmitenteReal++;
    } else if (CNPJS_PLACEHOLDER.includes(emitCnpj)) {
      comEmitentePlaceholder++;
    }

    // Verificar NF-e 2628647
    if (meta.nfe_numero === "2628647") {
      nfe2628647ok =
        emitCnpj === "42.796.040/0001-31" &&
        pf.emitente?.ie === "138381146110" &&
        c.valor === 118.75 &&
        meta.tomador_nome === "CALVO COML IMP. E EXP. LTDA." &&
        meta.origem_municipio === "GUARULHOS" &&
        meta.origem_uf === "SP" &&
        pf.destino?.cidade === "SAO PAULO" &&
        pf.destino?.uf === "SP" &&
        meta.cfop === "5352" &&
        (pf.destino as any)?.codigo_municipio === "3550308" &&
        meta.pronto_para_emissao === true &&
        (meta.validacoes_pendentes || []).length === 0;
    }
  }

  console.log(`  Total: ${ctes?.length || 0} CT-es`);
  console.log(`  Com emitente real (42.796.040/0001-31): ${comEmitenteReal} ${comEmitenteReal === 16 ? "✅" : "❌"}`);
  console.log(`  Com emitente placeholder: ${comEmitentePlaceholder} ${comEmitentePlaceholder === 0 ? "✅" : "❌"}`);

  // 4d. NF-e 2628647
  console.log("\n  --- NF-e 2628647 ---");
  if (nfe2628647ok) {
    console.log("  ✅ Pronta para novo teste homologacao:");
    console.log("     valor: R$ 118,75");
    console.log("     tomador: CALVO COML IMP. E EXP. LTDA.");
    console.log("     origem: GUARULHOS/SP");
    console.log("     destino: SAO PAULO/SP");
    console.log("     CFOP: 5352");
    console.log("     IBGE: 3550308");
    console.log("     pronto_para_emissao: true");
    console.log("     validacoes_pendentes: 0");
  } else {
    console.log("  ❌ Verificar dados da NF-e 2628647");
  }

  return {
    cfgsOk: ativos.length === 1 && ativos[0]?.cnpj === "42.796.040/0001-31" && ativos[0]?.ie === "138381146110",
    placeholdersOk: placeholders.length === 0,
    rascunhosOk: comEmitenteReal === 16 && comEmitentePlaceholder === 0,
    nfe2628647ok,
  };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("═".repeat(60));
  console.log("  CONFIGURAR EMITENTE FISCAL REAL — CONEXÃO EXPRESS");
  console.log(`  CNPJ: ${EMITENTE_REAL.cnpj}`);
  console.log(`  IE: ${EMITENTE_REAL.ie}`);
  console.log("═".repeat(60));
  console.log("\n  ⚠️  NENHUMA chamada a Focus sera feita.");
  console.log("  ⚠️  NENHUM CT-e sera enviado.");
  console.log("");

  await desativarPlaceholders();
  const emitenteId = await inserirEmitenteReal();
  if (!emitenteId) {
    console.log("\n❌ FALHA ao inserir emitente real. Abortando.");
    return;
  }
  await propagarParaRascunhos();
  const resultado = await validarFinal();

  // Resumo
  console.log("\n" + "═".repeat(60));
  console.log("  RESUMO");
  console.log("═".repeat(60));
  console.log(`  Config fiscal real:  ${resultado.cfgsOk ? "✅" : "❌"}`);
  console.log(`  Placeholders limpos: ${resultado.placeholdersOk ? "✅" : "❌"}`);
  console.log(`  16 rascunhos ok:     ${resultado.rascunhosOk ? "✅" : "❌"}`);
  console.log(`  NF-e 2628647 pronta: ${resultado.nfe2628647ok ? "✅" : "❌"}`);
  console.log(`  Focus chamado?        ❌ NAO`);
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("❌ ERRO FATAL:", err);
  process.exit(1);
});
