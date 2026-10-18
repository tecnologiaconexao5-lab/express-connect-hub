import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CLIENT_EMAIL = "cliente.teste@conexaoexpress.com.br";
const CLIENT_PASSWORD = "Teste@2026";

async function main() {
  console.log("=".repeat(72));
  console.log("CRIAÇÃO OFICIAL DO USUÁRIO CLIENTE");
  console.log("=".repeat(72));

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || "",
    process.env.VITE_SUPABASE_ANON_KEY || ""
  );

  const pgClient = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  // Step 1: Check if user already exists
  const { rows: existing } = await pgClient.query(
    `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
    [CLIENT_EMAIL]
  );

  if (existing.length > 0) {
    console.log(`\nUsuário já existe em auth.users: ${existing[0].id}. Removendo...`);
    await pgClient.query(`DELETE FROM auth.identities WHERE user_id = $1`, [existing[0].id]);
    await pgClient.query(`DELETE FROM auth.users WHERE id = $1`, [existing[0].id]);
  }

  // Step 2: Create via signUp (official Supabase Auth flow)
  console.log("\n1. Criando usuário via supabase.auth.signUp()...");
  const { data, error } = await supabase.auth.signUp({
    email: CLIENT_EMAIL,
    password: CLIENT_PASSWORD,
    options: {
      data: {
        name: "Cliente Teste",
        papel: "cliente",
      },
    },
  });

  if (error) {
    console.error(`signUp ERRO: ${error.message}`);
    process.exit(1);
  }

  if (!data.user) {
    console.error("signUp não retornou usuário");
    process.exit(1);
  }

  const userId = data.user.id;
  console.log(`   ✅ Usuário criado: ${userId}`);
  console.log(`   Email: ${CLIENT_EMAIL}`);

  // Step 3: Confirm email via SQL
  console.log("\n2. Confirmando email via SQL...");
  await pgClient.query(
    `UPDATE auth.users SET
       email_confirmed_at = NOW(),
       confirmation_sent_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  // Fix identity: match Supabase Auth identity format
  await pgClient.query(
    `UPDATE auth.identities SET
       provider_id = $1,
       identity_data = $2
     WHERE user_id = $3 AND provider = 'email'`,
    [
      userId,
      JSON.stringify({
        sub: userId,
        email: CLIENT_EMAIL,
        email_verified: false,
        phone_verified: false,
      }),
      userId,
    ]
  );
  console.log(`   ✅ Email confirmado, identity fixada`);

  // Step 4: Create business records
  console.log("\n3. Criando registros de negócio...");

  // First, find a client to link to, or create one
  const { rows: clientes } = await pgClient.query(
    `SELECT id, razao_social FROM clientes LIMIT 1`
  );

  let clienteId: string;
  if (clientes.length > 0) {
    clienteId = clientes[0].id;
    console.log(`   Usando cliente existente: ${clientes[0].razao_social} (${clienteId})`);
  } else {
    // Create a new client
    const { rows: newClient } = await pgClient.query(`
      INSERT INTO clientes (id, razao_social, nome_fantasia, cnpj, status, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Cliente Teste Ltda', 'Cliente Teste', '00.000.000/0001-91', 'Ativo', NOW(), NOW())
      RETURNING id
    `);
    clienteId = newClient[0].id;
    console.log(`   Cliente criado: ${clienteId}`);
  }

  // Create usuarios_cliente (only 5 columns exist)
  await pgClient.query(`
    INSERT INTO usuarios_cliente (id, auth_user_id, cliente_id, ativo, created_at)
    VALUES (gen_random_uuid(), $1, $2, true, NOW())
    ON CONFLICT DO NOTHING
  `, [userId, clienteId]);
  console.log(`   ✅ usuarios_cliente criado (auth_user_id=${userId}, cliente_id=${clienteId})`);

  // Create tenant_usuarios (column is user_id, NOT auth_user_id)
  const { rows: existingTU } = await pgClient.query(
    `SELECT id FROM tenant_usuarios WHERE user_id = $1`,
    [userId]
  );
  if (existingTU.length === 0) {
    await pgClient.query(`
      INSERT INTO tenant_usuarios (id, tenant_id, user_id, papel, status, criado_em, atualizado_em)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', $1, 'cliente', 'ativo', NOW(), NOW())
    `, [userId]);
    console.log(`   ✅ tenant_usuarios criado (papel=cliente)`);
  } else {
    console.log(`   ⚠️ tenant_usuarios já existia`);
  }

  // Create OS (alocacoes_escala) linked to cliente_id
  const statusList = ['planejada', 'aceita', 'em_rota', 'concluida', 'aceita'];
  for (let i = 0; i < 5; i++) {
    await pgClient.query(`
      INSERT INTO alocacoes_escala (cliente_id, data_escala, tipo_veiculo, origem, destino)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      clienteId,
      new Date(Date.now() + (i - 2) * 86400000).toISOString().split('T')[0],
      i % 2 === 0 ? 'VUC' : 'TOCO',
      'São Paulo, SP',
      i % 2 === 0 ? 'Rio de Janeiro, RJ' : 'Belo Horizonte, MG',
    ]);
  }
  console.log(`   ✅ 5 OS criadas em alocacoes_escala`);

  // Create financeiro_receber records
  await pgClient.query(`
    INSERT INTO financeiro_receber (id, cliente_id, descricao, valor, vencimento, status, created_at, updated_at)
    VALUES
      (gen_random_uuid(), $1, 'Serviço de Transporte - Mês', 1500.00, $2, 'Pendente', NOW(), NOW()),
      (gen_random_uuid(), $1, 'Frete - Nota Fiscal 1234', 3200.50, $3, 'Recebido', NOW(), NOW()),
      (gen_random_uuid(), $1, 'Taxa de Armazenagem', 890.75, $4, 'Atrasado', NOW(), NOW())
  `, [
    clienteId,
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
  ]);
  console.log(`   ✅ 3 registros financeiros criados`);

  // Step 5: Test login
  console.log("\n4. Testando login...");
  
  // Wait a moment for DB consistency
  await new Promise(r => setTimeout(r, 2000));

  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: CLIENT_EMAIL,
    password: CLIENT_PASSWORD,
  });

  if (loginErr) {
    console.error(`   ❌ LOGIN FALHOU: ${loginErr.message}`);
    if (loginErr.message.includes("Email not confirmed")) {
      console.log("   ⚠️ Email ainda não confirmado. Tentando confirmar novamente...");
      await pgClient.query(
        `UPDATE auth.users SET email_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [userId]
      );
      await new Promise(r => setTimeout(r, 1000));
      
      const { data: login2, error: err2 } = await supabase.auth.signInWithPassword({
        email: CLIENT_EMAIL,
        password: CLIENT_PASSWORD,
      });
      if (err2) {
        console.error(`   ❌ LOGIN AINDA FALHA: ${err2.message}`);
      } else {
        console.log(`   ✅ LOGIN OK! Token: ${login2.session?.access_token?.substring(0, 30)}...`);
      }
    }
  } else {
    console.log(`   ✅ LOGIN OK! Token: ${loginData.session?.access_token?.substring(0, 30)}...`);
  }

  console.log("\n" + "=".repeat(72));
  console.log("USUÁRIO CRIADO COM SUCESSO");
  console.log("=".repeat(72));
  console.log(`Email:    ${CLIENT_EMAIL}`);
  console.log(`Senha:    ${CLIENT_PASSWORD}`);
  console.log(`Auth ID:  ${userId}`);
  console.log(`Cliente:  ${clienteId}`);

  // Final verification
  const verifyUser = await pgClient.query(
    `SELECT u.id, u.email, u.email_confirmed_at, u.raw_user_meta_data,
            uc.cliente_id, tu.papel
     FROM auth.users u
     LEFT JOIN usuarios_cliente uc ON uc.auth_user_id = u.id
     LEFT JOIN tenant_usuarios tu ON tu.user_id = u.id
     WHERE u.email = $1`,
    [CLIENT_EMAIL]
  );
  if (verifyUser.rows.length > 0) {
    const v = verifyUser.rows[0];
    console.log(`\nVerificação final:`);
    console.log(`  Auth user: ${v.id}`);
    console.log(`  Email confirmado: ${v.email_confirmed_at ? 'SIM' : 'NÃO'}`);
    console.log(`  usuarios_cliente: ${v.cliente_id ? 'SIM' : 'NÃO'}`);
    console.log(`  tenant_usuarios papel: ${v.papel}`);
    console.log(`  Meta: ${JSON.stringify(v.raw_user_meta_data)}`);
  }

  await pgClient.end();
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
