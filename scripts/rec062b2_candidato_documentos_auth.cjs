const { createClient } = require("@supabase/supabase-js");

const PROD_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = "Conexao@2026";
const TEST_TAG = "TESTE_RLS_062B2";
const ts = Date.now();

async function authenticate() {
  const c = createClient(PROD_URL, ANON_KEY);
  const { data, error } = await c.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error || !data.session) { console.error("FALHA:", error?.message); process.exit(1); }
  const uid = data.session.user.id;
  console.log("auth.uid:", uid.substring(0,8)+"..."+uid.substring(uid.length-4));
  console.log("role:", data.session.user.role);
  console.log("session: OK");
  return c;
}

async function cleanupChain(client) {
  console.log("--- CLEANUP ---");
  let cleaned = 0;
  const { data: docs } = await client.from("candidato_documentos").select("id").like("tipo", TEST_TAG+"%");
  if (docs?.length) { for (const d of docs) { await client.from("candidato_documentos").delete().eq("id", d.id); cleaned++; } }
  console.log("  documentos removidos:", cleaned);
  const { data: cats } = await client.from("recrutamento_candidatos").select("id").like("nome", TEST_TAG+"%");
  if (cats?.length) { for (const c2 of cats) { await client.from("recrutamento_candidatos").delete().eq("id", c2.id); cleaned++; } }
  console.log("  candidatos removidos:", cats?.length || 0);
  const { data: prests } = await client.from("recrutamento_prestadores").select("id").like("nome", TEST_TAG+"%");
  if (prests?.length) { for (const p of prests) { await client.from("recrutamento_prestadores").delete().eq("id", p.id); cleaned++; } }
  console.log("  prestadores removidos:", prests?.length || 0);
  return cleaned;
}

(async () => {
  console.log("=== REC-06.2B.2 — CRUD AUTH REAL CANDIDATO_DOCUMENTOS ===\n");

  const client = await authenticate();

  // 1. Criar cadeia TESTE
  console.log("--- CADEIA TESTE ---");
  const { data: prest, error: e1 } = await client.from("recrutamento_prestadores").insert({ nome: TEST_TAG+"_"+ts, contatos: "0000000000", status: "pendente" }).select().single();
  if (e1) { console.log("ERRO prestador:", e1.message); process.exit(1); }
  console.log("  prestador:", prest.id.substring(0,8));

  const { data: cat, error: e2 } = await client.from("recrutamento_candidatos").insert({ nome: TEST_TAG+"_"+ts, telefone: "0000000000", cidade: "TESTE", uf: "SP", veiculo: " teste", stage: "lead_novo", tags: [TEST_TAG], score: 0, prestador_id: prest.id }).select().single();
  if (e2) { console.log("ERRO candidato:", e2.message); process.exit(1); }
  console.log("  candidato:", cat.id.substring(0,8));

  // 2. SELECT candidato_documentos
  console.log("\n--- candidato_documentos CRUD ---");
  const { data: sel, error: selErr } = await client.from("candidato_documentos").select("*").limit(2);
  console.log("  SELECT:", selErr ? "BLOQUEADO ("+selErr.message.substring(0,80)+")" : "OK ("+sel?.length+" rows)");

  // 3. INSERT
  const { data: doc, error: e3 } = await client.from("candidato_documentos").insert({ candidato_id: cat.id, tipo: TEST_TAG+"_"+ts }).select().single();
  console.log("  INSERT:", e3 ? "BLOQUEADO ("+e3.message.substring(0,80)+")" : "OK ("+doc?.id?.substring(0,8)+")");

  if (doc) {
    // 4. UPDATE
    const { error: e4 } = await client.from("candidato_documentos").update({ tipo: TEST_TAG+"_UPD_"+ts }).eq("id", doc.id);
    console.log("  UPDATE:", e4 ? "BLOQUEADO ("+e4.message.substring(0,80)+")" : "OK");

    // 5. DELETE
    const { error: e5 } = await client.from("candidato_documentos").delete().eq("id", doc.id);
    console.log("  DELETE:", e5 ? "BLOQUEADO ("+e5.message.substring(0,80)+")" : "OK");
  }

  // Cleanup
  await cleanupChain(client);

  // Verify zero
  console.log("\n--- VERIFICACAO FINAL ---");
  const { data: cd } = await client.from("candidato_documentos").select("id").like("tipo", TEST_TAG+"%");
  const { data: cc } = await client.from("recrutamento_candidatos").select("id").like("nome", TEST_TAG+"%");
  const { data: cp } = await client.from("recrutamento_prestadores").select("id").like("nome", TEST_TAG+"%");
  console.log("  docs:", cd?.length||0, "| cats:", cc?.length||0, "| prests:", cp?.length||0);

  // Anon test
  console.log("\n--- ANON RECONFIRM ---");
  const anon = createClient(PROD_URL, ANON_KEY);
  let blocked = 0, total = 0;
  for (const op of ["SELECT","INSERT","UPDATE","DELETE"]) {
    total++; let err = null;
    if (op==="SELECT") ({error:err}=await anon.from("candidato_documentos").select("*").limit(1));
    else if (op==="INSERT") ({error:err}=await anon.from("candidato_documentos").insert({}));
    else if (op==="UPDATE") ({error:err}=await anon.from("candidato_documentos").update({}).eq("id","00000000-0000-0000-0000-000000000000"));
    else if (op==="DELETE") ({error:err}=await anon.from("candidato_documentos").delete().eq("id","00000000-0000-0000-0000-000000000000"));
    if (err) blocked++;
  }
  console.log("  ANON:", blocked+"/"+total+" bloqueadas");

  const allOk = !selErr && !e3 && !e4 && !e5;
  const zero = (cd?.length||0)===0 && (cc?.length||0)===0 && (cp?.length||0)===0;
  console.log("\n=== VEREDITO ===");
  if (allOk && blocked===total && zero) console.log("HOMOLOGADO — RLS RECRUTAMENTO SEGURO");
  else console.log("NÃO HOMOLOGADO — verificar resultados acima");
})();
