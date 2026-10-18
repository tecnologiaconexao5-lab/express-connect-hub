/**
 * FIN-BUG-03 — Cancela a fatura DUPLICATA autorizada em produção.
 * Alvo: c4e74e94-3482-4a7f-911d-15dc1feadeeb (R$ 810,40, aguardando_aprovacao)
 * Original preservada: bb645429-b75b-49bb-be55-a612fec08947 (FAT-2026-000030)
 * Caminho: RPC oficial f_cancelar_fatura (auth.uid() via request.jwt.claims do
 * usuário financeiro@conexaoexpress.com.br — papel 'financeiro', tenant correto).
 * Evidencia: scripts\_fin_bug03_cancel_dup.json
 */
import fs from "node:fs";
import { Client } from "pg";
const DB = (fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1];
const pg = new Client({ connectionString: DB.trim() });
await pg.connect();

const DUP = "c4e74e94-3482-4a7f-911d-15dc1feadeeb";
const ORI = "bb645429-b75b-49bb-be55-a612fec08947";
const USER_ID = "de1c77e0-1818-431c-8503-ebe08bd95e80"; // financeiro@conexaoexpress.com.br
const MOTIVO = "FIN-BUG-03 — duplicidade: fatura manual idêntica à FAT-2026-000030 "
  + "(bb645429, R$ 810,40, mesma data/descrição/cliente); cancelada por correção assistida.";

const snapshot = async () => ({
  faturas: (await pg.query(
    `SELECT id, status, numero, conta_receber_id, valor_total, cancelado_em, cancelado_por, motivo_cancelamento
     FROM public.faturas WHERE id = ANY($1::uuid[]) ORDER BY criado_em`, [[DUP, ORI]])).rows,
  itens: (await pg.query(
    `SELECT fatura_id, status, count(*)::int AS qtd FROM public.fatura_itens
     WHERE fatura_id = ANY($1::uuid[]) GROUP BY 1,2 ORDER BY 1,2`, [[DUP, ORI]])).rows,
  distribuicao: (await pg.query(
    `SELECT status, count(*)::int AS qtd FROM public.faturas GROUP BY 1 ORDER BY 1`)).rows,
  ar: (await pg.query(
    `SELECT id, status, valor, fatura_id FROM public.financeiro_receber
     WHERE fatura_id = ANY($1::uuid[]) OR id = '8ce6db9e-38fd-4e49-9448-8157748add86'`,
    [[DUP, ORI]])).rows,
});

const out = { ts: new Date().toISOString(), alvo: DUP, original: ORI, motivo: MOTIVO };
out.antes = await snapshot();
console.log("ANTES:", JSON.stringify(out.antes.faturas, null, 2));

await pg.query("BEGIN");
try {
  await pg.query("SELECT set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: USER_ID, role: "authenticated" })]);
  const uid = (await pg.query("SELECT auth.uid() AS uid")).rows[0];
  out.auth_uid = uid;
  if (uid.uid !== USER_ID) throw new Error("auth.uid() nao resolveu: " + JSON.stringify(uid));
  const r = (await pg.query("SELECT public.f_cancelar_fatura($1::uuid, $2::text) AS r", [DUP, MOTIVO])).rows[0];
  out.rpc = r.r;
  if (!r.r || r.r.success !== true) throw new Error("RPC falhou: " + JSON.stringify(r.r));
  await pg.query("COMMIT");
  out.commit = true;
} catch (e) {
  await pg.query("ROLLBACK");
  out.commit = false;
  out.erro = e.message;
}

out.depois = await snapshot();
out.verificacoes = {
  "duplicata cancelada": out.depois.faturas.find(f => f.id === DUP)?.status === "cancelada",
  "item da duplicata cancelado": out.depois.itens.find(i => i.fatura_id === DUP && i.status === "cancelado")?.qtd === 1,
  "motivo gravado": Boolean(out.depois.faturas.find(f => f.id === DUP)?.motivo_cancelamento),
  "original intacta (FAT-2026-000030)": out.depois.faturas.find(f => f.id === ORI)?.status === "emitida"
    && out.depois.faturas.find(f => f.id === ORI)?.numero === "FAT-2026-000030",
  "AR da original intacta": JSON.stringify(out.depois.ar.find(a => a.id === "8ce6db9e-38fd-4e49-9448-8157748add86"))
    === JSON.stringify(out.antes.ar.find(a => a.id === "8ce6db9e-38fd-4e49-9448-8157748add86")),
  "nenhuma AR nova": out.depois.ar.length === out.antes.ar.length,
  "total de faturas igual": out.depois.distribuicao.reduce((s, d) => s + d.qtd, 0)
    === out.antes.distribuicao.reduce((s, d) => s + d.qtd, 0),
  "itens da original intactos": JSON.stringify(out.depois.itens.filter(i => i.fatura_id === ORI))
    === JSON.stringify(out.antes.itens.filter(i => i.fatura_id === ORI)),
};
out.ok = Object.values(out.verificacoes).every(Boolean) && out.commit === true;

console.log("DEPOIS:", JSON.stringify(out.depois.faturas, null, 2));
console.log("VERIFICACOES:", JSON.stringify(out.verificacoes, null, 2));
console.log(out.ok ? "\nOK — cancelamento aplicado e verificado" : "\nFALHA — ver detalhes");

await pg.end();
fs.writeFileSync("scripts/_fin_bug03_cancel_dup.json", JSON.stringify(out, null, 2));
console.log("Salvo scripts/_fin_bug03_cancel_dup.json");
