import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const BASELINE_FILE = path.resolve("supabase/baseline/full_production_schema_20260920.sql");

if (!fs.existsSync(BASELINE_FILE)) {
  console.error("Baseline file not found:", BASELINE_FILE);
  process.exit(1);
}

const content = fs.readFileSync(BASELINE_FILE, "utf8");
const lines = content.split(/\r?\n/);

console.log("=== INSPEÇÃO AUTOMÁTICA DE INTEGRIDADE E ZERO DATA ===");
console.log("Arquivo:", BASELINE_FILE);
console.log("Linhas totais:", lines.length);
console.log("Tamanho (bytes):", fs.statSync(BASELINE_FILE).size);

// SHA-256 Hash
const hash = crypto.createHash("sha256").update(content).digest("hex");
console.log("SHA-256:", hash);

// Check 1: Standalone top-level DML INSERT statements (fora do corpo de funções plpgsql)
// Um INSERT de dados de negócio ocorre no topo do arquivo (coluna 0 ou sem estar dentro de BEGIN...END)
// Mais especificamente: verificamos se há algum bloco de INSERT de dados gerado por dump ou script de seed
let inFunctionBody = false;
const topLevelInserts: { line: number, text: string }[] = [];
const copyLines: { line: number, text: string }[] = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("CREATE OR REPLACE FUNCTION") || line.includes("CREATE FUNCTION") || line.includes("DO $$")) {
    inFunctionBody = true;
  }
  if (inFunctionBody && (line.trim().endsWith("$$;") || line.trim() === "$$;")) {
    inFunctionBody = false;
    continue;
  }
  if (!inFunctionBody) {
    if (/^\s*INSERT\s+INTO\s+/i.test(line)) {
      topLevelInserts.push({ line: i + 1, text: line });
    }
    if (/^\s*COPY\s+/i.test(line)) {
      copyLines.push({ line: i + 1, text: line });
    }
  }
}

console.log("\n--- VERIFICAÇÃO DE DADOS / DML ---");
console.log("TOP_LEVEL_INSERTS (Business Inserts):", topLevelInserts.length);
console.log("COPY_DATA_BLOCKS:", copyLines.length);
console.log("DATA_ROWS_EXPORTED =", topLevelInserts.length + copyLines.length);
console.log("BUSINESS_INSERTS =", topLevelInserts.length);

