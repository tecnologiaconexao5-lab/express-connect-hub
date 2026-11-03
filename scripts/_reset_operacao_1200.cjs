/* ============================================================================
 * _reset_operacao_1200.cjs — RESET GERAL DA OPERAÇÃO (com sequência oficial)
 *
 * Comando único que:
 *   1) aplica a migration 20261102000000_os_numero_sequencial.sql
 *      (idempotente: sequence 1200 + f_proximo_numero_os + conversores
 *       aleatórios passam a usar a sequência);
 *   2) apaga TODAS as OS, Cotações e registros financeiros/operacionais;
 *   3) reinicia a sequência em 1200 → a próxima OS gerada é
 *      obrigatoriamente "OS-[ANO][MES]-1200" (ex.: OS-202611-1200).
 *
 * Uso (raiz do repo, com DATABASE_URL no .env):
 *   node scripts\_reset_operacao_1200.cjs              # DRY-RUN (só relatório)
 *   node scripts\_reset_operacao_1200.cjs --apply      # executa TUDO em UMA transação
 *
 * Opções (repassadas ao _reset_operacao.cjs):
 *   --orcamentos   também apaga os orçamentos (padrão: só desvincula da OS)
 *   --logs         também apaga eventos oficiais / timeline operacional
 *
 * Atenção: transação única — qualquer falha faz ROLLBACK completo (inclui a
 * migration da sequência). Nada é alterado em modo dry-run.
 * ==========================================================================*/

const { executar } = require("./_reset_operacao.cjs");

executar({ aplicarSequencia: true }).catch((e) => {
  console.error("ERRO FATAL:", e.message);
  process.exit(2);
});
