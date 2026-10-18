// TMS-FIN-PROG-05C.2 — provas A..E da anti-duplicidade + rascunho Calvo. ROLLBACK.
import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, pr = []) => (await c.query(s, pr)).rows;
const CLI = "91b80fdb-6b87-4982-a550-f863f7f15866";
const PREST = "6cc41f68-1467-455d-b8d5-c61bfe72cb7c";
const out = {};
try {
  await c.query("BEGIN");

  const mkAloc = async () => (await q(`insert into alocacoes_escala (status, finalizada, valor_frete, data_escala, tipo_veiculo, observacoes) values ('planejada', false, 10, current_date, 'moto', 'TESTE PROG05C2') returning id`))[0].id;
  const mkFat = async () => (await q(`insert into faturas (cliente_id, data_emissao, status) values ($1, current_date, 'rascunho') returning id`, [CLI]))[0].id;
  const mkItem = async (fat, { os_id = null, alocacao_id = null }) =>
    q(`insert into fatura_itens (fatura_id, cliente_id, descricao, valor_base, valor_total, os_id, alocacao_id) values ($1,$2,'TESTE',$3,$3,$4,$5) returning id`, [fat, CLI, 10, os_id, alocacao_id]);

  const alocA = await mkAloc();
  const alocB = await mkAloc();
  const F1 = await mkFat(), F2 = await mkFat(), F3 = await mkFat(), F4 = await mkFat(), F5 = await mkFat(), F6 = await mkFat();

  const tryFn = async (fn) => { try { await c.query("SAVEPOINT sp"); const r = await fn(); await c.query("RELEASE SAVEPOINT sp"); return { ok: true, r }; } catch (e) { await c.query("ROLLBACK TO SAVEPOINT sp"); return { ok: false, error: e.message }; } };

  // A) mesma alocacao em OUTRA fatura ativa -> BLOQUEAR
  const a1 = await tryFn(() => mkItem(F1, { alocacao_id: alocA }));
  const a2 = await tryFn(() => mkItem(F2, { alocacao_id: alocA }));
  out.A = { primeira_ok: a1.ok, segunda_bloqueada: !a2.ok, erro: a2.error };

  // B) mesma alocacao no proprio item/fatura -> PERMITIR (UPDATE)
  const itemF1 = (await q(`select id from fatura_itens where fatura_id=$1 limit 1`, [F1]))[0].id;
  const b = await tryFn(() => q(`update fatura_itens set descricao='TESTE ATUALIZADO' where id=$1`, [itemF1]));
  out.B = { atualizacao_permitida: b.ok, erro: b.error };

  // C) alocacoes diferentes -> PERMITIR
  const cRes = await tryFn(() => mkItem(F2, { alocacao_id: alocB }));
  out.C = { permitido: cRes.ok, erro: cRes.error };

  // D) os_id duplicado em outra fatura -> BLOQUEAR
  const osTest = (await q(`insert into ordens_servico (numero, status, cliente, prestador, cliente_id, prestador_id, data, valor_cliente, custo_prestador) values ('TESTE-PROG05C2-OS', 'pendente', $1, $2, 'HOMOLOG', 'PREST', current_date, 10, 5) returning id`, [CLI, PREST]))[0].id;
  const d1 = await tryFn(() => mkItem(F3, { os_id: osTest }));
  const d2 = await tryFn(() => mkItem(F4, { os_id: osTest }));
  out.D = { primeira_ok: d1.ok, segunda_bloqueada: !d2.ok, erro: d2.error };

  // E) fatura anterior cancelada -> PERMITIR (regra historica)
  await q(`update faturas set status='cancelada' where id=$1`, [F1]);
  const e = await tryFn(() => mkItem(F5, { alocacao_id: alocA }));
  out.E = { permitido_apos_cancelamento: e.ok, erro: e.error };

  // Rascunho Calvo protegido: alocacao 58e5751e ja esta em rascunho ativo
  const calvoRes = await tryFn(() => mkItem(F6, { alocacao_id: "58e5751e-bd54-43c5-9bcf-55fe4e575e6b" }));
  out.CALVO = { bloqueado: !calvoRes.ok, erro: calvoRes.error };

  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  out.ERRO = e.message;
  console.log(JSON.stringify(out, null, 2));
} finally {
  await c.query("ROLLBACK").catch(() => {});
  await c.end();
}
