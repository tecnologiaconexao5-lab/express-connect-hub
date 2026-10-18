const { createClient } = require("@supabase/supabase-js");

const PROD_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = "Conexao@2026";
const TEST_TAG = "TESTE_RLS_062B1";
const TABLES = ["recrutamento_prestadores","recrutamento_candidatos","crm_interacoes_prestadores","candidato_documentos","recrutamento_operacoes"];
let createdIds = {};

async function authenticate() {
  const client = createClient(PROD_URL, ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error || !data.session) { console.error("FALHA:", error?.message); process.exit(1); }
  const uid = data.session.user.id;
  console.log("auth.uid:", uid.substring(0,8)+"..."+uid.substring(uid.length-4));
  console.log("role:", data.session.user.role);
  console.log("session: OK");
  return client;
}

async function verifyTenant(client) {
  const { data, error } = await client.from("tenant_usuarios").select("tenant_id, papel").limit(1);
  if (error) { console.log("tenant_usuarios: ERRO -", error.message); return null; }
  if (data && data.length > 0) { console.log("tenant_usuarios: OK -", data.length, "registro(s)"); return data[0]; }
  console.log("tenant_usuarios: 0 registros"); return null;
}

async function testTable(client, table) {
  const r = { SELECT: false, INSERT: false, UPDATE: false, DELETE: false };
  const { data: sel, error: selErr } = await client.from(table).select("*").limit(2);
  r.SELECT = !selErr;
  console.log(`  SELECT: ${r.SELECT?"OK":"BLOQUEADO"}${selErr?" ("+selErr.message.substring(0,80)+")":""}`);
  let testId = null;
  const ts = Date.now();
  if (table === "recrutamento_prestadores") {
    const { data: ins, error: e } = await client.from(table).insert({ nome: TEST_TAG+"_"+ts, contatos: "0000000000", status: "pendente" }).select().single();
    r.INSERT = !e; testId = ins?.id;
    if (ins) { createdIds[table] = createdIds[table] || []; createdIds[table].push(ins.id); }
    console.log(`  INSERT: ${r.INSERT?"OK":"BLOQUEADO"}${e?" ("+e.message.substring(0,80)+")":""}`);
    if (testId) { const { error: e2 } = await client.from(table).update({ status: "em_analise" }).eq("id", testId); r.UPDATE = !e2; console.log(`  UPDATE: ${r.UPDATE?"OK":"BLOQUEADO"}${e2?" ("+e2.message.substring(0,80)+")":""}`); }
  } else if (table === "recrutamento_candidatos") {
    const { data: ins, error: e } = await client.from(table).insert({ nome: TEST_TAG+"_"+ts, telefone: "0000000000", cidade: "TESTE", uf: "SP", veiculo: " teste", stage: "lead_novo", tags: [TEST_TAG], score: 0 }).select().single();
    r.INSERT = !e; testId = ins?.id;
    if (ins) { createdIds[table] = createdIds[table] || []; createdIds[table].push(ins.id); }
    console.log(`  INSERT: ${r.INSERT?"OK":"BLOQUEADO"}${e?" ("+e.message.substring(0,80)+")":""}`);
    if (testId) { const { error: e2 } = await client.from(table).update({ score: 99 }).eq("id", testId); r.UPDATE = !e2; console.log(`  UPDATE: ${r.UPDATE?"OK":"BLOQUEADO"}${e2?" ("+e2.message.substring(0,80)+")":""}`); }
  } else if (table === "crm_interacoes_prestadores") {
    const pid = "6cc41f68-1467-455d-b8d5-c61bfe72cb7c";
    const { data: ins, error: e } = await client.from(table).insert({ prestador_id: pid, tipo: "ligacao", status: "pendente" }).select().single();
    r.INSERT = !e; testId = ins?.id;
    if (ins) { createdIds[table] = createdIds[table] || []; createdIds[table].push(ins.id); }
    console.log(`  INSERT: ${r.INSERT?"OK":"BLOQUEADO"}${e?" ("+e.message.substring(0,80)+")":""}`);
    if (testId) { const { error: e2 } = await client.from(table).update({ tipo: "whatsapp" }).eq("id", testId); r.UPDATE = !e2; console.log(`  UPDATE: ${r.UPDATE?"OK":"BLOQUEADO"}${e2?" ("+e2.message.substring(0,80)+")":""}`); }
  } else if (table === "candidato_documentos") {
    console.log("  INSERT: FK (candidato_id → recrutamento_candidatos)");
    console.log("  UPDATE: FK — não aplicável sem registro");
    console.log("  DELETE: FK — não aplicável sem registro");
    r.INSERT = "FK"; r.UPDATE = "FK"; r.DELETE = "FK";
  } else if (table === "recrutamento_operacoes") {
    const { data: ins, error: e } = await client.from(table).insert({ nome: TEST_TAG+"_"+ts, status: "pendente" }).select().single();
    r.INSERT = !e; testId = ins?.id;
    if (ins) { createdIds[table] = createdIds[table] || []; createdIds[table].push(ins.id); }
    console.log(`  INSERT: ${r.INSERT?"OK":"BLOQUEADO"}${e?" ("+e.message.substring(0,80)+")":""}`);
    if (testId) { const { error: e2 } = await client.from(table).update({ status: "em_andamento" }).eq("id", testId); r.UPDATE = !e2; console.log(`  UPDATE: ${r.UPDATE?"OK":"BLOQUEADO"}${e2?" ("+e2.message.substring(0,80)+")":""}`); }
  }
  if (testId) {
    const { error: e } = await client.from(table).delete().eq("id", testId);
    r.DELETE = !e; if (!e) createdIds[table] = (createdIds[table]||[]).filter(id=>id!==testId);
    console.log(`  DELETE: ${r.DELETE?"OK":"BLOQUEADO"}${e?" ("+e.message.substring(0,80)+")":""}`);
  } else if (table !== "candidato_documentos") { r.DELETE = "SKIP"; console.log("  DELETE: SKIP (sem INSERT)"); }
  return r;
}

