// ============================================================
// SCRIPT: MISSAO 50 — Seed de Autenticacao Real
// ============================================================
// Cria 5 usuarios corporativos REAIS no Supabase Auth + 5 agentes
// IA internos. Usa PLACEHOLDERS para senhas (substituir manualmente
// apos execucao do script via "Esqueci minha senha" no Supabase).
//
// EXECUCAO:
//   1. SUPABASE_SERVICE_ROLE_KEY no .env
//   2. npx tsx scripts/missao50_seed_auth_real.ts
//
// PLACEHOLDERS UTILIZADOS (SUBSTITUIR MANUALMENTE):
//   tamiris.castilho@conexaoexpress.com.br   → __CONEXAO2026_TAMIRIS__
//   financeiro@conexaoexpress.com.br          → __CONEXAO2026_FINANCEIRO__
//   comercial@conexaoexpress.com.br           → __123456_COMERCIAL__
//   operacional@conexaoexpress.com.br         → __123456_OPERACIONAL__
//   contato@conexaoexpress.com.br             → __123456_CONTATO__
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("ERRO: Defina SUPABASE_SERVICE_ROLE_KEY no .env");
  console.error(
    "Acesse: https://supabase.com/dashboard/project/uwrvzsjtpgaifkktpepn/settings/api"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000001";

interface UsuarioCorporativo {
  email: string;
  nome: string;
  papel: "super_admin" | "financeiro" | "comercial" | "operacional" | "cliente";
  perfil: string;
  placeholder_senha: string;
}

const USUARIOS_CORPORATIVOS: UsuarioCorporativo[] = [
  {
    email: "tamiris.castilho@conexaoexpress.com.br",
    nome: "Tamiris Castilho",
    papel: "super_admin",
    perfil: "DIRETORIA / ADMIN MASTER",
    placeholder_senha: "__CONEXAO2026_TAMIRIS__",
  },
  {
    email: "financeiro@conexaoexpress.com.br",
    nome: "Financeiro Conexao Express",
    papel: "financeiro",
    perfil: "DIRETORIA / FINANCEIRO MASTER",
    placeholder_senha: "__CONEXAO2026_FINANCEIRO__",
  },
  {
    email: "comercial@conexaoexpress.com.br",
    nome: "Comercial Conexao Express",
    papel: "comercial",
    perfil: "COMERCIAL",
    placeholder_senha: "__123456_COMERCIAL__",
  },
  {
    email: "operacional@conexaoexpress.com.br",
    nome: "Operacional Conexao Express",
    papel: "operacional",
    perfil: "OPERACIONAL",
    placeholder_senha: "__123456_OPERACIONAL__",
  },
  {
    email: "contato@conexaoexpress.com.br",
    nome: "Atendimento Conexao Express",
    papel: "cliente",
    perfil: "ATENDIMENTO / SUPORTE",
    placeholder_senha: "__123456_CONTATO__",
  },
];

interface ResultadoLinha {
  email: string;
  status: "criado" | "ja_existia" | "erro";
  user_id?: string;
  vinculo_id?: string;
  papel?: string;
  erro?: string;
}

async function main() {
  console.log("\n========================================");
  console.log("MISSAO 50 - SEED AUTENTICACAO REAL");
  console.log("Conexao Express / TMS");
  console.log("========================================\n");
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Tenant: ${TENANT_PRINCIPAL_ID}\n`);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, nome, slug")
    .eq("id", TENANT_PRINCIPAL_ID)
    .maybeSingle();

  if (!tenant) {
    console.error(`ERRO: Tenant principal nao encontrado (id ${TENANT_PRINCIPAL_ID})`);
    console.error("Execute primeiro a migration 20260626_missao15_multitenant_fundacao.sql");
    process.exit(1);
  }
  console.log(`Tenant ativo: ${tenant.nome} (${tenant.slug})\n`);

  console.log("--- ETAPA 1: Criar auth.users + tenant_usuarios ---\n");

  const resultados: ResultadoLinha[] = [];

  for (const uc of USUARIOS_CORPORATIVOS) {
    console.log(`Processando: ${uc.email}`);
    console.log(`  Nome: ${uc.nome}`);
    console.log(`  Papel: ${uc.papel} (${uc.perfil})`);
    console.log(`  Placeholder senha: ${uc.placeholder_senha}`);

    let userId: string;

    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const users: any[] = (listData as any)?.users || [];
    const existing = users.find((u: any) => u.email === uc.email);
    if (existing) {
      userId = existing.id;
      console.log(`  -> auth user JA EXISTIA: ${userId}`);

      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          name: uc.nome,
          perfil: uc.perfil,
          papel: uc.papel,
        },
      });
      if (updErr) {
        console.warn(`  ! Aviso ao atualizar metadata: ${updErr.message}`);
      } else {
        console.log(`  -> user_metadata atualizado`);
      }
      resultados.push({ email: uc.email, status: "ja_existia", user_id: userId, papel: uc.papel });
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: uc.email,
        password: uc.placeholder_senha,
        email_confirm: true,
        user_metadata: {
          name: uc.nome,
          perfil: uc.perfil,
          papel: uc.papel,
          missao: "missao_50_auth_real",
        },
      });

      if (createErr || !newUser?.user) {
        const msg = createErr?.message || "Falha desconhecida";
        console.error(`  X Erro ao criar auth user: ${msg}`);
        resultados.push({ email: uc.email, status: "erro", erro: msg });
        continue;
      }
      userId = newUser.user.id;
      console.log(`  -> auth user CRIADO: ${userId}`);
      resultados.push({ email: uc.email, status: "criado", user_id: userId, papel: uc.papel });
    }

    const { data: vinculoExistente } = await supabase
      .from("tenant_usuarios")
      .select("id")
      .eq("tenant_id", TENANT_PRINCIPAL_ID)
      .eq("user_id", userId)
      .maybeSingle();

    if (vinculoExistente) {
      const { error: upErr } = await supabase
        .from("tenant_usuarios")
        .update({
          papel: uc.papel,
          status: "ativo",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", vinculoExistente.id);
      if (upErr) {
        console.error(`  X Erro ao atualizar vinculo: ${upErr.message}`);
      } else {
        console.log(`  -> vinculo tenant_usuarios ATUALIZADO (papel=${uc.papel})`);
      }
      resultados[resultados.length - 1].vinculo_id = vinculoExistente.id;
    } else {
      const { data: vinculo, error: vincErr } = await supabase
        .from("tenant_usuarios")
        .insert({
          tenant_id: TENANT_PRINCIPAL_ID,
          user_id: userId,
          papel: uc.papel,
          status: "ativo",
        })
        .select("id")
        .single();

      if (vincErr || !vinculo) {
        console.error(`  X Erro ao criar vinculo: ${vincErr?.message}`);
      } else {
        console.log(`  -> vinculo tenant_usuarios CRIADO: ${vinculo.id}`);
        resultados[resultados.length - 1].vinculo_id = vinculo.id;
      }
    }

    await supabase.from("auth_eventos_auditoria").insert({
      user_id: userId,
      email: uc.email,
      tipo_evento: "usuario_seeded",
      perfil: uc.papel,
      metadata: { missao: "missao_50_auth_real", perfil_humano: uc.perfil },
    });

    console.log("");
  }

  console.log("--- ETAPA 2: Verificar agentes IA internos ---\n");

  const { data: agentes, error: agErr } = await supabase
    .from("agentes_ia_internos")
    .select("codigo, nome, setor, assinatura_execucao, ativo")
    .order("codigo");

  if (agErr) {
    console.error(`X Erro ao listar agentes: ${agErr.message}`);
  } else {
    console.log(`Agentes IA cadastrados: ${agentes?.length || 0}`);
    for (const a of agentes || []) {
      const flag = a.ativo ? "[ATIVO]" : "[INATIVO]";
      console.log(`  ${flag} ${a.assinatura_execucao} | ${a.codigo} | ${a.nome} | setor: ${a.setor}`);
    }
  }

  console.log("\n--- ETAPA 3: Verificar perfis de permissao ---\n");

  const { data: perfis } = await supabase
    .from("perfis_permissoes")
    .select("papel, modulo, pode_ver, pode_editar, pode_excluir")
    .order("papel, modulo");

  const perfisAgrupados: Record<string, number> = {};
  for (const p of perfis || []) {
    perfisAgrupados[p.papel] = (perfisAgrupados[p.papel] || 0) + 1;
  }
  for (const [papel, count] of Object.entries(perfisAgrupados)) {
    console.log(`  ${papel}: ${count} modulos configurados`);
  }

  console.log("\n--- ETAPA 4: Resumo ---\n");

  const criados = resultados.filter(r => r.status === "criado").length;
  const existentes = resultados.filter(r => r.status === "ja_existia").length;
  const erros = resultados.filter(r => r.status === "erro").length;

  console.log(`Usuarios processados: ${resultados.length}`);
  console.log(`  Criados:     ${criados}`);
  console.log(`  Ja existiam: ${existentes}`);
  console.log(`  Erros:       ${erros}`);

  console.log("\n--- ETAPA 5: PLACEHOLDERS DE SENHA ---\n");
  console.log("ATENCAO: As senhas foram gravadas como PLACEHOLDERS.");
  console.log("Substitua manualmente via Supabase Studio ou 'Esqueci minha senha':\n");
  for (const uc of USUARIOS_CORPORATIVOS) {
    console.log(`  ${uc.email}  =>  ${uc.placeholder_senha}`);
  }
  console.log("\nPara forcar reset de senha e envio de email:");
  console.log("  1. Supabase Studio > Authentication > Users > [usuario] > Send recovery email");
  console.log("  2. Ou execute: supabase.auth.admin.generateLink({ type: 'recovery', email })");
  console.log("");

  console.log("========================================");
  console.log("EXECUCAO CONCLUIDA");
  console.log("========================================\n");

  if (erros > 0) {
    console.error("ATENCAO: Houve erros. Verifique acima.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
