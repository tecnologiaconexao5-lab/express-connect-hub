// APP-E2E-11C — GAP-POD-PRIVATE-URL: prova read-only (sem service key).
import fs from "node:fs";
const env = fs.readFileSync(".env", "utf8");
const m = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m);
const serviceKey = m ? m[1].trim() : "";
const url = env.match(/^VITE_SUPABASE_URL=(.+)$/m)[1].trim();

const objectPath = "a5e51631-5ed8-430d-9041-4b185c03d821/pod/18d50f0b-704f-4361-8626-ed43c8000601/2026/09/27/20e2a4c4-437c-4ca5-9c44-839aa4422a7b.jpg";
const publicUrl = `${url}/storage/v1/object/public/driver-evidence/${objectPath}`;
const out = { service_key_presente: serviceKey.length > 0 };

try {
  const r = await fetch(publicUrl);
  out.public_url_status = r.status;
  out.public_url_body = (await r.text()).slice(0, 200);
} catch (e) { out.public_url_status = "ERRO: " + e.message; }

if (serviceKey) {
  try {
    const r = await fetch(`${url}/storage/v1/object/sign/driver-evidence/${objectPath}`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 600 }),
    });
    out.sign_status = r.status;
    const j = await r.json();
    out.sign_ok = !!j.signedUrl;
  } catch (e) { out.sign_status = "ERRO: " + e.message; }
}
console.log(JSON.stringify(out, null, 2));
