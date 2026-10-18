// Script para SETAR SENHA REAL nos usuarios corporativos no Supabase Auth.
// Uso: node scripts/dev_set_admin_password.cjs
// Define a senha como "Admin@123" para todos os 5 usuarios.
// ATENCAO: Apenas para ambiente de desenvolvimento!

const bcrypt = require("bcryptjs");
const { execSync } = require("child_process");

const PASSWORD = "Admin@123";
const hash = bcrypt.hashSync(PASSWORD, 10);
// Supabase usa prefixo $2a$ no encrypted_password
const dbHash = hash.replace(/^\$2b\$/, "$2a$");

const USERS = [
  { email: "tamiris.castilho@conexaoexpress.com.br", name: "Tamiris Castilho" },
  { email: "financeiro@conexaoexpress.com.br", name: "Financeiro" },
  { email: "comercial@conexaoexpress.com.br", name: "Comercial" },
  { email: "operacional@conexaoexpress.com.br", name: "Operacional" },
  { email: "contato@conexaoexpress.com.br", name: "Contato" },
];

async function main() {
  console.log("=== DEFININDO SENHAS REAIS (DEV) ===");
  console.log(`Senha: ${PASSWORD}`);
  console.log(`Hash: ${dbHash}`);
  console.log("");

  for (const user of USERS) {
    const sql = `
      UPDATE auth.users
      SET
        encrypted_password = '${dbHash}',
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        confirmation_token = '',
        confirmation_sent_at = NOW(),
        updated_at = NOW()
      WHERE email = '${user.email}';
    `;

    try {
      const output = execSync(
        `supabase db query "${sql.replace(/"/g, '\\"').replace(/\n/g, " ")}" --linked`,
        {
          cwd: process.cwd(),
          encoding: "utf8",
          timeout: 30000,
        }
      );
      console.log(`[OK] ${user.email} (${user.name}): senha definida como "${PASSWORD}"`);
    } catch (err) {
      console.error(`[ERR] ${user.email}: ${err.message}`);
    }
  }

  console.log("");
  console.log("=== CONCLUIDO ===");
  console.log("Agora voce pode fazer login com qualquer um dos usuarios usando a senha: Admin@123");
  console.log("");
  console.log("Para testar pelo Playwright, execute:");
  console.log("  set PLAYWRIGHT_TAMIRIS_PASSWORD=Admin@123");
  console.log("  npx playwright test tests/e2e/controle-patio-m53.spec.ts");
  console.log("");
  console.log("URL do TMS Administrativo: http://localhost:8800/dashboard");
  console.log("URL do Portal Cliente: http://localhost:8800/portal-cliente");
}

main().catch(console.error);
