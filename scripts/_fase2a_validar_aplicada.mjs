// Validação READ-ONLY da migration Fase 2A APLICADA.
// Verifica schema/metadata e testa RPC de numeração dentro de transação
// revertida (ROLLBACK) — NENHUM dado é persistido.
import pg from "pg";
import "dotenv/config";

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error("DATABASE_URL ausente"); process.exit(1); }

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  try {
    // Schema / metadata (read-only)
    const t = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('faturas','fatura_itens') ORDER BY 1`);
    console.log("1. Tabelas:", t.rows.map(r=>r.relname).join(", "));

    const colsFat = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='faturas' ORDER BY ordinal_position`);
    console.log("2. faturas (colunas):", colsFat.rows.map(r=>r.column_name).join(", "));

    const colsIt = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='fatura_itens' ORDER BY ordinal_position`);
    console.log("3. fatura_itens (colunas):", colsIt.rows.map(r=>r.column_name).join(", "));

    const chk = await client.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.faturas'::regclass AND contype='c'`);
    console.log("4. CHECK faturas:", chk.rows.map(r=>`${r.conname}: ${r.def}`).join(" | "));

    const fk = await client.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid IN ('public.faturas'::regclass,'public.fatura_itens'::regclass) AND contype='f'`);
    console.log("5. FKs:", fk.rows.map(r=>`${r.conname}: ${r.def}`).join(" | "));

    const colFr = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_receber' AND column_name='fatura_id'`);
    console.log("6. financeiro_receber.fatura_id:", colFr.rows.length ? "presente" : "AUSENTE");

    const seq = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' AND c.relname LIKE 'seq_fatura_%'`);
    console.log("7. Sequências:", seq.rows.map(r=>r.relname).join(", "));

    // Teste da numeração DENTRO de transação revertida (não persiste nextval definitivo
    // — mas nextval NÃO é revertido por ROLLBACK; documentar: a sequência avança.
    // Para evitar avançar a sequência de produção, NÃO testamos nextval aqui.
    // Validamos apenas que a função existe e é acessível.
    const fn = await client.query(`SELECT proname, prosecdef, provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname IN ('f_gerar_numero_fatura','f_emitir_fatura','f_cancelar_fatura') ORDER BY proname`);
    console.log("8. Funções:", fn.rows.map(r=>`${r.proname}(secdef=${r.prosecdef}, vol=${r.provolatile})`).join(", "));

    // RLS policies
    const pol = await client.query(`SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('faturas','fatura_itens') ORDER BY tablename, policyname`);
    console.log("9. Policies:", pol.rows.map(r=>`${r.tablename}:${r.policyname}`).join(", "));

    // Contagens (não devem existir dados — nenhum seed)
    const c = await client.query(`SELECT (SELECT count(*)::int FROM public.faturas) AS fat, (SELECT count(*)::int FROM public.fatura_itens) AS itens, (SELECT count(*)::int FROM public.financeiro_receber) AS receber`);
    console.log("10. Contagens (faturas/itens/receber):", JSON.stringify(c.rows[0]));

    // Validação de que a coluna fatura_id em financeiro_receber está vazia (NULL) nos existentes
    const nulos = await client.query(`SELECT count(*)::int AS com_fatura_id FROM public.financeiro_receber WHERE fatura_id IS NOT NULL`);
    console.log("11. Títulos existentes com fatura_id (deve ser 0):", nulos.rows[0].com_fatura_id);
  } catch (err) {
    console.error("ERRO:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();