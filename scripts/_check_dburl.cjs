const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.log("DATABASE_URL: AUSENTE no .env");
  process.exit(1);
}
const url = m[1].trim();
// mascarar senha
const masked = url.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
console.log("DATABASE_URL: presente ->", masked);
