/**
 * Auditoria da Automação Comercial (Zoho, WP, IA, CRM)
 * Execução: npx tsx scripts/auditoria-comercial.ts
 */

import * as fs from "fs";
import * as path from "path";
import { config as dotenvConfig } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Carrega variáveis do .env
dotenvConfig({ path: path.resolve(process.cwd(), ".env") });

import { iaService } from "../src/services/integracoes/iaService";
import { whatsappService } from "../src/services/integracoes/whatsappService";
import { zohoEmailService } from "../src/services/integracoes/zohoEmailService";
import { propostaService } from "../src/services/comercial/propostaService";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos no .env");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✅ ${label}`);
}

function fail(label: string, err?: any) {
  failed++;
  console.error(`  ❌ ${label}`, err || "");
}

async function auditarIA() {
  console.log("\n━━ MÓDULO IA ━━━━━━━━━━━━━━━━━━━━━━");
  try {
    const analise = await iaService.interpretarMensagemCliente("cotação pra são paulo urgente");
    if (analise.intencao === "solicitacao_cotacao") ok("Interpretação de NLP Mock");
    else fail("Interpretação de NLP falhou");

    const sugestao = await iaService.sugerirValorFrete("RJ", "SP", "VAN");
    if (sugestao.valorSugerido > 0) ok("Sugestão de Frete Inteligente");
    else fail("Falha ao sugerir frete");
  } catch(e) {
    fail("Erro módulo IA", e);
  }
}

async function auditarFluxoCompletoReal() {
  console.log("\n━━ FLUXO CRM REAL NO SUPABASE ━━━━━");
  try {
    // 1. Criar Lead Teste
    const leadTeste = {
      nome: "Cliente de Auditoria " + Date.now(),
      empresa: "Testes Automatizados S/A",
      telefone: "11999999999",
      email: "auditoria@conexao.com",
      status: "novo",
      origem: "manual"
    };

    const { data: novoLead, error: errLead } = await supabase.from("crm_leads").insert([leadTeste]).select("*").single();
    if (errLead) {
      fail("Falha ao criar lead no Supabase", errLead.message);
      return;
    }
    ok(`Lead criado com sucesso (ID: ${novoLead.id})`);

    // 2. Gerar Proposta Automática
    const prop = await propostaService.gerarPropostaAutomatica(novoLead, "Curitiba", "SP", "3/4", supabase);
    if (prop.id.startsWith("PROP-")) ok("Geração de proposta via IA");
    else fail("Falha ID da Proposta");

    // 3. Converter em OS (Isso insere na tabela ordens_servico e atualiza crm_leads)
    const conversao = await propostaService.converterEmOS(prop.id, novoLead, supabase);
    if (conversao.numeroOS.startsWith("OS-")) ok(`Conversão em OS automática (OS: ${conversao.numeroOS})`);
    else fail("Falha na conversão para OS");

    // 4. Validar no Supabase se convertido_os_id foi salvo
    const { data: leadAtualizado, error: errCheck } = await supabase.from("crm_leads").select("*").eq("id", novoLead.id).single();
    if (errCheck) {
      fail("Erro ao buscar lead para validar", errCheck.message);
    } else {
      if (leadAtualizado.status === "fechado" && leadAtualizado.convertido_os_id === conversao.osId) {
        ok(`Lead atualizado com convertido_os_id: ${conversao.osId}`);
      } else {
        fail("O lead não foi atualizado corretamente");
      }
    }

    // 5. Validar se OS realmente existe
    const { data: osCriada, error: errOs } = await supabase.from("ordens_servico").select("*").eq("id", conversao.osId).single();
    if (errOs) {
      fail("Erro ao buscar OS criada", errOs.message);
    } else {
      if (osCriada.numero === conversao.numeroOS) {
        ok("A OS foi gravada na tabela ordens_servico corretamente.");
      } else {
        fail("A OS salva difere da retornada no serviço.");
      }
    }

    // Opcional: Limpar dados de teste gerados
    await supabase.from("ordens_servico").delete().eq("id", conversao.osId);
    await supabase.from("crm_leads").delete().eq("id", novoLead.id);
    ok("Lixo de teste limpo (OS e Lead apagados).");

  } catch(e: any) {
    fail("Erro módulo Fluxo Real", e.message || e);
  }
}

async function run() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   AUDITORIA AUTOMAÇÃO COMERCIAL — TMS Conexão Express    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  await auditarIA();
  await auditarFluxoCompletoReal();
  
  console.log(`\n  RESULTADO FINAL: ${passed} ✅ aprovados | ${failed} ❌ falhas\n`);
  if (failed > 0) process.exit(1);
}

run();
