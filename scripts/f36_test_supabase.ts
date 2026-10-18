// ============================================================
// F36 — Teste Supabase: Identidade, Sessões e Credenciais
// ============================================================
// Uso: npx tsx scripts/f36_test_supabase.ts
// ============================================================

import { supabase } from "../src/lib/supabase";

const ROBO_ID = "257f6d28-9b0f-4969-81a8-8e220edc73e6"; // Comercial IA

function log(label: string, data: unknown) {
  console.log(`  [${label}]`, JSON.stringify(data, null, 2).slice(0, 200));
}

async function testarCriacaoIdentidade() {
  console.log("\n🧪 1. Criar identidade digital");
  const { data: identidade, error } = await supabase.from("ia_identidades").upsert({
    robo_id: ROBO_ID,
    nome_operacional: "Comercial Bot Alpha",
    email_operacional: "comercial@expressconnecthub.com",
    status: "ativa",
    perfil: "comercial",
    timezone: "America/Sao_Paulo",
    idioma: "pt-BR",
    configuracao_operacional: { horario_comercial: "08:00-18:00", dias_uteis: true },
    configuracao_cognitiva: { tom: "profissional", estilo: "formal" },
    metadata: { versao: "1.0", setor: "vendas" },
  }, { onConflict: "robo_id" }).select().single();

  if (error) { console.error("  ❌ Erro:", error.message); return null; }
  console.log("  ✅ Identidade:", identidade.id);
  return identidade as { id: string };
}

async function testarListarIdentidades() {
  console.log("\n🧪 2. Listar identidades por perfil");
  const { data } = await supabase.from("ia_identidades").select("id, nome_operacional, perfil, status").limit(5);
  console.log(`  ✅ ${(data || []).length} identidades encontradas`);
  return data;
}

async function testarCriarCredencial() {
  console.log("\n🧪 3. Criar credencial");
  let { data, error } = await supabase.from("ia_credenciais").insert({
    robo_id: ROBO_ID,
    tipo: "whatsapp",
    nome_credencial: "WhatsApp Comercial",
    provedor: "evolution_api",
    referencia_env: "VITE_EVOLUTION_API_KEY",
    escopos: ["enviar_mensagem", "status_conexao"],
    ativo: true,
  }).select().single();

  if (error) {
    const { data: existing } = await supabase.from("ia_credenciais").select("*")
      .eq("robo_id", ROBO_ID).eq("tipo", "whatsapp").eq("nome_credencial", "WhatsApp Comercial").maybeSingle();
    if (existing) {
      data = existing; console.log("  ✅ Credencial (já existia):", data.id);
    } else {
      console.error("  ❌ Erro:", error.message); return null;
    }
  } else {
    console.log("  ✅ Credencial:", data.id);
  }
  return data as { id: string };
}

async function testarListarCredenciais() {
  console.log("\n🧪 4. Listar credenciais do robô");
  const { data } = await supabase.from("ia_credenciais").select("*").eq("robo_id", ROBO_ID);
  console.log(`  ✅ ${(data || []).length} credenciais encontradas`);
  return data;
}

async function testarIniciarSessao() {
  console.log("\n🧪 5. Iniciar sessão operacional");
  const { data: identidade } = await supabase.from("ia_identidades").select("id").eq("robo_id", ROBO_ID).single();
  const { data, error } = await supabase.from("ia_sessoes_operacionais").insert({
    robo_id: ROBO_ID,
    identidade_id: identidade?.id || null,
    motivo: "Teste F36: verificação de pipeline comercial",
    status: "ativa",
    contexto_inicial: { origem: "teste_automatizado", pipeline: "comercial" },
    criado_por: "test_script",
  }).select().single();

  if (error) { console.error("  ❌ Erro:", error.message); return null; }
  console.log("  ✅ Sessão:", data.id);
  return data as { id: string; inicio: string };
}

async function testarEncerrarSessao(sessaoId: string) {
  console.log("\n🧪 6. Encerrar sessão operacional");
  const { data: sessao } = await supabase.from("ia_sessoes_operacionais").select("inicio").eq("id", sessaoId).single();
  if (!sessao) { console.error("  ❌ Sessão não encontrada"); return; }

  const inicio = new Date(sessao.inicio).getTime();
  const duracao = Math.floor((Date.now() - inicio) / 1000);

  const { data, error } = await supabase.from("ia_sessoes_operacionais").update({
    status: "concluida",
    fim: new Date().toISOString(),
    duracao_segundos: duracao,
    resultado: { acoes_executadas: 3, status_final: "sucesso" },
    encerrado_por: "test_script",
  }).eq("id", sessaoId).select().single();

  if (error) { console.error("  ❌ Erro:", error.message); return; }
  console.log(`  ✅ Sessão encerrada (${duracao}s)`);
  return data;
}

async function testarListarSessoes() {
  console.log("\n🧪 7. Listar sessões do robô");
  const { data } = await supabase
    .from("ia_sessoes_operacionais")
    .select("id, motivo, status, inicio, fim, duracao_segundos, total_acoes")
    .eq("robo_id", ROBO_ID)
    .order("inicio", { ascending: false });
  console.log(`  ✅ ${(data || []).length} sessões encontradas`);
  return data;
}

async function testarBuscarSessaoCompleta(sessaoId: string) {
  console.log("\n🧪 8. Buscar sessão com dados da identidade");
  const { data } = await supabase
    .from("ia_sessoes_operacionais")
    .select("*, ia_identidades!inner(nome_operacional, perfil)")
    .eq("id", sessaoId)
    .single();
  if (data) {
    console.log(`  ✅ Sessão encontrada, identidade vinculada`);
  } else {
    console.log("  ⚠️ Sessão não encontrada ou sem identidade");
  }
  return data;
}

async function testarCascadeDelete() {
  console.log("\n🧪 9. Testar cascade — remover credencial");
  const { data: creds } = await supabase.from("ia_credenciais").select("id").eq("robo_id", ROBO_ID).limit(1);
  if (creds && creds.length > 0) {
    const { error } = await supabase.from("ia_credenciais").delete().eq("id", creds[0].id);
    if (error) { console.error("  ❌ Erro:", error.message); return; }
    console.log("  ✅ Credencial removida com sucesso");
  } else {
    console.log("  ⚠️ Nenhuma credencial para remover");
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 F36 — Teste Supabase: Identidade, Sessões e Credenciais");
  console.log("=".repeat(60));

  const identidade = await testarCriacaoIdentidade();
  if (!identidade) return;

  const idents = await testarListarIdentidades();
  if (!idents) return;

  const credencial = await testarCriarCredencial();
  if (!credencial) return;

  const creds = await testarListarCredenciais();
  if (!creds) return;

  const sessao = await testarIniciarSessao();
  if (!sessao) return;

  await testarListarSessoes();

  await testarEncerrarSessao(sessao.id);

  await testarBuscarSessaoCompleta(sessao.id);

  await testarCascadeDelete();

  console.log("\n" + "=".repeat(60));
  console.log("🏁 F36 — Teste concluído!");
  console.log("=".repeat(60));
}

main().catch(console.error);
