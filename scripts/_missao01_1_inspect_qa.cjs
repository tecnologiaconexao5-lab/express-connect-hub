const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.qa" });
(async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  console.log("URL", url);
  for (const t of ["clientes","clientes_contratos","documentos_metadata","reembolsos_prestador","alocacoes_escala","ordens_servico","tenant_usuarios","tenants"]) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(t, error ? "ERR " + error.message : "count=" + count);
  }
  const { data: buckets, error: be } = await sb.storage.listBuckets();
  console.log("buckets", be ? be.message : (buckets||[]).map(b=>b.id).join(","));
  const { data: users, error: ue } = await sb.auth.admin.listUsers({ page: 1, perPage: 5 });
  console.log("users", ue ? ue.message : (users?.users||[]).map(u=>u.email).join(","));
  await new Promise(r=>setTimeout(r,100));
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
