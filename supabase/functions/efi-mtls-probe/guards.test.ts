// EFI-INT-04A.2 — Testes estáticos/unitários dos guards do efi-mtls-probe.
// Executar: npx tsx supabase/functions/efi-mtls-probe/guards.test.ts
// Somente leitura. Não acessa banco/rede. Não contém segredos.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  EFI_ALLOWED_HOSTS,
  EFI_REQUIRED_ENVIRONMENT,
  extractHostname,
  isAllowedHost,
  isAllowedMethod,
  isAuthorizedToken,
  isForbiddenHost,
  isHomologacao,
} from "./guards.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROBE_DIR = __dirname;

let pass = 0;
let fail = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}  -> ${(e as Error).message}`);
  }
}

console.log("=== EFI-INT-04A.2 — GUARD TESTS ===");
console.log(`EFI_REQUIRED_ENVIRONMENT = ${EFI_REQUIRED_ENVIRONMENT}`);
console.log(`EFI_ALLOWED_HOSTS = ${EFI_ALLOWED_HOSTS.join(", ")}`);

console.log("\n-- Guards de ambiente --");
check("ambiente ausente -> bloqueado", () => assert.equal(isHomologacao(undefined), false));
check("environment=production -> bloqueado", () => assert.equal(isHomologacao("production"), false));
check("environment=homologacao -> permitido", () => assert.equal(isHomologacao("homologacao"), true));
check("environment=HOMOLOGACAO (case errado) -> bloqueado", () => assert.equal(isHomologacao("HOMOLOGACAO"), false));
check("environment=homologacao (espaco) -> bloqueado", () => assert.equal(isHomologacao("homologacao "), false));

console.log("\n-- Allowlist de host --");
check("host HML Pix -> permitido", () => assert.equal(isAllowedHost("pix-h.api.efipay.com.br"), true));
check("host HML Cobrancas -> permitido", () => assert.equal(isAllowedHost("cobrancas-h.api.efipay.com.br"), true));
check("host PRODUCAO Pix -> bloqueado", () => assert.equal(isAllowedHost("pix.api.efipay.com.br"), false));
check("host PRODUCAO Cobrancas -> bloqueado", () => assert.equal(isAllowedHost("cobrancas.api.efipay.com.br"), false));
check("host producao marcado como forbidden", () => assert.equal(isForbiddenHost("pix.api.efipay.com.br"), true));
check("host arbitrario -> bloqueado", () => assert.equal(isAllowedHost("evil.example.com"), false));
check("host vazio/null -> bloqueado", () => { assert.equal(isAllowedHost(""), false); assert.equal(isAllowedHost(null), false); });
check("host com maiusculas HML -> permitido", () => assert.equal(isAllowedHost("PIX-H.API.EFIPAY.COM.BR"), true));

console.log("\n-- extractHostname / URL maliciosa --");
check("extract de default HML -> pix-h", () => assert.equal(extractHostname(undefined, "https://pix-h.api.efipay.com.br"), "pix-h.api.efipay.com.br"));
check("extract de env HML valida", () => assert.equal(extractHostname("https://cobrancas-h.api.efipay.com.br", "https://pix-h.api.efipay.com.br"), "cobrancas-h.api.efipay.com.br"));
check("env apontando para PRODUCAO -> extrai prod e allowlist bloqueia", () => {
  const h = extractHostname("https://pix.api.efipay.com.br", "https://pix-h.api.efipay.com.br");
  assert.equal(h, "pix.api.efipay.com.br");
  assert.equal(isAllowedHost(h), false);
});
check("env com URL invalida -> null (bloqueado)", () => assert.equal(extractHostname("nao-e-url", "https://pix-h.api.efipay.com.br"), null));
check("env com host embutido em path (evasao) -> hostname real e checado", () => {
  const h = extractHostname("https://pix.api.efipay.com.br@pix-h.api.efipay.com.br", "https://pix-h.api.efipay.com.br");
  // URL.userinfo: hostname real = pix-h.api.efipay.com.br (permitido) — documentado;
  // a URL final usada e https://<hostname>, sem credenciais embutidas.
  assert.equal(h, "pix-h.api.efipay.com.br");
});

console.log("\n-- Metodos --");
check("GET permitido", () => assert.equal(isAllowedMethod("GET"), true));
check("OPTIONS permitido", () => assert.equal(isAllowedMethod("OPTIONS"), true));
check("POST bloqueado", () => assert.equal(isAllowedMethod("POST"), false));
check("PUT bloqueado", () => assert.equal(isAllowedMethod("PUT"), false));
check("DELETE bloqueado", () => assert.equal(isAllowedMethod("DELETE"), false));

console.log("\n-- Token interno --");
check("token ausente (expected undefined) -> bloqueado", () => assert.equal(isAuthorizedToken(undefined, "abc"), false));
check("token ausente (provided undefined) -> bloqueado", () => assert.equal(isAuthorizedToken("abc", undefined), false));
check("token incorreto -> bloqueado", () => assert.equal(isAuthorizedToken("abc", "def"), false));
check("token correto -> permitido", () => assert.equal(isAuthorizedToken("abc", "abc"), true));

console.log("\n-- Inspecao estatica do codigo do probe --");
const indexRaw = readFileSync(resolve(PROBE_DIR, "index.ts"), "utf8");
const guardsRaw = readFileSync(resolve(PROBE_DIR, "guards.ts"), "utf8");
// Remove comentarios de bloco e de linha para inspecionar apenas CODIGO.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\s\/\/.*$/gm, " ");
}
const indexSrc = indexRaw;
const code = stripComments(indexRaw) + "\n" + stripComments(guardsRaw);
const forbidden = [
  { label: "supabase-js import", re: /@supabase\/supabase-js/ },
  { label: "createClient", re: /createClient\s*\(/ },
  { label: "SUPABASE_SERVICE_ROLE_KEY", re: /SUPABASE_SERVICE_ROLE_KEY/ },
  { label: "supabase.from", re: /supabase\s*\.\s*from\s*\(/ },
  { label: "supabase.rpc", re: /supabase\s*\.\s*rpc\s*\(/ },
  { label: "supabase.storage", re: /supabase\s*\.\s*storage/ },
  { label: "auth.getUser", re: /auth\s*\.\s*getUser/ },
  { label: "TMS_EDGE_INTERNAL_TOKEN", re: /TMS_EDGE_INTERNAL_TOKEN/ },
  { label: "rota financeira /v2/cob", re: /\/v2\/cob/ },
];
for (const f of forbidden) {
  check(`ausencia de: ${f.label}`, () => assert.equal(f.re.test(code), false));
}
check("usa EFI_PROBE_TOKEN", () => assert.equal(/EFI_PROBE_TOKEN/.test(indexSrc), true));
check("usa isHomologacao", () => assert.equal(/isHomologacao\s*\(/.test(indexSrc), true));
check("usa isAllowedHost", () => assert.equal(/isAllowedHost\s*\(/.test(indexSrc), true));
check("usa isAllowedMethod", () => assert.equal(/isAllowedMethod\s*\(/.test(indexSrc), true));

console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
