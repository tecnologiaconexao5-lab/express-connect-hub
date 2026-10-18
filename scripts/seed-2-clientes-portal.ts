import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomUUID } from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const CLIENTES = [
  {
    email: "cliente.teste@conexaoexpress.com.br",
    password: "Teste@2026",
    razao: "Empresa Teste Ltda",
    fantasia: "Empresa Teste",
    cnpj: "00.000.000/0001-00",
  },
  {
    email: "cliente2.teste@conexaoexpress.com.br",
    password: "Teste2@2026",
    razao: "Empresa Teste 2 Ltda",
    fantasia: "Empresa Teste 2",
    cnpj: "11.111.111/0001-11",
  },
];

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

async function criarCliente(pgClient: pg.Client, cfg: typeof CLIENTES[number]) {
  console.log(`\n=== Cliente: ${cfg.fantasia} (${cfg.email}) ===`);

  // 1. Cliente em "clientes"
  const { rows: exist } = await pgClient.query(
    `SELECT id, nome_fantasia FROM clientes WHERE email = $1 LIMIT 1`,
    [cfg.email]
  );

  let clienteId: string;
  if (exist.length > 0) {
    clienteId = exist[0].id;
    console.log(`  [clientes] ✅ JA EXISTE: ${exist[0].nome_fantasia} (${clienteId})`);
  } else {
    clienteId = randomUUID();
    await pgClient.query(
      `INSERT INTO clientes (id, razao_social, nome_fantasia, cnpj, email, status, cidade, uf, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, 'ativo', 'Sao Paulo', 'SP', $6, NOW())`,
      [clienteId, cfg.razao, cfg.fantasia, cfg.cnpj, cfg.email, TENANT_ID]
    );
    console.log(`  [clientes] ✅ CRIADO: ${cfg.fantasia} (${clienteId})`);
  }

  // 2. Auth user
  const { rows: authUsers } = await pgClient.query(
    `SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1`,
    [cfg.email]
  );

  let authUserId: string;
  if (authUsers.length > 0) {
    authUserId = authUsers[0].id;
    console.log(`  [auth.users] ✅ JA EXISTE: ${authUsers[0].email} (${authUserId})`);
  } else {
    authUserId = randomUUID();
    await pgClient.query(
      `INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
        confirmation_token, is_super_admin, phone_confirmed_at, is_sso_user, deleted_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', $2,
         crypt($3, gen_salt('bf', 10)), NOW(),
         '{"provider":"email","providers":["email"]}',
         '{"name":"Cliente Teste 2","papel":"cliente"}',
         'authenticated', 'authenticated', NOW(), NOW(),
         '', false, NOW(), false, NULL)`,
      [authUserId, cfg.email, cfg.password]
    );
    console.log(`  [auth.users] ✅ CRIADO: ${cfg.email}`);

    await pgClient.query(
      `INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'email', $4, NOW(), NOW(), NOW())`,
      [authUserId, authUserId, JSON.stringify({ sub: authUserId, email: cfg.email }), cfg.email]
    );
    console.log(`  [auth.identities] ✅ Vinculada`);
  }

  // 3. usuarios_cliente
  const { rows: vinculo } = await pgClient.query(
    `SELECT id FROM usuarios_cliente WHERE auth_user_id = $1 AND cliente_id = $2 LIMIT 1`,
    [authUserId, clienteId]
  );

  if (vinculo.length > 0) {
    console.log(`  [usuarios_cliente] ✅ JA EXISTE`);
  } else {
    await pgClient.query(
      `INSERT INTO usuarios_cliente (auth_user_id, cliente_id, ativo) VALUES ($1, $2, true)`,
      [authUserId, clienteId]
    );
    console.log(`  [usuarios_cliente] ✅ CRIADO`);
  }

  // 4. tenant_usuarios
  const { rows: tenant } = await pgClient.query(
    `SELECT id FROM tenant_usuarios WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
    [authUserId, TENANT_ID]
  );

  if (tenant.length > 0) {
    await pgClient.query(
      `UPDATE tenant_usuarios SET papel = 'cliente', status = 'ativo' WHERE id = $1`,
      [tenant[0].id]
    );
    console.log(`  [tenant_usuarios] ✅ Atualizado papel=cliente`);
  } else {
    await pgClient.query(
      `INSERT INTO tenant_usuarios (tenant_id, user_id, papel, status) VALUES ($1, $2, 'cliente', 'ativo')`,
      [TENANT_ID, authUserId]
    );
    console.log(`  [tenant_usuarios] ✅ CRIADO papel=cliente`);
  }

  return { clienteId, authUserId };
}

async function criarDadosPortal(sb: ReturnType<typeof createClient>, clienteId: string, fantasia: string, idx: number) {
  const prefix = idx === 0 ? "C1" : "C2";
  console.log(`\n  Criando dados portal para ${fantasia} (prefix ${prefix})...`);

  // portal_pedidos
  const { data: pedidosExist } = await sb
    .from("portal_pedidos")
    .select("id")
    .eq("cliente_id", clienteId)
    .limit(1);

  if (pedidosExist && pedidosExist.length > 0) {
    console.log(`  [portal_pedidos] ✅ Ja existem`);
  } else {
    const statuses = ["enviado", "em_analise", "programado"];
    const cidades = ["Sao Paulo, SP", "Rio de Janeiro, RJ", "Belo Horizonte, MG"];

    for (let i = 0; i < 3; i++) {
      await sb.from("portal_pedidos").insert({
        cliente_id: clienteId,
        numero_pedido: `PED-${prefix}-${2026}${String(i + 1).padStart(6, "0")}`,
        status: statuses[i],
        prioridade: i === 0 ? "alta" : "normal",
        solicitante_nome: `${fantasia} Solicitante`,
        solicitante_email: `solicitante${idx + 1}@teste.com`,
        coleta_cidade: "Sao Paulo",
        coleta_uf: "SP",
        entrega_destinatario: `Destinatario ${prefix}`,
        entrega_cidade: cidades[i],
        entrega_uf: cidades[i].split(", ")[1] || "SP",
        descricao: `Carga ${prefix} tipo ${i + 1}`,
        volumes: 5 + i,
        peso: 100 + i * 50,
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }
    console.log(`  [portal_pedidos] ✅ 3 pedidos criados`);
  }

  // portal_faturas
  const { data: faturasExist } = await sb
    .from("portal_faturas")
    .select("id")
    .eq("cliente_id", clienteId)
    .limit(1);

  if (faturasExist && faturasExist.length > 0) {
    console.log(`  [portal_faturas] ✅ Ja existem`);
  } else {
    for (let i = 0; i < 3; i++) {
      const vencimento = new Date();
      vencimento.setDate(vencimento.getDate() + 15 + i * 30);
      await sb.from("portal_faturas").insert({
        cliente_id: clienteId,
        numero: `FAT-${prefix}-${2000 + i}`,
        competencia: `${String(4 + i).padStart(2, "0")}/2026`,
        valor: 1500 + i * 300,
        vencimento: vencimento.toISOString().split("T")[0],
        status: i === 0 ? "paga" : i === 1 ? "a_vencer" : "aberta",
        url_boleto: `https://boleto.teste.com/${prefix}-${i}`,
        created_at: new Date().toISOString(),
      });
    }
    console.log(`  [portal_faturas] ✅ 3 faturas criadas`);
  }

  // portal_comprovantes
  const { data: compExist } = await sb
    .from("portal_comprovantes")
    .select("id")
    .eq("cliente_id", clienteId)
    .limit(1);

  if (compExist && compExist.length > 0) {
    console.log(`  [portal_comprovantes] ✅ Ja existem`);
  } else {
    for (let i = 0; i < 2; i++) {
      await sb.from("portal_comprovantes").insert({
        cliente_id: clienteId,
        tipo: "entrega",
        titulo: `${prefix} - Comprovante ${i + 1}`,
        nome_recebedor: `Recebedor ${prefix} ${i + 1}`,
        documento_recebedor: `${prefix}-DOC-${i}`,
        data_entrega: new Date(Date.now() - i * 86400000 * 2).toISOString(),
        fotos: [`https://foto.teste.com/${prefix}-${i + 1}.jpg`],
        assinatura_url: `https://assinatura.teste.com/${prefix}-${i + 1}.png`,
        created_at: new Date().toISOString(),
      });
    }
    console.log(`  [portal_comprovantes] ✅ 2 comprovantes criados`);
  }

  // portal_ocorrencias
  const { data: ocorrExist } = await sb
    .from("portal_ocorrencias")
    .select("id")
    .eq("cliente_id", clienteId)
    .limit(1);

  if (ocorrExist && ocorrExist.length > 0) {
    console.log(`  [portal_ocorrencias] ✅ Ja existem`);
  } else {
    const tipos = ["atraso", "avariado"];
    for (let i = 0; i < 2; i++) {
      await sb.from("portal_ocorrencias").insert({
        cliente_id: clienteId,
        tipo: tipos[i],
        descricao: `${prefix} - ${tipos[i]} ocorrencia ${i + 1}`,
        prioridade: i === 0 ? "alta" : "media",
        status: i === 0 ? "aberta" : "resolvida",
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }
    console.log(`  [portal_ocorrencias] ✅ 2 ocorrencias criadas`);
  }

  // portal_tracking_realtime
  const { data: trackExist } = await sb
    .from("portal_tracking_realtime")
    .select("id")
    .eq("cliente_id", clienteId)
    .limit(1);

  if (trackExist && trackExist.length > 0) {
    console.log(`  [portal_tracking_realtime] ✅ Ja existem`);
  } else {
    await sb.from("portal_tracking_realtime").insert({
      cliente_id: clienteId,
      status: "online",
      latitude: -23.55 + idx * 0.1,
      longitude: -46.63 + idx * 0.1,
      eta_min: 30,
      velocidade: 60,
      updated_at: new Date().toISOString(),
    });
    console.log(`  [portal_tracking_realtime] ✅ 1 tracking criado`);
  }
}

async function main() {
  console.log("=== SEED 2 CLIENTES TESTE + DADOS PORTAL ===\n");

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  for (let i = 0; i < CLIENTES.length; i++) {
    const cfg = CLIENTES[i];
    const { clienteId, authUserId } = await criarCliente(pgClient, cfg);
    await criarDadosPortal(supabase, clienteId, cfg.fantasia, i);
    
    console.log(`\n  📋 Dados do cliente ${i + 1}:`);
    console.log(`     Email login: ${cfg.email}`);
    console.log(`     Senha: ${cfg.password}`);
    console.log(`     Cliente ID: ${clienteId}`);
    console.log(`     Auth User ID: ${authUserId}`);
  }

  await pgClient.end();

  console.log("\n========================================");
  console.log("SEED 2 CLIENTES CONCLUIDO COM SUCESSO!");
  console.log("========================================");
  console.log("\nClientes criados:");
  for (const c of CLIENTES) {
    console.log(`  - ${c.email} / ${c.password} → ${c.fantasia}`);
  }
  console.log("\nPara testar RLS: login como cada cliente e verificar se dados do outro cliente não aparecem.");
}

main().catch(err => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});