import pg from "pg";
import { execFileSync } from "node:child_process";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const q = async (sql, params) => (await c.query(sql, params)).rows;

async function snap(label) {
  const s = {
    label,
    fixture_users: (await q(`select count(*)::int n from auth.users where email like 'adm02d2_%@teste.com'`))[0].n,
    fixture_prestadores: (await q(`select count(*)::int n from prestadores where nome_completo like '02D2 FIXTURE %'`))[0].n,
    tenant_usuarios: (await q(`select count(*)::int n from tenant_usuarios`))[0].n,
    prestadores: (await q(`select count(*)::int n from prestadores`))[0].n,
    clientes: (await q(`select count(*)::int n from clientes`))[0].n,
    ordens_servico: (await q(`select count(*)::int n from ordens_servico`))[0].n,
    alocacoes_escala: (await q(`select count(*)::int n from alocacoes_escala`))[0].n,
    financeiro_receber: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
    financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar`))[0].n,
    documentos_prestadores: (await q(`select count(*)::int n from documentos_prestadores`))[0].n,
    storage_objects_bucket: (await q(`select count(*)::int n from storage.objects where bucket_id='documentos_prestadores'`))[0].n,
    storage_objects_total: (await q(`select count(*)::int n from storage.objects`))[0].n,
  };
  console.log(JSON.stringify(s));
  return s;
}

const antes = await snap("ANTES_FIXTURE_DOWN");

execFileSync(process.execPath, ["scripts/_adm_app_02d2_fixture.mjs", "down"], { stdio: "inherit" });

const depois = await snap("DEPOIS_FIXTURE_DOWN");

const provas = {
  fixture_users_removidos: antes.fixture_users === 3 && depois.fixture_users === 0,
  fixture_prestadores_removidos: antes.fixture_prestadores === 2 && depois.fixture_prestadores === 0,
  tenant_usuarios_minus_1: depois.tenant_usuarios === antes.tenant_usuarios - 1,
  prestadores_minus_2: depois.prestadores === antes.prestadores - 2,
  clientes_intactos: depois.clientes === antes.clientes,
  ordens_servico_intactas: depois.ordens_servico === antes.ordens_servico,
  alocacoes_escala_intactas: depois.alocacoes_escala === antes.alocacoes_escala,
  financeiro_receber_intacto: depois.financeiro_receber === antes.financeiro_receber,
  financeiro_pagar_intacto: depois.financeiro_pagar === antes.financeiro_pagar,
  documentos_prestadores_intactos: depois.documentos_prestadores === antes.documentos_prestadores,
  bucket_intacto_sem_objetos_fixture: depois.storage_objects_bucket === antes.storage_objects_bucket,
  storage_global_intacto: depois.storage_objects_total === antes.storage_objects_total,
};

console.log(JSON.stringify({ antes, depois, provas }, null, 2));
const falhas = Object.entries(provas).filter(([, v]) => !v).map(([k]) => k);
await c.end();
if (falhas.length) { console.error("FALHAS:", falhas.join(",")); process.exit(1); }
console.log(`FIXTURE DOWN PROVA OK (${Object.keys(provas).length}/${Object.keys(provas).length})`);
