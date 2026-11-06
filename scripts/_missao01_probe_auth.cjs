const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
(async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.E2E_LIVE_EMAIL;
  const password = process.env.E2E_LIVE_PASSWORD;
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password });
  console.log("auth:", authErr ? "FAIL " + authErr.message : "OK user=" + auth.user.id);
  if (authErr) return;
  const { data: tenant, error: te } = await sb.rpc("current_tenant_id_safe");
  console.log("tenant:", te ? "FAIL " + te.message : tenant);
  for (const t of ["clientes_contratos","documentos_metadata","reembolsos_prestador","clientes"]) {
    const { error } = await sb.from(t).select("id").limit(1);
    console.log("select", t, error ? "FAIL " + error.message : "OK");
  }
  const { error: insC } = await sb.from("clientes_contratos").insert([{ cliente_id: null, numero: "__probe__", status: "ativo" }]).select();
  console.log("insert clientes_contratos:", insC ? "FAIL " + insC.message : "OK(!!)");
  await sb.auth.signOut();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
