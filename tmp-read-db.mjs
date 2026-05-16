import fs from "fs";

const dbPath = process.env.TEMP + "\\n8n_database.sqlite";

try {
  const Database = require("better-sqlite3");
  const db = new Database(dbPath);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables:", tables.map(t => t.name));

  const users = db.prepare("SELECT id, email, firstName, lastName, role FROM user").all();
  console.log("Users:", JSON.stringify(users, null, 2));

  const workflows = db.prepare("SELECT id, name, active FROM workflow").all();
  console.log("Workflows:", JSON.stringify(workflows, null, 2));

  const webhooks = db.prepare("SELECT id, webhookPath, workflowId, method FROM webhook").all();
  console.log("Webhooks:", JSON.stringify(webhooks, null, 2));

  db.close();
} catch (e) {
  console.log("Error:", e.message);
  console.log("DB file size:", fs.statSync(dbPath).size, "bytes");
}
