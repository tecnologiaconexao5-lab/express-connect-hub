import pg from "pg";
import "dotenv/config";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  await c.query("REVOKE ALL ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) FROM anon");
  await c.query("REVOKE ALL ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) FROM anon");
  await c.query("REVOKE ALL ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, text, text, uuid, text) FROM PUBLIC");
  await c.query("REVOKE ALL ON FUNCTION public.f_estornar_baixa_financeira(uuid, text) FROM PUBLIC");
  console.log("Grants corrigidos (anon/PUBLIC revogados das RPCs F0-C4).");
  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});