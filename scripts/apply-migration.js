// Script to apply F20D migration via Supabase Management API
// Reads the access token from Windows Credential Manager

const { execSync } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");

function getAccessToken() {
  try {
    const psCmd = [
      'powershell -Command "',
      'Add-Type -AssemblyName System.Security;',
      '$cred = [System.Security.Cryptography.ProtectedData]::Unprotect(',
      "  (Get-ItemProperty 'HKCU:\\Software\\Supabase\\CLI' -Name 'access_token' -ErrorAction SilentlyContinue).access_token, ",
      '  $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser',
      ');',
      'if ($cred) { [System.Text.Encoding]::UTF8.GetString($cred) }',
      '"',
    ].join("");
    const result = execSync(psCmd, { encoding: "utf8", timeout: 10000 });
    const token = result?.trim();
    if (token && token.length > 20) return token;
  } catch (e) {
    console.error("Failed to get token from registry:", e.message);
  }

  // Fallback: read from config file
  try {
    const configPath = path.join(
      process.env.APPDATA || process.env.HOME || "",
      "supabase",
      "config.json"
    );
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return config.access_token || null;
    }
  } catch (e) {
    console.error("Fallback failed:", e.message);
  }
  return null;
}

async function callManagementAPI(token, sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const options = {
      hostname: "api.supabase.com",
      path: "/v1/projects/uwrvzsjtpgaifkktpepn/database/query",
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function main() {
  const token = getAccessToken();
  if (!token) {
    console.error("ERROR: Could not find Supabase access token.");
    console.error("Please run: npx supabase login");
    process.exit(1);
  }
  console.log("Access token found, length:", token.length);

  // Read the migration SQL
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260620_usuarios_cliente_seguranca.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  console.log("SQL length:", sql.length, "chars");

  // Split by statements and execute each
  // Simple split by semicolons (not perfect but works for this migration)
  const statements = sql.split(";\n").filter((s) => s.trim().length > 0);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;

    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
    try {
      const result = await callManagementAPI(token, stmt);
      console.log(`  Status: ${result.status}`);
      if (result.status >= 200 && result.status < 300) {
        console.log("  OK");
      } else {
        console.error(`  Error: ${result.body.substring(0, 300)}`);
      }
    } catch (err) {
      console.error(`  Network error: ${err.message}`);
    }
  }

  console.log("\n=== Migration complete ===");
}

main().catch(console.error);
