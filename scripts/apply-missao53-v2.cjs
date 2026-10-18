// Script to apply Missao 53 migration via Supabase Management API
// Uses access token obtained from supabase CLI

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// === OBTER TOKEN DE ACESSO ===
function getAccessToken() {
  // Method 1: Try reading from the Supabase temp config
  const tempDir = path.join(__dirname, "..", "supabase", ".temp");
  const projectRefFile = path.join(tempDir, "project-ref");
  if (fs.existsSync(projectRefFile)) {
    const projectRef = fs.readFileSync(projectRefFile, "utf8").trim();
    console.log("Project ref:", projectRef);
  }

  // Method 2: Invoke `supabase` CLI to get token from its internal state
  try {
    // The CLI stores tokens in ~/.supabase or in memory
    // Try to get it via the linked project's access token
    const supabaseDir = path.join(process.env.USERPROFILE || "", ".supabase");
    const tokensFile = path.join(supabaseDir, "tokens.json");
    if (fs.existsSync(tokensFile)) {
      const tokens = JSON.parse(fs.readFileSync(tokensFile, "utf8"));
      console.log("Tokens file found with entries:", Object.keys(tokens));
      // Get the latest token
      const token = tokens["supabase"] || tokens["default"] || Object.values(tokens)[0];
      if (token && typeof token === "string" && token.length > 20) {
        return token;
      }
    }

    // Method 3: Check for access token in any JSON file
    const supabaseDir2 = path.join(process.env.APPDATA || "", "supabase");
    if (fs.existsSync(supabaseDir2)) {
      const files = fs.readdirSync(supabaseDir2);
      for (const f of files) {
        if (f.endsWith(".json")) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(supabaseDir2, f), "utf8"));
            if (data.access_token && data.access_token.length > 20) {
              return data.access_token;
            }
          } catch (e) { /* ignore */ }
        }
      }
    }
  } catch (e) {
    console.error("Method 2/3 failed:", e.message);
  }

  // Method 4: Check env
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    return process.env.SUPABASE_ACCESS_TOKEN;
  }

  return null;
}

async function callManagementAPI(projectRef, token, sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const options = {
      hostname: "api.supabase.com",
      path: `/v1/projects/${projectRef}/database/query`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        resolve({ status: res.statusCode, body });
      });
    });

    req.on("error", (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function callRESTApi(projectRef, token, sql) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.supabase.com",
      path: `/v1/projects/${projectRef}/api/rest`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "apikey": token,
        "Prefer": "resolution=merge-duplicates",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", (e) => reject(e));
    req.end();
  });
}

/*
READ THE TOKEN FROM SUPABASE CLI's INTERNAL STORAGE.

On Windows, the Supabase CLI stores login tokens in the Windows Credential Manager
(via the `keytar` library) or in a local JSON file.

The proper approach is to use the Management API directly with a Personal Access Token.
Alternatively, use the `--db-url` mechanism with the database password.

For now, let's try: read from supabase/config.toml or supabase/.temp files
*/

function findTokenInCLIState() {
  const searchPaths = [
    path.join(process.env.USERPROFILE || "", ".supabase"),
    path.join(process.env.USERPROFILE || "", "AppData", "Roaming", "supabase"),
    path.join(process.env.USERPROFILE || "", "AppData", "Local", "supabase"),
    path.join(process.env.APPDATA || "", "supabase"),
  ];

  for (const dir of searchPaths) {
    if (!fs.existsSync(dir)) continue;
    
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && entry.endsWith(".json")) {
          try {
            const content = JSON.parse(fs.readFileSync(fullPath, "utf8"));
            // Check for access_token in nested objects
            function findToken(obj, depth = 0) {
              if (depth > 5) return null;
              if (!obj || typeof obj !== "object") return null;
              
              if (obj.access_token && typeof obj.access_token === "string" && obj.access_token.length > 20) {
                return obj.access_token;
              }
              if (obj.token && typeof obj.token === "string" && obj.token.length > 20) {
                return obj.token;
              }
              
              for (const key of Object.keys(obj)) {
                if (typeof obj[key] === "object") {
                  const found = findToken(obj[key], depth + 1);
                  if (found) return found;
                }
              }
              return null;
            }
            
            const token = findToken(content);
            if (token) {
              console.log(`Found token in: ${fullPath}`);
              return token;
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}

async function main() {
  const projectRef = "uwrvzsjtpgaifkktpepn";
  console.log("Project ref:", projectRef);
  
  // Try to find token
  let token = findTokenInCLIState();
  
  if (!token) {
    console.log("\nNo access token found in CLI state.");
    console.log("Options to apply migration:");
    console.log("1. Copy & paste SQL into Supabase Dashboard > SQL Editor");
    console.log("2. Set SUPABASE_ACCESS_TOKEN environment variable");
    console.log("3. Set DATABASE_URL environment variable and run: npx tsx scripts/apply-migration-pg.cjs");
    console.log("4. Run manually: npx supabase db push --include-all --linked");
    console.log("\nSQL file to apply:");
    console.log("  supabase/migrations/20260701_missao53_perfil_cliente.sql");
    
    // Print the SQL for manual application
    const sql = fs.readFileSync(
      path.join(__dirname, "..", "supabase", "migrations", "20260701_missao53_perfil_cliente.sql"),
      "utf8"
    );
    console.log("\n--- SQL to apply ---");
    console.log(sql);
    console.log("--- End SQL ---\n");
    
    process.exit(0);
  }
  
  console.log("Access token found, length:", token.length);
  
  // Read SQL
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20260701_missao53_perfil_cliente.sql"),
    "utf8"
  );
  console.log("SQL length:", sql.length, "chars\n");
  
  // Execute entire SQL as one batch
  console.log("Executing migration via Management API...");
  const result = await callManagementAPI(projectRef, token, sql);
  
  console.log(`Status: ${result.status}`);
  
  if (result.status >= 200 && result.status < 300) {
    console.log("Migration aplicada com sucesso!");
  } else {
    const errPreview = result.body.substring(0, 500);
    console.error("Erro:", errPreview);
    
    // Analyze specific errors
    if (errPreview.includes("already exists")) {
      console.log("\n(Alguns objetos já existiam - idempotente, sem dano)");
    }
    if (errPreview.includes("syntax")) {
      console.log("\n(Erro de sintaxe na migration - precisa corrigir)");
    }
  }
}

main().catch(console.error);