// Check 2: Sensitive secrets (senhas reais, connection strings, JWTs de autenticação, API keys privadas)
const secretPatterns = [
  { name: "JWT Token (ey...)", regex: /eyJhbGciOi[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/ },
  { name: "Production Password", regex: /ConexaoExpress_DB_2026/ },
  { name: "Supabase DB Password", regex: /h1kBd7axuIbVvSctwu8C3ftdNKXlehzl/ },
  { name: "PostgreSQL URI", regex: /postgresql:\/\/[^:]+:[^@]+@[^/]+\/\w+/ }
];

let secretsFound = 0;
for (const { name, regex } of secretPatterns) {
  const matches = lines.filter(l => regex.test(l));
  if (matches.length > 0) {
    console.warn(`WARNING: Secret pattern matched [${name}]:`, matches.length);
    secretsFound += matches.length;
  }
}
console.log("Secrets / Passwords / JWTs encontradas:", secretsFound);

// Check 3: Presença de objetos críticos
const hasFConfirmarFechamento = content.includes("f_confirmar_pagamento_fechamento");
const hasFConfirmarPrestador = content.includes("f_confirmar_pagamento_prestador");
const hasFRegistrarBaixa = content.includes("f_registrar_baixa_financeira");
const hasFAvancarEtapa = content.includes("f_avancar_etapa_app_motorista");
const has02M5FSignature = content.includes("p_valor_pago numeric DEFAULT NULL");
const hasM66Function = content.includes("f_trg_propagar_financeiro_alocacao");
const hasM80Function = content.includes("f_trg_propagar_financeiro_os");
const hasM66Trigger = content.includes("trg_propagar_financeiro_alocacao");
const hasM80Trigger = content.includes("trg_propagar_financeiro_os");

console.log("\n--- OBJETOS CRÍTICOS ---");
console.log("f_confirmar_pagamento_fechamento:", hasFConfirmarFechamento ? "PRESENTE" : "AUSENTE");
console.log("f_confirmar_pagamento_prestador:", hasFConfirmarPrestador ? "PRESENTE" : "AUSENTE");
console.log("f_registrar_baixa_financeira:", hasFRegistrarBaixa ? "PRESENTE" : "AUSENTE");
console.log("f_avancar_etapa_app_motorista:", hasFAvancarEtapa ? "PRESENTE" : "AUSENTE");
console.log("02M.5F RPC (p_valor_pago numeric DEFAULT NULL):", has02M5FSignature ? "PRESENTE" : "AUSENTE");
console.log("Trigger M66 (trg_propagar_financeiro_alocacao):", hasM66Trigger ? "PRESENTE" : "AUSENTE");
console.log("Trigger M80 (trg_propagar_financeiro_os):", hasM80Trigger ? "PRESENTE" : "AUSENTE");
console.log("Função M66 (f_trg_propagar_financeiro_alocacao):", hasM66Function ? "PRESENTE" : "AUSENTE");
console.log("Função M80 (f_trg_propagar_financeiro_os):", hasM80Function ? "PRESENTE" : "AUSENTE");

// Check 4: Contagem de DDL
const countCreateTables = (content.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
const countCreateViews = (content.match(/CREATE OR REPLACE VIEW/g) || []).length;
const countCreateFuncs = (content.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
const countCreateTriggers = (content.match(/CREATE TRIGGER/g) || []).length;
const countCreatePolicies = (content.match(/CREATE POLICY/g) || []).length;
const countCreateTypes = (content.match(/CREATE TYPE/g) || []).length;
const countCreateExtensions = (content.match(/CREATE EXTENSION IF NOT EXISTS/g) || []).length;
const countCreateSequences = (content.match(/CREATE SEQUENCE IF NOT EXISTS/g) || []).length;
const countAlterConstraints = (content.match(/ADD CONSTRAINT/g) || []).length;
const countIndexes = (content.match(/CREATE (UNIQUE )?INDEX IF NOT EXISTS/g) || []).length;

console.log("\n--- CONTAGEM DE OBJETOS DDL NO BASELINE ---");
console.log("CREATE TABLE:", countCreateTables);
console.log("CREATE VIEW:", countCreateViews);
console.log("CREATE FUNCTION / RPC:", countCreateFuncs);
console.log("CREATE TRIGGER:", countCreateTriggers);
console.log("CREATE POLICY:", countCreatePolicies);
console.log("CREATE TYPE (ENUM):", countCreateTypes);
console.log("CREATE EXTENSION:", countCreateExtensions);
console.log("CREATE SEQUENCE:", countCreateSequences);
console.log("ADD CONSTRAINT (PK/FK/UQ/CK):", countAlterConstraints);
console.log("INDEXES:", countIndexes);

const isPass = (
  topLevelInserts.length === 0 &&
  copyLines.length === 0 &&
  secretsFound === 0 &&
  has02M5FSignature &&
  hasM66Trigger &&
  hasM80Trigger &&
  countCreateTables === 237 &&
  countCreateViews === 24 &&
  countCreateFuncs === 135
);

if (isPass) {
  console.log("\n================================================================================");
  console.log("CRITÉRIO: ZERO DATA = PASS | ZERO SECRETS = PASS | DDL ÍNTEGRO = PASS");
  console.log("DATA_ROWS_EXPORTED = 0");
  console.log("BUSINESS_INSERTS = 0");
  console.log("COPY_DATA_BLOCKS = 0");
  console.log("================================================================================");
} else {
  console.error("\nCRITÉRIO: FALHA NA INSPEÇÃO");
  process.exit(1);
}
