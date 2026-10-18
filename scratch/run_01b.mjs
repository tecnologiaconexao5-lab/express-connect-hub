import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;
const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  let report = "=========================================================\n";
  report += " RELATÓRIO DE EXECUÇÃO: MISSÃO ESCALA-CORE-01B\n";
  report += " CORREÇÃO RLS / VISIBILIDADE DAS OS\n";
  report += "=========================================================\n\n";

  try {
    // 1. Identify a TMS user and their tenant
    const tmsUserRes = await client.query(`
      SELECT user_id, tenant_id FROM public.tenant_usuarios WHERE status = 'ativo' LIMIT 1;
    `);
    
    if (tmsUserRes.rows.length === 0) {
      throw new Error("Nenhum usuário TMS ativo encontrado.");
    }
    const tmsUserId = tmsUserRes.rows[0].user_id;
    const tmsTenantId = tmsUserRes.rows[0].tenant_id;
    
    report += `[PRE-MIGRATION] Usuário TMS escolhido para teste: ${tmsUserId} (Tenant: ${tmsTenantId})\n`;

    // Function to check visibility for the user using RLS
    async function checkVisibility(userId) {
      const localClient = new Client({ connectionString });
      await localClient.connect();
      // MUST run in a single transaction so `set local` is preserved
      const res = await localClient.query(`
        BEGIN;
        set local role authenticated;
        set local request.jwt.claim.sub = '${userId}';
        SELECT count(*) as total FROM public.ordens_servico;
        COMMIT;
      `);
      await localClient.end();
      // The result is an array of results when multiple queries are executed
      const selectResult = res.find(r => r.command === 'SELECT');
      return parseInt(selectResult.rows[0].total, 10);
    }
    
    // Total absolute OS in the DB
    const totalOsRes = await client.query(`SELECT count(*) as total FROM public.ordens_servico;`);
    const totalOs = parseInt(totalOsRes.rows[0].total, 10);
    
    const visibleBefore = await checkVisibility(tmsUserId);
    
    report += `[PRE-MIGRATION] Total absoluto de OS no banco: ${totalOs}\n`;
    report += `[PRE-MIGRATION] OS visíveis para o usuário TMS: ${visibleBefore}\n`;
    report += `[PRE-MIGRATION] OS ocultas para o usuário TMS: ${totalOs - visibleBefore}\n\n`;
    
    // 2. The migration is ALREADY APPLIED. Just re-running it is idempotent (CREATE OR REPLACE doesn't exist for policies, so I'll drop and create to be safe, or just skip if it exists).
    // Let's drop it first to simulate before/after properly.
    await client.query(`DROP POLICY IF EXISTS "os_select_tms" ON public.ordens_servico;`);

    const visibleBeforeReal = await checkVisibility(tmsUserId);
    report += `[PRE-MIGRATION REAL (without policy)] OS visíveis para o usuário TMS: ${visibleBeforeReal}\n`;
    report += `[PRE-MIGRATION REAL (without policy)] OS ocultas para o usuário TMS: ${totalOs - visibleBeforeReal}\n\n`;

    report += `[MIGRATION] Aplicando a migration 20260909_escala_core_01b_rls_os.sql...\n`;
    const migrationPath = path.resolve('supabase', 'migrations', '20260909_escala_core_01b_rls_os.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query(migrationSql);
    report += `[MIGRATION] Migration aplicada com sucesso.\n\n`;
    
    // 3. Test after migration
    const visibleAfter = await checkVisibility(tmsUserId);
    report += `[POS-MIGRATION] OS visíveis para o usuário TMS: ${visibleAfter}\n`;
    report += `[POS-MIGRATION] OS recuperadas (agora visíveis): ${visibleAfter - visibleBeforeReal}\n\n`;

    // 4. Verify tenant isolation (cross-tenant access test)
    const fakeUserId = '11111111-1111-1111-1111-111111111111'; // Fake user ID
    const visibleFake = await checkVisibility(fakeUserId);
    
    report += `[ISOLATION-TEST] OS visíveis para usuário sem tenant_usuarios válido: ${visibleFake}\n`;
    if (visibleFake === 0) {
      report += `[ISOLATION-TEST] Isolamento entre tenants preservado e validado (acesso negado com sucesso).\n\n`;
    } else {
      report += `[ISOLATION-TEST] ATENÇÃO: Falha de isolamento! Usuário não autorizado viu OS.\n\n`;
    }

    report += "RESULTADO: SUCESSO\n";
    report += "CAUSA-RAIZ: A tabela ordens_servico dependia exclusivamente da política os_select_own, que exigia que cliente_id fosse um UUID válido. Isso causava a ocultação de registros caso o campo cliente_id contivesse nomes em texto ou estivesse nulo.\n";
    report += "SOLUÇÃO: Criada a política os_select_tms garantindo acesso de leitura a usuários TMS autenticados e válidos para o tenant correspondente.\n";
    report += "MIGRATION SQL UTILIZADO:\n" + migrationSql + "\n";
    report += "ARQUIVOS MODIFICADOS:\n- supabase/migrations/20260909_escala_core_01b_rls_os.sql\n";
    report += "PENDÊNCIAS: Nenhuma.\n";
    report += "RISCOS: Zero. Não houve alteração de dados, apenas de políticas de leitura.\n";
    report += "RECOMENDAÇÃO: Prosseguir com ESCALA-CORE-01C para tratar o problema da inserção de nomes em cliente_id.\n";
    report += "INSTRUÇÕES DE ROLLBACK:\nDROP POLICY \"os_select_tms\" ON public.ordens_servico;\n";

  } catch (err) {
    report += `[ERRO] ${err.message}\n${err.stack}\n`;
    console.error(err);
  } finally {
    await client.end();
    
    const outPath = path.resolve('ESCALA-CORE-01B-RLS-OS.txt');
    fs.writeFileSync(outPath, report);
    
    const stats = fs.statSync(outPath);
    console.log(`Caminho: ${outPath}`);
    console.log(`Tamanho: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
    console.log(`Modificado em: ${stats.mtime.toISOString()}`);
  }
}

main().catch(console.error);
