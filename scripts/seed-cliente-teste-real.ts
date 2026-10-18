import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomUUID } from "crypto";
import { guardHarness } from "./_guard.mjs";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/seed-cliente-teste-real.ts");

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const CLIENT_EMAIL = "cliente.teste@conexaoexpress.com.br";
const CLIENT_PASSWORD = "Teste@2026";
const CLIENT_RAZAO = "Empresa Teste Ltda";
const CLIENT_FANTASIA = "Empresa Teste";

async function main() {
  console.log("=== SEED CLIENTE TESTE REAL ===\n");

  if (!DATABASE_URL) {
    console.error("ERRO: DATABASE_URL nao definido no .env");
    process.exit(1);
  }

  const pgClient = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await pgClient.connect();
  console.log("Conectado ao PostgreSQL.\n");

  // 1. Check existing client
  const { rows: clientesExist } = await pgClient.query(
    `SELECT id, nome_fantasia, razao_social FROM clientes
     WHERE email = $1 OR nome_fantasia ILIKE $2 LIMIT 1`,
    [CLIENT_EMAIL, `%${CLIENT_FANTASIA}%`]
  );

  let clienteId: string;
  if (clientesExist.length > 0) {
    clienteId = clientesExist[0].id;
    console.log(`Cliente JA EXISTE: ${clientesExist[0].nome_fantasia} (${clienteId})`);
  } else {
    clienteId = randomUUID();
    await pgClient.query(
      `INSERT INTO clientes (id, razao_social, nome_fantasia, cnpj, email, status, cidade, uf, created_at)
       VALUES ($1, $2, $3, '00.000.000/0001-00', $4, 'ativo', 'Sao Paulo', 'SP', NOW())`,
      [clienteId, CLIENT_RAZAO, CLIENT_FANTASIA, CLIENT_EMAIL]
    );
    console.log(`Cliente CRIADO: ${CLIENT_FANTASIA} (${clienteId})`);
  }

  // 2. Check/create auth user
  const { rows: authUsers } = await pgClient.query(
    `SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1`,
    [CLIENT_EMAIL]
  );

  let authUserId: string;
  if (authUsers.length > 0) {
    authUserId = authUsers[0].id;
    console.log(`Auth user JA EXISTE: ${authUsers[0].email} (${authUserId})`);
  } else {
    authUserId = randomUUID();
    await pgClient.query(
      `INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
        confirmation_token, is_super_admin, phone_confirmed_at, is_sso_user, deleted_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', $2,
        crypt($3, gen_salt('bf', 10)), NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"name":"Cliente Teste","papel":"cliente"}',
        'authenticated', 'authenticated', NOW(), NOW(),
        '', false, NOW(), false, NULL)`,
      [authUserId, CLIENT_EMAIL, CLIENT_PASSWORD]
    );
    console.log(`Auth user CRIADO: ${CLIENT_EMAIL} (${authUserId})`);

    await pgClient.query(
      `INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'email', $4, NOW(), NOW(), NOW())`,
      [authUserId, authUserId, JSON.stringify({ sub: authUserId, email: CLIENT_EMAIL }), CLIENT_EMAIL]
    );
    console.log(`Identidade email vinculada.`);
  }

  // 3. Create usuarios_cliente link
  const { rows: vinculosExist } = await pgClient.query(
    `SELECT id FROM usuarios_cliente WHERE auth_user_id = $1 LIMIT 1`,
    [authUserId]
  );

  if (vinculosExist.length > 0) {
    console.log(`Vinculo usuarios_cliente JA EXISTE: ${vinculosExist[0].id}`);
  } else {
    await pgClient.query(
      `INSERT INTO usuarios_cliente (auth_user_id, cliente_id, ativo) VALUES ($1, $2, true)`,
      [authUserId, clienteId]
    );
    console.log(`Vinculo usuarios_cliente CRIADO`);
  }

  // 4. Create tenant_usuarios link
  const TENANT_ID = "00000000-0000-0000-0000-000000000001";
  const { rows: tenantExist } = await pgClient.query(
    `SELECT id FROM tenant_usuarios WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
    [authUserId, TENANT_ID]
  );

  if (tenantExist.length > 0) {
    console.log(`Vinculo tenant_usuarios JA EXISTE: ${tenantExist[0].id}`);
    await pgClient.query(`UPDATE tenant_usuarios SET papel = 'cliente', status = 'ativo' WHERE id = $1`,
      [tenantExist[0].id]
    );
    console.log(`  -> papel atualizado para 'cliente'`);
  } else {
    await pgClient.query(
      `INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status) VALUES ($1, $2, 'cliente', 'ativo')`,
      [TENANT_ID, authUserId]
    );
    console.log(`Vinculo tenant_usuarios CRIADO: papel=cliente`);
  }

  // 5. Create test data
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: existingOs } = await supabase
    .from("ordens_servico")
    .select("id")
    .eq("cliente_id", clienteId)
    .limit(1);

  if (existingOs && existingOs.length > 0) {
    console.log(`OS para cliente ${CLIENT_FANTASIA} JA EXISTEM`);
  } else {
    const statuses = ["em_andamento", "concluida", "em_andamento", "agendada", "concluida"];
    const destinos = ["Sao Paulo, SP", "Rio de Janeiro, RJ", "Belo Horizonte, MG", "Curitiba, PR", "Porto Alegre, RS"];
    const origens = ["Guarulhos, SP", "Campinas, SP", "Sao Paulo, SP", "Sao Paulo, SP", "Sao Paulo, SP"];

    for (let i = 0; i < 5; i++) {
      const osId = randomUUID();
      const dataServico = new Date();
      dataServico.setDate(dataServico.getDate() - i * 3);

      await supabase.from("ordens_servico").insert({
        id: osId,
        numero: `OS-TESTE-${1000 + i}`,
        cliente_id: clienteId,
        cliente: clienteId,
        status: statuses[i],
        origem: origens[i],
        destino: destinos[i],
        data_servico: dataServico.toISOString(),
        created_at: dataServico.toISOString(),
        valor_cliente: 1500 + i * 300,
        peso: 500 + i * 100,
        volumes: 10 + i * 5,
        carga_descricao: `Carga teste ${i + 1}`,
        placa_alocada: `ABC${1000 + i}`,
        veiculo: `Truck ${2020 + i}`,
        tipo_veiculo: "truck",
      });
    }
    console.log(`5 OS criadas para cliente ${CLIENT_FANTASIA}`);

    // Create financeiro_receber
    for (let i = 0; i < 3; i++) {
      const vencimento = new Date();
      vencimento.setDate(vencimento.getDate() + 15 + i * 30);
      const statusFin = i === 0 ? "pago" : i === 1 ? "a_vencer" : "vencido";

      await supabase.from("financeiro_receber").insert({
        cliente_id: clienteId,
        os_id: randomUUID(),
        fatura: `FAT-TESTE-${2000 + i}`,
        descricao: `Frete OS-TESTE-${1000 + i}`,
        valor: 1500 + i * 300,
        data_vencimento: vencimento.toISOString().split("T")[0],
        status: statusFin,
        created_at: new Date().toISOString(),
      });
    }
    console.log(`3 financeiro_receber criados`);
  }

  await pgClient.end();

  console.log("\n========================================");
  console.log("SEED CONCLUIDO COM SUCESSO!");
  console.log("========================================");
  console.log(`\nUsuario cliente:`);
  console.log(`  Email: ${CLIENT_EMAIL}`);
  console.log(`  Senha: ${CLIENT_PASSWORD}`);
  console.log(`  Cliente: ${CLIENT_FANTASIA} (${clienteId})`);
  console.log(`  Auth ID: ${authUserId}\n`);
}

main().catch(err => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
