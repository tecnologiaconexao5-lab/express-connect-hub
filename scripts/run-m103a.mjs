import "dotenv/config";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("ERRO: DATABASE_URL não encontrada no .env");
  console.error("Verifique se o .env tem: DATABASE_URL=postgresql://...");
  process.exit(1);
}

console.log("DATABASE_URL encontrada.");
console.log("Aplicando migration M103A...");

try {
  const result = execSync(`node "${resolve(__dirname, "apply-m103a-migration.mjs")}"`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: "utf8",
    stdio: "inherit",
  });
} catch (err) {
  console.error("Falha ao aplicar migration:", err.message);
  process.exit(1);
}