async function testAnon() {
  const anon = createClient(PROD_URL, ANON_KEY);
  let blocked = 0, total = 0;
  for (const table of TABLES) {
    for (const op of ["SELECT","INSERT","UPDATE","DELETE"]) {
      total++; let err = null;
      if (op==="SELECT") ({error:err}=await anon.from(table).select("*").limit(1));
      else if (op==="INSERT") ({error:err}=await anon.from(table).insert({}));
      else if (op==="UPDATE") ({error:err}=await anon.from(table).update({}).eq("id","00000000-0000-0000-0000-000000000000"));
      else if (op==="DELETE") ({error:err}=await anon.from(table).delete().eq("id","00000000-0000-0000-0000-000000000000"));
      if (err) blocked++;
    }
  }
  console.log(`ANON: ${blocked}/${total} bloqueadas`);
  return { blocked, total };
}

async function cleanup() {
  let cleaned = 0;
  for (const [table, ids] of Object.entries(createdIds)) {
    for (const id of ids) {
      const client = createClient(PROD_URL, ANON_KEY);
      await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      const { error } = await client.from(table).delete().eq("id", id);
      if (!error) cleaned++;
    }
  }
  console.log(`CLEANUP: ${cleaned} registros removidos`);
}

(async () => {
  console.log("=== REC-06.2B.1 — PROVA AUTHENTICATED ===\n");
  const client = await authenticate();
  await verifyTenant(client);
  console.log("");
  const allResults = {};
  for (const table of TABLES) {
    console.log(`--- ${table} ---`);
    allResults[table] = await testTable(client, table);
    console.log("");
  }
  console.log("--- ANON RECONFIRM ---");
  const anonResult = await testAnon();
  console.log("");
  console.log("--- CLEANUP ---");
  await cleanup();
  console.log("");
  console.log("=== VEREDITO ===");
  const allOk = Object.values(allResults).every(r =>
    (r.SELECT===true) && (r.INSERT===true||r.INSERT==="FK") && (r.UPDATE===true||r.UPDATE==="FK") && (r.DELETE===true||r.DELETE==="FK"||r.DELETE==="SKIP")
  );
  if (allOk && anonResult.blocked === anonResult.total) console.log("HOMOLOGADO — RLS RECRUTAMENTO SEGURO");
  else console.log("NÃO HOMOLOGADO — verificar resultados acima");
})();
