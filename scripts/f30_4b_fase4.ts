import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

async function main() {
  console.log("========================================");
  console.log("F30.4B — FASE 4 - TESTE DE SEGURANCA");
  console.log("========================================\n");

  const { data: financeiro } = await supabase.from("automacoes_robos").select("id, nome").eq("nome", "Financeiro IA").limit(1).single();
  if (!financeiro) { console.error("Financeiro IA not found"); process.exit(1); }
  console.log("Robo SEM permissao:", financeiro.nome, "ID:", financeiro.id.slice(0, 8) + "...");

  const { data: vaga } = await supabase.from("ia_ferramentas").select("id, nome, codigo_unico").eq("codigo_unico", "COM_PUBLICAR_VAGA").single();
  if (!vaga) { console.error("Publicar Vaga not found"); process.exit(1); }
  console.log("Ferramenta:", vaga.nome, "(" + vaga.codigo_unico + ")");

  const { data: perm } = await supabase.from("ia_robo_ferramentas").select("*").eq("robo_id", financeiro.id).eq("ferramenta_id", vaga.id).eq("ativo", true).maybeSingle();

  if (perm) {
    console.log("\n" + String.fromCodePoint(10060) + " PERMISSAO ENCONTRADA (inesperado)");
  } else {
    console.log("\n" + String.fromCodePoint(9989) + " BLOQUEADO: Financeiro IA NAO possui permissao para Publicar Vaga");
  }

  const { data: comercial } = await supabase.from("automacoes_robos").select("id, nome").eq("nome", "Comercial IA").limit(1).single();
  const { data: email } = await supabase.from("ia_ferramentas").select("id, nome, codigo_unico").eq("codigo_unico", "COM_ENVIAR_EMAIL").single();

  if (comercial && email) {
    const { data: permOk } = await supabase.from("ia_robo_ferramentas").select("*").eq("robo_id", comercial.id).eq("ferramenta_id", email.id).eq("ativo", true).maybeSingle();
    console.log("\n" + String.fromCodePoint(9989) + " Comercial IA " + (permOk ? "TEM" : "NAO TEM") + " permissao para " + email.nome);
  }
  
  console.log("\n========================================");
  console.log("FASE 4 - CONCLUIDA");
  console.log("========================================");
}

main().catch(console.error);
