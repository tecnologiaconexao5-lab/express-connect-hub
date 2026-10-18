import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CLIENT_EMAIL = "cliente.teste@conexaoexpress.com.br";
const CLIENT_PASSWORD = "Teste@2026";

async function main() {
  console.log("=== FIX CLIENT USER - V2 ===\n");

  const pgClient = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const { rows: users } = await pgClient.query(
    `SELECT id, raw_app_meta_data, raw_user_meta_data, email_confirmed_at
     FROM auth.users WHERE email = $1 LIMIT 1`,
    [CLIENT_EMAIL]
  );

  if (users.length === 0) {
    console.log("User not found!");
    return;
  }

  const userId = users[0].id;
  console.log(`User ID: ${userId}`);
  console.log(`App meta before: ${JSON.stringify(users[0].raw_app_meta_data)}`);

  // Update a few non-problematic columns - DON'T touch confirmed_at, is_super_admin
  await pgClient.query(
    `UPDATE auth.users SET
      raw_app_meta_data = '{"provider":"email","providers":["email"]}',
      raw_user_meta_data = '{"name":"Cliente Teste","papel":"cliente"}',
      updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
  console.log("User metadata updated.");

  // Fix the identities
  const { rows: idents } = await pgClient.query(
    `SELECT id, provider_id, identity_data, provider
     FROM auth.identities WHERE user_id = $1`,
    [userId]
  );
  console.log(`Identities: ${idents.length}`);

  for (const ident of idents) {
    if (ident.provider === "email") {
      // Update provider_id to UUID
      await pgClient.query(
        `UPDATE auth.identities SET
          provider_id = $1,
          identity_data = $2
         WHERE id = $3`,
        [
          userId,
          JSON.stringify({
            sub: userId,
            email: CLIENT_EMAIL,
            email_verified: false,
            phone_verified: false,
          }),
          ident.id,
        ]
      );
      console.log(`Identity updated: ${ident.id}`);
    }
  }

  await pgClient.end();

  // Now test login
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || "",
    process.env.VITE_SUPABASE_ANON_KEY || ""
  );

  console.log("\n=== Testing login ===");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: CLIENT_EMAIL,
    password: CLIENT_PASSWORD,
  });

  if (error) {
    console.log(`FAILED: ${error.message} | code=${(error as any).code} | status=${error.status}`);

    // Let's try to signUp and see what error we get
    console.log("\n=== Attempting signUp ===");

    const pgClient2 = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient2.connect();

    // Delete old user completely
    await pgClient2.query(`DELETE FROM auth.identities WHERE user_id = $1`, [userId]);
    await pgClient2.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
        
    // Also clean up child references
    await pgClient2.query(`DELETE FROM tenant_usuarios WHERE auth_user_id = $1`, [userId]);
    await pgClient2.query(`DELETE FROM usuarios_cliente WHERE auth_user_id = $1`, [userId]);

    console.log("Old user and references deleted.");

    // Check if email_confirm setting is off
    // Try signUp
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: CLIENT_EMAIL,
      password: CLIENT_PASSWORD,
      options: {
        data: { name: "Cliente Teste", papel: "cliente" },
      },
    });

    if (signUpErr) {
      console.log(`signUp failed: ${signUpErr.message}`);
      if (signUpErr.message.includes("already exists")) {
        console.log("Rate limited - need to wait");
      }
    } else if (signUpData.user) {
      const newId = signUpData.user.id;
      console.log(`signUp OK! New user: ${newId}`);

      // Confirm without touching generated columns
      await pgClient2.query(
        `UPDATE auth.users SET
          email_confirmed_at = NOW(),
          confirmation_sent_at = NOW(),
          updated_at = NOW()
         WHERE id = $1`,
        [newId]
      );
      console.log("User confirmed (1/3).");

      // Fix identity
      const { rows: newIdents } = await pgClient2.query(
        `SELECT id FROM auth.identities WHERE user_id = $1 AND provider = 'email'`,
        [newId]
      );

      if (newIdents.length > 0) {
        await pgClient2.query(
          `UPDATE auth.identities SET provider_id = $1 WHERE user_id = $2 AND provider = 'email'`,
          [newId, newId]
        );
        console.log("Identity updated.");
      }

      // Wait for triggers
      await new Promise(r => setTimeout(r, 3000));

      console.log("\n=== Testing login with new user ===");
      const { data: login2, error: err2 } = await supabase.auth.signInWithPassword({
        email: CLIENT_EMAIL,
        password: CLIENT_PASSWORD,
      });

      if (err2) {
        console.log(`FAILED: ${err2.message}`);
        console.log(`Full error: ${JSON.stringify(err2)}`);
      } else {
        console.log(`LOGIN OK! User: ${login2.user?.email}`);
        console.log(`Session: ${login2.session?.access_token?.substring(0, 30)}...`);

        // Now recreate the business records
        console.log("\n=== Recreating business records ===");
        const [{ data: existingClientes }] = await pgClient2.query(
          `SELECT * FROM usuarios_cliente WHERE auth_user_id = $1`,
          [newId]
        );
        
        if (!existingClientes) {
          console.log("Creating usuarios_cliente, tenant_usuarios...");
          await pgClient2.query(`
            INSERT INTO usuarios_cliente (id, auth_user_id, nome, email, telefone, cnpj, tipo, ativo, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, 'Cliente Teste', 'cliente.teste@conexaoexpress.com.br', '11999999999', '00.000.000/0001-91', 'premium', true, NOW(), NOW())
          `, [newId]);

          await pgClient2.query(`
            INSERT INTO tenant_usuarios (id, auth_user_id, tenant_id, papel, criado_em, atualizado_em)
            VALUES (gen_random_uuid(), $1, '00000000-0000-0000-0000-000000000001', 'cliente', NOW(), NOW())
          `, [newId]);

          await pgClient2.query(`
            INSERT INTO usuarios_cliente_tenant (id, auth_user_id, tenant_id, papel, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, '00000000-0000-0000-0000-000000000001', 'cliente', NOW(), NOW())
          `, [newId]);

          // Create 5 OS records
          for (let i = 0; i < 5; i++) {
            await pgClient2.query(`
              INSERT INTO alocacoes_escala (id, cliente_nome, cliente_documento, status, servico, origem, destino, created_at, updated_at)
              VALUES (gen_random_uuid(), 'Cliente Teste', '00.000.000/0001-91', 'Pendente', $1, 'São Paulo, SP', $2, NOW(), NOW())
            `, [`Serviço de Transporte ${i + 1}`, i % 2 === 0 ? 'Rio de Janeiro, RJ' : 'Belo Horizonte, MG']);
          }

          await pgClient2.query(`
            INSERT INTO financeiro_receber (id, cliente_nome, cliente_documento, valor, status, data_vencimento, created_at, updated_at)
            VALUES (gen_random_uuid(), 'Cliente Teste', '00.000.000/0001-91', 1500.00, 'Pendente', NOW() + INTERVAL '15 days', NOW(), NOW()),
                   (gen_random_uuid(), 'Cliente Teste', '00.000.000/0001-91', 3200.50, 'Recebido', NOW() - INTERVAL '5 days', NOW(), NOW()),
                   (gen_random_uuid(), 'Cliente Teste', '00.000.000/0001-91', 890.75, 'Atrasado', NOW() - INTERVAL '3 days', NOW(), NOW())
          `);

          console.log("Business records created!");
        }
      }
    }

    await pgClient2.end();
  } else {
    console.log(`LOGIN OK! User: ${data.user?.email}`);
    console.log(`Session: ${data.session?.access_token?.substring(0, 30)}...`);
  }
}

main().catch(e => console.error("FATAL:", e));
