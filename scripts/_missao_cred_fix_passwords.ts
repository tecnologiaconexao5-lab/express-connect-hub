/**
 * MISSÃO — CORRIGIR SENHAS REAIS PARA TODOS OS USUÁRIOS
 *
 * Os placeholders (__CONEXAO2026_TAMIRIS__, __123456_CONTATO__, etc.)
 * nunca foram substituídos por senhas reais. Este script define senhas
 * conhecidas e funcionais usando pgcrypto (mesmo algoritmo do Supabase Auth).
 *
 * Senhas definidas (documentadas no final):
 *   admin:       Conexao@2026
 *   atendimento: Conexao@2026
 *   financeiro:  Conexao@2026
 *   comercial:   Conexao@2026
 *   operacional: Conexao@2026
 *   cliente:     Teste@2026 (já funciona, apenas re-confirmamos)
 */

import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

interface UserToFix {
  email: string;
  newPassword: string;
  label: string;
}

const USERS: UserToFix[] = [
  { email: "tamiris.castilho@conexaoexpress.com.br", newPassword: "Conexao@2026", label: "ADMIN (tamiris.castilho)" },
  { email: "contato@conexaoexpress.com.br", newPassword: "Conexao@2026", label: "ATENDIMENTO (contato)" },
  { email: "financeiro@conexaoexpress.com.br", newPassword: "Conexao@2026", label: "FINANCEIRO" },
  { email: "comercial@conexaoexpress.com.br", newPassword: "Conexao@2026", label: "COMERCIAL" },
  { email: "operacional@conexaoexpress.com.br", newPassword: "Conexao@2026", label: "OPERACIONAL" },
  { email: "cliente.teste@conexaoexpress.com.br", newPassword: "Teste@2026", label: "CLIENTE (já funcional, re-confirmando)" },
];

async function main() {
  console.log("=".repeat(72));
  console.log("MISSÃO — CORRIGIR SENHAS REAIS");
  console.log("=".repeat(72));

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let ok = 0;
  let fail = 0;

  for (const user of USERS) {
    console.log(`\n[${user.label}]`);
    console.log(`  Email: ${user.email}`);

    // Check if user exists
    const existing = await client.query(
      `SELECT id, email, email_confirmed_at FROM auth.users WHERE email = $1 LIMIT 1`,
      [user.email]
    );

    if (existing.rows.length === 0) {
      console.log(`  ❌ Usuário não encontrado em auth.users`);
      fail++;
      continue;
    }

    const userId = existing.rows[0].id;
    const wasConfirmed = existing.rows[0].email_confirmed_at !== null;

    // Fix 1: Set password using pgcrypto (bcrypt, cost 10)
    await client.query(
      `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf', 10)), updated_at = NOW() WHERE id = $2`,
      [user.newPassword, userId]
    );
    console.log(`  ✅ Senha atualizada para: ${user.newPassword}`);

    // Fix 2: Ensure email is confirmed
    if (!wasConfirmed) {
      await client.query(
        `UPDATE auth.users SET email_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [userId]
      );
      console.log(`  ✅ Email confirmado`);
    } else {
      console.log(`  ✅ Email já estava confirmado`);
    }

    // Verify password match
    const pwCheck = await client.query(
      `SELECT (encrypted_password = crypt($1, encrypted_password)) as pw_match
       FROM auth.users WHERE id = $2`,
      [user.newPassword, userId]
    );
    console.log(`  ✅ Verificação de senha: ${pwCheck.rows[0]?.pw_match === true ? "OK" : "FALHOU"}`);

    ok++;
  }

  // Check usuarios_cliente for cliente.teste
  console.log(`\n${"-".repeat(50)}`);
  console.log("VERIFICAÇÃO: usuarios_cliente para cliente.teste");
  const ucResult = await client.query(
    `SELECT uc.cliente_id, uc.ativo, c.razao_social, c.nome_fantasia
     FROM usuarios_cliente uc
     LEFT JOIN clientes c ON c.id = uc.cliente_id
     WHERE uc.auth_user_id = (SELECT id FROM auth.users WHERE email = 'cliente.teste@conexaoexpress.com.br')
       AND uc.ativo = true
     LIMIT 1`
  );
  if (ucResult.rows.length > 0) {
    const r = ucResult.rows[0];
    console.log(`  ✅ Vínculo encontrado:`);
    console.log(`     cliente_id: ${r.cliente_id}`);
    console.log(`     razao_social: ${r.razao_social || r.nome_fantasia || "N/A"}`);
  } else {
    console.log(`  ⚠️  Nenhum vínculo em usuarios_cliente. Tentando criar...`);
    // Try creating the link
    const clientResult = await client.query(
      `SELECT id, razao_social FROM clientes WHERE id IN (
         SELECT cliente_id FROM ordens_servico WHERE cliente_id IS NOT NULL LIMIT 1
       ) LIMIT 1`
    );
    if (clientResult.rows.length > 0) {
      const c = clientResult.rows[0];
      const authUserId = (await client.query(
        `SELECT id FROM auth.users WHERE email = 'cliente.teste@conexaoexpress.com.br' LIMIT 1`
      )).rows[0]?.id;
      if (authUserId) {
        await client.query(
          `INSERT INTO usuarios_cliente (auth_user_id, cliente_id, ativo, created_at, updated_at)
           VALUES ($1, $2, true, NOW(), NOW())
           ON CONFLICT (auth_user_id, cliente_id) DO UPDATE SET ativo = true, updated_at = NOW()`,
          [authUserId, c.id]
        );
        console.log(`  ✅ Vínculo criado: cliente_id=${c.id} (${c.razao_social})`);
      }
    } else {
      console.log(`  ❌ Não foi possível criar vínculo - nenhum cliente encontrado`);
    }
  }

  await client.end();

  console.log(`\n${"=".repeat(72)}`);
  console.log(`RESUMO: ${ok} OK, ${fail} FALHA`);
  console.log("");
  console.log("SENHAS DEFINIDAS:");
  for (const u of USERS) {
    console.log(`  ${u.email.padEnd(45)} ${u.newPassword}`);
  }
  console.log("=".repeat(72));
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
