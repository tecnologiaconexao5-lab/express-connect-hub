/* Diagnóstico read-only: GET mTLS direto ao DANFSe oficial (ADN) medindo tempo e HTTP status.
   Uso: node scripts\_diag_adn_mtls.cjs [--homolog|--producao] [--sem-proxy]
   Não altera nada. Apenas lê certificados_fiscais e faz GET na URL do ADN. */
const fs = require("fs");
const path = require("path");
const https = require("https");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  /* dotenv opcional */
}
const { Client } = require("pg");

const args = process.argv.slice(2);
const ambiente = args.includes("--producao") ? "producao" : "homologacao";
const usarProxy = !args.includes("--sem-proxy");

const BASE =
  ambiente === "producao"
    ? process.env.NFSE_ADN_URL_PRODUCAO || process.env.NFSE_ADN_URL || "https://adn.nfse.gov.br"
    : process.env.NFSE_ADN_URL_HOMOLOGACAO || process.env.NFSE_ADN_URL || "https://adn.producaorestrita.nfse.gov.br";

const CHAVE_NFSE2 = "35503082231227975000180000000000000226110834762132";

function sanitize(s, n = 400) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);
}

async function main() {
  const url = `${BASE.replace(/\/$/, "")}/danfse/${CHAVE_NFSE2}`;
  console.log(`ambiente=${ambiente}`);
  console.log(`url=${url}`);
  console.log(`proxy_env=${process.env.NFSE_SEFIN_PROXY_URL || "(vazio)"} (usarProxy=${usarProxy})`);

  const poolConfig = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
  const client = new Client(poolConfig);
  await client.connect();
  try {
    const r = await client.query(
      `SELECT id, tipo, cnpj, emitente_nome,
              length(coalesce(cert_pem,'')) AS cert_len,
              length(coalesce(chave_pem,'')) AS chave_len
         FROM public.certificados_fiscais
        ORDER BY created_at DESC
        LIMIT 5`
    );
    console.log(`certificados_fiscais: ${r.rowCount} linha(s)`);
    for (const row of r.rows) {
      console.log(
        `  id=${row.id} tipo=${row.tipo} cnpj=${row.cnpj} nome=${row.emitente_nome} cert_len=${row.cert_len} chave_len=${row.chave_len}`
      );
    }

    const certRow = r.rows.find((x) => x.cert_len > 0 && x.chave_len > 0);
    if (!certRow) {
      console.log("SEM_CERTIFICADO: nenhum certificado_fiscais com cert_pem+chave_pem");
      return;
    }
    const full = await client.query(
      `SELECT cert_pem, chave_pem FROM public.certificados_fiscais WHERE id = $1`,
      [certRow.id]
    );
    const cert = full.rows[0].cert_pem;
    const key = full.rows[0].chave_pem;
    console.log(`usando cert id=${certRow.id} cert_len=${cert.length} key_len=${key.length}`);

    const proxyUrl = usarProxy ? process.env.NFSE_SEFIN_PROXY_URL || "" : "";
    if (proxyUrl) {
      await testarViaProxy(proxyUrl, url, cert, key);
    } else {
      await testarDireto(url, cert, key);
    }
  } finally {
    await client.end();
  }
}

function testarDireto(url, cert, key) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const req = https.request(
      url,
      {
        method: "GET",
        cert,
        key,
        headers: { Accept: "application/pdf", "User-Agent": "ConexaoExpress-NFSe/1.0" },
        timeout: 30000,
      },
      (res) => {
        const chunks = [];
        let len = 0;
        res.on("data", (c) => {
          len += c.length;
          if (len <= 2 * 1024 * 1024) chunks.push(c);
        });
        res.on("end", () => {
          const dt = Date.now() - t0;
          const buf = Buffer.concat(chunks);
          const head = buf.slice(0, 16).toString("latin1");
          const isPdf = head.startsWith("%PDF");
          console.log(`DIRETO status=${res.statusCode} elapsed_ms=${dt} bytes=${buf.length} content-type=${sanitize(res.headers["content-type"], 80)} magic=${sanitize(head, 16)} is_pdf=${isPdf}`);
          if (!isPdf && buf.length) console.log(`DIRETO body_head=${sanitize(buf.slice(0, 300).toString("utf8"), 300)}`);
          resolve();
        });
      }
    );
    req.on("timeout", () => {
      console.log(`DIRETO TIMEOUT apos ${Date.now() - t0}ms`);
      req.destroy(new Error("timeout"));
    });
    req.on("error", (e) => {
      console.log(`DIRETO ERRO elapsed_ms=${Date.now() - t0} err=${sanitize(e.message, 300)} code=${e.code || ""}`);
      resolve();
    });
    req.end();
  });
}

async function testarViaProxy(proxyUrl, url, cert, key) {
  const t0 = Date.now();
  try {
    const token = process.env.NFSE_SEFIN_PROXY_TOKEN || "";
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-internal-token"] = token;
    const resp = await fetch(proxyUrl.replace(/\/$/, "") + "/nfse-sefin-proxy", {
      method: "POST",
      headers,
      body: JSON.stringify({ url, method: "GET", headers: { Accept: "application/pdf" }, cert, key }),
      signal: AbortSignal.timeout(35000),
    });
    const dt = Date.now() - t0;
    const text = await resp.text();
    console.log(`PROXY http_status=${resp.status} elapsed_ms=${dt} body_len=${text.length}`);
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* body não-JSON */
    }
    if (parsed && typeof parsed.status === "number") {
      const b64 = parsed.body || "";
      const buf = b64 ? Buffer.from(b64, "base64") : Buffer.alloc(0);
      const head = buf.slice(0, 16).toString("latin1");
      console.log(`PROXY adn_status=${parsed.status} bytes=${buf.length} magic=${sanitize(head, 16)} is_pdf=${head.startsWith("%PDF")}`);
      if (!head.startsWith("%PDF") && buf.length) console.log(`PROXY body_head=${sanitize(buf.slice(0, 300).toString("utf8"), 300)}`);
    } else {
      console.log(`PROXY body=${sanitize(text, 500)}`);
    }
  } catch (e) {
    console.log(`PROXY ERRO elapsed_ms=${Date.now() - t0} err=${sanitize(e.message, 400)}`);
  }
}

main().catch((e) => {
  console.error("FALHA_GERAL", sanitize(e && e.stack ? e.stack : e, 800));
  process.exitCode = 1;
});
