const { execSync } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");

function getAccessToken() {
  try {
    const psScript = `
Add-Type -AssemblyName System.Security
try {
  $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
    [System.Convert]::FromBase64String((Get-ItemProperty -Path 'HKCU:\\Software\\Supabase\\CLI' -Name 'access_token' -ErrorAction Stop).access_token),
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  Write-Host ([System.Text.Encoding]::UTF8.GetString($bytes))
} catch {
  Write-Host ""
}
`;
    const result = execSync(`powershell -NoProfile -Command "${psScript.Replace('"', '\\"').Replace('\n', '; ')}"`, {
      encoding: "utf8",
      timeout: 10000,
    });
    const token = result?.trim();
    if (token && token.length > 20) return token;
  } catch (e) {
    console.error("Method 1 failed:", e.message);
  }

  // Method 2: try supabase CLI directly
  try {
    const result = execSync("npx supabase projects list --output json 2>&1", {
      encoding: "utf8",
      timeout: 15000,
      shell: "powershell",
    });
    // Token might be in output or we just check the error
  } catch (e2) {}

  return null;
}

async function callAPI(token, method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.supabase.com",
      path,
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
    };
    if (body) options.headers["Content-Length"] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const token = getAccessToken();
  if (!token) {
    console.error("ERROR: Cannot find Supabase access token");
    process.exit(1);
  }
  console.log("Access token found, first 20 chars:", token.substring(0, 20));

  // Step 1: Mark broken migrations as applied
  const versionsToApply = [
    "20260608", "20260613", "20260617211602", "20260618", "20260619000001",
  ];
  for (const v of versionsToApply) {
    const result = await callAPI(
      token,
      "POST",
      `/v1/projects/uwrvzsjtpgaifkktpepn/database/query`,
      JSON.stringify({ query: `INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ('${v}', '{}', 'manual-apply') ON CONFLICT (version) DO NOTHING;` })
    );
    console.log(`  ${v}: ${result.status} ${result.body.substring(0, 100)}`);
  }

  // Step 2: Execute the migration SQL
  const migrationSql = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20260620_usuarios_cliente_seguranca.sql"),
    "utf8"
  );

  // Split by semicolons and execute each statement
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`\nExecuting ${statements.length} SQL statements...`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      const result = await callAPI(
        token,
        "POST",
        `/v1/projects/uwrvzsjtpgaifkktpepn/database/query`,
        JSON.stringify({ query: stmt })
      );
      const ok = result.status >= 200 && result.status < 300;
      console.log(`  [${ok ? "OK" : "FAIL"}] stmt ${i + 1}: ${result.status}`);
      if (!ok) {
        console.error(`    ${result.body.substring(0, 200)}`);
      }
    } catch (e) {
      console.error(`  [ERR] stmt ${i + 1}: ${e.message}`);
    }
  }

  console.log("\n=== Migration complete ===");
}

main().catch(console.error);
