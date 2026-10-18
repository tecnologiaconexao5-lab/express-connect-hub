import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = process.env.PROJECT_DIR;
if (PROJECT) config({ path: path.resolve(PROJECT, ".env") });

import pg from "pg";
const { Client, Pool } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function asUser(userId) {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    await tx.query(`SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: userId, role: "authenticated" })}'`);
    await tx.query(`SET LOCAL role = authenticated`);
    const r = await tx.query(`SELECT public.f_contar_mensagens_nao_lidas_torre() AS n`);
    await tx.query("ROLLBACK");
    return r.rows[0].n;
  } finally { tx.release(); }
}

const asTorre = await asUser("a22c0000-0000-4000-8000-00000000000c");
const asPrestador = await asUser("a22a0000-0000-4000-8000-00000000000a");

const anonClient = await pool.connect();
await anonClient.query("BEGIN");
await anonClient.query(`SET LOCAL role = anon`);
const anon = await anonClient.query(`SELECT public.f_contar_mensagens_nao_lidas_torre() AS n`);
await anonClient.query("ROLLBACK");
anonClient.release();

console.log("Torre (tenant_usuarios):", asTorre);
console.log("Prestador (não autorizado):", asPrestador);
console.log("Anon (não autenticado):", anon.rows[0].n);
const ok = asTorre >= 1 && asPrestador === 0 && anon.rows[0].n === 0;
console.log(ok ? "BADGE_HARDENING_OK" : "BADGE_HARDENING_FALHOU");

await client.end(); await pool.end();
process.exit(ok ? 0 : 1);
