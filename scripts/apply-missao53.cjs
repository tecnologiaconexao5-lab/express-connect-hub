// Script para aplicar migration Missao 53 via Supabase Management API
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

// Mapeia statements individuais (CREATE TABLE, ALTER TABLE, CREATE POLICY, etc.)
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inFunction = false;
  let inDoBlock = false;

  const lines = sql.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Detecta inicio de bloco $$ (function body, DO blocks)
    if (trimmed.includes("AS $$") || trimmed.includes("AS $BODY$") || trimmed.includes("DO $$")) {
      inFunction = true;
    }

    if (inFunction) {
      current += line + "\n";
      if (trimmed === "$$;" || trimmed === "$BODY$;" || trimmed === "END $$;") {
        inFunction = false;
        if (current.trim().length > 0) {
          statements.push(current.trim());
        }
        current = "";
      }
      continue;
    }

    current += line + "\n";

    // Statement termina com ; no final da linha
    if (trimmed.endsWith(";") && !inFunction) {
      const stmt = current.trim();
      if (stmt.length > 0 && stmt !== ";") {
        statements.push(stmt);
      }
      current = "";
    }
  }

  // Residuo
  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements;
}

async function main() {
  const token = getAccessToken();
  if (!token) {
    console.error("ERROR: Could not find Supabase access token.");
    console.error("Please run: npx supabase login");
    process.exit(1);
  }
  console.log("Access token found, length:", token.length);

  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260701_missao53_perfil_cliente.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  console.log("Migration file loaded:", migrationPath);
  console.log("SQL length:", sql.length, "chars\n");

  const statements = splitStatements(sql);
  console.log(`Total statements to execute: ${statements.length}\n`);

  let okCount = 0;
  let errCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    // Mostra preview curto
    const preview = stmt.substring(0, 120).replace(/\n/g, " ").trim();
    console.log(`\n[${i + 1}/${statements.length}] ${preview}...`);

    try {
      const result = await callManagementAPI(token, stmt);
      console.log(`  Status: ${result.status}`);

      if (result.status >= 200 && result.status < 300) {
        console.log("  OK");
        okCount++;
      } else {
        const errBody = result.body.substring(0, 400);
        console.error(`  ERROR: ${errBody}`);
        errCount++;

        // Erros toleraveis: coluna ja existe, policy ja existe
        if (errBody.includes("already exists") || errBody.includes("duplicate")) {
          console.log("  (tolerated — already exists)");
          okCount++;
          errCount--;
        }
      }
    } catch (err) {
      console.error(`  Network/Parsing error: ${err.message}`);
      errCount++;
    }

    // Pequena pausa entre statements para nao sobrecarregar API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n========================================`);
  console.log(`Migration aplicada.`);
  console.log(`  Statements executados: ${okCount} OK, ${errCount} erros`);
  console.log(`========================================`);
}

main().catch(console.error);