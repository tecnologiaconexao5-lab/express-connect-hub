/* ============================================================================
 * _reset_operacao.cjs — Zera os dados de teste e reinicia a sequência da OS
 *
 * Uso (raiz do repo, com DATABASE_URL no .env):
 *   node scripts\_reset_operacao.cjs                # DRY-RUN (só relatório)
 *   node scripts\_reset_operacao.cjs --apply        # executa em UMA transação
 *
 * Recomendado (script de entrada com sequência oficial):
 *   node scripts\_reset_operacao_1200.cjs [--apply]
 *
 * Opções:
 *   --orcamentos   também apaga os orçamentos (padrão: apenas desvincula da OS)
 *   --logs         também apaga eventos oficiais / timeline operacional
 *
 * O que é removido (padrão):
 *   • registros financeiros: financeiro_receber, financeiro_pagar,
 *     pagamentos_prestadores, composicao_financeira_os, financeiro_baixas
 *   • operação vinculada: alocacoes_escala (+ histórico), entregas_protocolo,
 *     delivery_proofs, rede_oportunidades
 *   • ordens_servico (todas) e cotacoes_publicas (todas)
 *   • a sequência oficial é reiniciada em 1200 (OS-AAAAMM-1200, 1201, ...)
 *
 * Opção interna `aplicarSequencia` (usada por _reset_operacao_1200.cjs):
 *   executa a migration 20261102000000_os_numero_sequencial.sql DENTRO da mesma
 *   transação (idempotente) → a próxima OS é obrigatoriamente OS-AAAAMM-1200.
 *
 * Atenção: roda em transação única — qualquer falha faz ROLLBACK completo.
 * ==========================================================================*/

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRACAO_SEQUENCIA = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261102000000_os_numero_sequencial.sql",
);

/** Tabelas removidas, na ordem (filhos → pais). */
const TABELAS = [
  "financeiro_baixas",
  "composicao_financeira_os",
  "pagamentos_prestadores",
  "financeiro_receber",
  "financeiro_pagar",
  "entregas_protocolo",
  "delivery_proofs",
  "rede_oportunidades",
  "historico_alocacoes_escala",
  "alocacoes_escala",
  "os_historico",
  "ordens_servico",
  "cotacoes_publicas",
];

const TABELAS_LOGS = ["eventos_oficiais", "operation_timeline_events"];

