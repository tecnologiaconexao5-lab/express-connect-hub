import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CLIENT_EMAIL = "cliente.teste@conexaoexpress.com.br";
const CLIENT_PASSWORD = "Teste@2026";

async function main() {
  console.log("=== FIX CLIENT USER ===\n");

  // Step 1: Delete old user and recreate via signUp
  const pgClient = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  // Check current state
  const { rows: existing } = await pgClient.query(
    `SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1`,
    [CLIENT_EMAIL]
  );

  if (existing.length > 0) {
    console.log(`Auth user exists: ${existing[0].id}`);

    // Try to fix by updating the identity
    const userId = existing[0].id;
    await pgClient.query(
      `UPDATE auth.identities SET provider_id = $1,
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
    console.log("Identity updated with UUID provider_id");

    // Update user metadata to match the pattern
    await pgClient.query(
      `UPDATE auth.users SET
        raw_app_meta_data = '{"provider":"email","providers":["email"]}',
        raw_user_meta_data = '{"name":"Cliente Teste","papel":"cliente"}',
        email_confirmed_at = NOW(),
        confirmed_at = NOW(),
        confirmation_sent_at = NOW(),
        updated_at = NOW(),
        is_super_admin = false
       WHERE id = $1`,
      [userId]
    );
    console.log("User metadata updated");
  } else {
    console.log("User does NOT exist in auth.users.");
  }

  await pgClient.end();

  // Step 2: Test login
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
    console.log(`LOGIN FAILED: ${error.message}`);
    console.log(`Status: ${error.status}`);
    console.log(`Code: ${(error as any).code}`);

    // If still fails, delete and recreate via signUp
    if (error.message.includes("Database error") || error.message.includes("schema")) {
      console.log("\n=== Recreating user via signUp ===");

      const pgClient2 = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      await pgClient2.connect();

      // Delete old user
      await pgClient2.query(
        `DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = $1)`,
        [CLIENT_EMAIL]
      );
      await pgClient2.query(
        `DELETE FROM auth.users WHERE email = $1`,
        [CLIENT_EMAIL]
      );
      console.log("Old user deleted.");
      await pgClient2.end();

      // Create via signUp
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: CLIENT_EMAIL,
        password: CLIENT_PASSWORD,
        options: {
          data: { name: "Cliente Teste", papel: "cliente" },
        },
      });

      if (signUpErr) {
        console.log(`signUp failed: ${signUpErr.message}`);
        return;
      }

      console.log(`signUp OK: ${signUpData.user?.id}`);

      // Wait briefly
      await new Promise(r => setTimeout(r, 2000));

      // Confirm via PG
      const pgClient3 = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      await pgClient3.connect();

      if (signUpData.user?.id) {
        await pgClient3.query(
          `UPDATE auth.users SET
            email_confirmed_at = NOW(),
            confirmed_at = NOW(),
            confirmation_sent_at = NOW(),
            updated_at = NOW()
           WHERE id = $1`,
          [signUpData.user.id]
        );

        // Fix identity too
        await pgClient3.query(
          `UPDATE auth.identities SET provider_id = $1,
            identity_data = $2
           WHERE user_id = $3 AND provider = 'email'`,
          [
            signUpData.user.id,
            JSON.stringify({
              sub: signUpData.user.id,
              email: CLIENT_EMAIL,
              email_verified: false,
              phone_verified: false,
            }),
            signUpData.user.id,
          ]
        );
        console.log("User confirmed and identity fixed.");
      }

      await pgClient3.end();

      // Test again
      await new Promise(r => setTimeout(r, 2000));
      const { data: login2, error: err2 } = await supabase.auth.signInWithPassword({
        email: CLIENT_EMAIL,
        password: CLIENT_PASSWORD,
      });

      if (err2) {
        console.log(`LOGIN STILL FAILS: ${err2.message}`);
      } else {
        console.log(`LOGIN OK! User: ${login2.user?.email}`);
      }
    }
  } else {
    console.log(`LOGIN OK! User: ${data.user?.email}`);
    console.log(`Session: ${data.session?.access_token?.substring(0, 30)}...`);
  }

  // Final verification
  console.log("\n=== Final check ===");
  const pgClient4 = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient4.connect();

  const { rows: finalUsers } = await pgClient4.query(
    `SELECT id, email, email_confirmed_at, raw_user_meta_data,
            raw_app_meta_data
     FROM auth.users WHERE email = $1 LIMIT 1`,
    [CLIENT_EMAIL]
  );

  if (finalUsers.length > 0) {
    console.log(`User: ${finalUsers[0].email}`);
    console.log(`ID: ${finalUsers[0].id}`);
    console.log(`Confirmed: ${finalUsers[0].email_confirmed_at}`);
    console.log(`Meta: ${JSON.stringify(finalUsers[0].raw_user_meta_data)}`);
    console.log(`App Meta: ${JSON.stringify(finalUsers[0].raw_app_meta_data)}`);

    const { rows: idents } = await pgClient4.query(
      `SELECT provider, provider_id, identity_data FROM auth.identities WHERE user_id = $1`,
      [finalUsers[0].id]
    );
    console.log(`Identities: ${idents.length}`);
    idents.forEach((r: any) => {
      console.log(`  ${r.provider}: provider_id=${r.provider_id}`);
      console.log(`  data=${JSON.stringify(r.identity_data)}`);
    });
  }

  await pgClient4.end();
}

main().catch(e => console.error("FATAL:", e));