async function executar(opts = {}) {
  const argv = opts.argv || process.argv;
  const APPLY = typeof opts.apply === "boolean" ? opts.apply : argv.includes("--apply");
  const APAGAR_ORCAMENTOS = argv.includes("--orcamentos");
  const APAGAR_LOGS = argv.includes("--logs");
  const APLICAR_SEQUENCIA = Boolean(opts.aplicarSequencia);

  console.log(`_reset_operacao.cjs — modo: ${APPLY ? "APPLY (executa)" : "DRY-RUN (só relatório)"}`);
  console.log(`  orçamentos: ${APAGAR_ORCAMENTOS ? "APAGAR" : "desvincular"} · logs: ${APAGAR_LOGS ? "APAGAR" : "manter"} · sequência oficial: ${APLICAR_SEQUENCIA ? "APLICAR (1200)" : "reiniciar se existir"}`);

  const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const existe = async (tabela) =>
    Boolean((await c.query(`SELECT to_regclass($1) AS t`, [`public.${tabela}`])).rows[0].t);

  const contar = async (tabela) => {
    if (!(await existe(tabela))) return null;
    const r = await c.query(`SELECT count(*)::int AS n FROM public.${tabela}`);
    return r.rows[0].n;
  };

  console.log("\n== contagem ANTES ==");
  const antes = {};
  for (const t of TABELAS) {
    antes[t] = await contar(t);
    console.log(`  ${t}: ${antes[t] === null ? "(tabela não existe)" : antes[t]}`);
  }
  const seqAntes = await c.query(
    `SELECT last_value, is_called FROM public.os_numero_seq`
  ).catch(() => ({ rows: [] }));
  console.log(`  os_numero_seq: ${seqAntes.rows[0] ? `last=${seqAntes.rows[0].last_value} called=${seqAntes.rows[0].is_called}` : "(não existe — será criada na execução)"}`);

  // Vínculos remanescentes em tabelas/views que NÃO serão limpas
  const colunas = await c.query(
    `SELECT c.table_name, c.column_name
       FROM information_schema.columns c
       JOIN pg_class cl ON cl.relname = c.table_name
       JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
      WHERE c.table_schema='public'
        AND c.column_name IN ('os_id','ordem_servico_id')
        AND cl.relkind IN ('r','p')`
  );
  const ignoradas = new Set([
    ...TABELAS,
    "financeiro_receber",
    "financeiro_pagar",
    "pagamentos_prestadores",
    "composicao_financeira_os",
    "entregas_protocolo",
    "rede_oportunidades",
    "alocacoes_escala",
  ]);
  const avisos = [];
  for (const { table_name, column_name } of colunas.rows) {
    if (ignoradas.has(table_name)) continue;
    if (!(await existe(table_name))) continue;
    try {
      const r = await c.query(
        `SELECT count(*)::int AS n FROM public.${table_name} WHERE ${column_name} IS NOT NULL`
      );
      if (r.rows[0].n > 0) avisos.push(`${table_name}.${column_name} → ${r.rows[0].n} registro(s)`);
    } catch {
      // ignora tabelas sem permissão/estrutura inesperada
    }
  }
  if (avisos.length) {
    console.log("\n== AVISO: vínculos em tabelas não limpas ==");
    for (const a of avisos) console.log(`  • ${a} (ficará apontando para OS removidas)`);
  }

  if (!APPLY) {
    if (APLICAR_SEQUENCIA) {
      console.log("\n== plano da sequência ==");
      console.log(`  aplicará ${path.basename(MIGRACAO_SEQUENCIA)} (idempotente) e reiniciará em 1200`);
      console.log("  → próxima OS gerada: OS-AAAAMM-1200");
    }
    console.log("\nDRY-RUN: nada foi alterado.");
    console.log("Para executar: node scripts\\_reset_operacao_1200.cjs --apply");
    await c.end();
    return;
  }

  console.log("\n== executando (transação única) ==");
  await c.query("BEGIN");
  try {
    if (APLICAR_SEQUENCIA) {
      if (!fs.existsSync(MIGRACAO_SEQUENCIA)) {
        throw new Error(`migration não encontrada: ${MIGRACAO_SEQUENCIA}`);
      }
      const sql = fs.readFileSync(MIGRACAO_SEQUENCIA, "utf8");
      await c.query(sql);
      console.log("  sequência + f_proximo_numero_os: migration aplicada (idempotente)");
    }

    for (const t of TABELAS) {
      if (!(await existe(t))) {
        console.log(`  ${t}: (não existe) — ignorado`);
        continue;
      }
      const r = await c.query(`DELETE FROM public.${t}`);
      console.log(`  ${t}: ${r.rowCount} removido(s)`);
    }

    if (APAGAR_LOGS) {
      for (const t of TABELAS_LOGS) {
        if (!(await existe(t))) continue;
        const r = await c.query(`DELETE FROM public.${t}`);
        console.log(`  ${t}: ${r.rowCount} removido(s)`);
      }
    }

    if (APAGAR_ORCAMENTOS) {
      if (await existe("orcamentos")) {
        const r = await c.query(`DELETE FROM public.orcamentos`);
        console.log(`  orcamentos: ${r.rowCount} removido(s)`);
      }
    } else if (await existe("orcamentos")) {
      const r = await c.query(
        `UPDATE public.orcamentos
            SET os_vinculada_id = NULL,
                os_vinculada_numero = NULL,
                updated_at = now()
          WHERE os_vinculada_id IS NOT NULL OR os_vinculada_numero IS NOT NULL`
      );
      console.log(`  orcamentos: ${r.rowCount} desvinculado(s) da OS (use --orcamentos para apagar)`);
    }

    const temSeq = await c.query(`SELECT to_regclass('public.os_numero_seq') AS t`);
    if (temSeq.rows[0].t) {
      await c.query(`ALTER SEQUENCE public.os_numero_seq RESTART WITH 1200`);
      console.log("  os_numero_seq: reiniciada em 1200");
    } else if (APLICAR_SEQUENCIA) {
      throw new Error("a migration da sequência foi aplicada mas os_numero_seq não existe");
    } else {
      console.log("  os_numero_seq: (não existe — use scripts\\_reset_operacao_1200.cjs para aplicar)");
    }

    console.log("\n== verificação DEPOIS (antes do COMMIT) ==");
    let residuo = 0;
    for (const t of TABELAS) {
      if (!(await existe(t))) continue;
      const n = await contar(t);
      if (n > 0) residuo += n;
      console.log(`  ${t}: ${n}`);
    }

    if (residuo > 0) throw new Error(`ainda há ${residuo} registro(s) nas tabelas limpas`);

    if (APLICAR_SEQUENCIA) {
      const seq = await c.query(`SELECT last_value, is_called FROM public.os_numero_seq`);
      const { last_value, is_called } = seq.rows[0];
      if (String(last_value) !== "1200" || is_called !== false) {
        throw new Error(`sequência não está pronta para 1200 (last=${last_value}, called=${is_called})`);
      }
      const defProx = await c.query(`SELECT pg_get_functiondef('public.f_proximo_numero_os()') AS d`);
      if (!String(defProx.rows[0].d).includes("os_numero_seq")) {
        throw new Error("f_proximo_numero_os não referencia os_numero_seq");
      }
      const defCot = await c.query(`SELECT pg_get_functiondef('public.f_cotacao_detalhes_para_os()') AS d`);
      if (!String(defCot.rows[0].d).includes("os_numero_seq")) {
        throw new Error("f_cotacao_detalhes_para_os não usa a sequência (geração aleatória ainda ativa)");
      }
      console.log("  próximo número garantido: OS-AAAAMM-1200 (sequence 1200, não consumida)");
    }

    await c.query("COMMIT");
    console.log("\n*** COMMIT REALIZADO — base pronta para a operação real ***");
    if (APLICAR_SEQUENCIA) console.log("*** Próxima OS: OS-AAAAMM-1200 ***");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("\nERRO -> ROLLBACK:", e.message);
    await c.end();
    process.exit(1);
  }

  await c.end();
}

module.exports = { executar };

if (require.main === module) {
  executar().catch((e) => {
    console.error("ERRO FATAL:", e.message);
    process.exit(2);
  });
}
