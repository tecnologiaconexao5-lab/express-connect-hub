# efi-mtls-probe — Edge Function de DIAGNÓSTICO (SOMENTE HML)

> **TEMPORÁRIA / DIAGNÓSTICO / HML.** Não faz transação financeira.
> Não implementa boleto, Pix nem webhook. Não acessa banco.
> Protegida por token interno. Pode ser removida após a prova.

## Blindagem (EFI-INT-04A.2) — apenas HOMOLOGAÇÃO

Guards obrigatórios (bloqueiam ANTES de criar o HttpClient/fetch):
- **Ambiente exato:** `EFI_ENVIRONMENT === "homologacao"` (qualquer outro valor ou ausência → `503`).
- **Allowlist fixa de hosts** (`guards.ts`) — mesmo se `EFI_API_BASE_URL_HML` estiver errada:
  - permitidos: `pix-h.api.efipay.com.br`, `cobrancas-h.api.efipay.com.br`
  - proibidos (e qualquer outro): `pix.api.efipay.com.br`, `cobrancas.api.efipay.com.br` → `403`
- **Métodos:** somente `GET` e `OPTIONS` (demais → `405`).
- **Token interno:** `EFI_PROBE_TOKEN` — ausente → `503`; incorreto → `401` (token nunca retornado/logado).
- **Caminho neutro:** testa transporte em `/` e `/_efi_mtls_probe` (não-financeiro). Sem listagem de cobranças/Pix.
- **Zero** `supabase-js`, `SUPABASE_SERVICE_ROLE_KEY`, DB, RPC, Auth, Storage.

Testes dos guards: `npx tsx supabase/functions/efi-mtls-probe/guards.test.ts` (40 casos PASS).

## O que faz

Prova, no runtime **hospedado**, se conseguimos:
1. construir um `HttpClient` mTLS (`Deno.createHttpClient({ cert, key })`);
2. estabelecer handshake TLS/HTTPS contra o host HML da Efí.

Resposta **sanitizada** (apenas booleanos/classes; nunca cert/chave).

Classificação:
- `tls_handshake`: `PASS` (TLS estabelecido e HTTP respondeu) | `FAIL` | `NOT_RUN`.
- `http_reached`: `true`/`false`.
- `http_status`: código HTTP quando seguro.
- `auth_api`: sempre `NOT_TESTED` — 401/403 **não** é falha de mTLS.

## Secrets necessários (SOMENTE HML) — nunca valores em arquivo

Configurar via Supabase Secrets (nomes):
- `EFI_ENVIRONMENT` = `homologacao`
- `EFI_CERTIFICATE_HML` = certificado X.509 convertido para PEM e codificado em base64
- `EFI_PRIVATE_KEY_HML` = chave privada convertida para PEM **PKCS#8** e codificada em base64
- `EFI_PROBE_TOKEN` = token interno aleatório (proteção do endpoint)
- (opcional) `EFI_API_BASE_URL_HML` = host Efí HML (default `https://pix-h.api.efipay.com.br`)

> `EFI_CLIENT_ID_HML` / `EFI_CLIENT_SECRET_HML` NÃO são usados nesta prova (sem OAuth).

## Deploy (SOMENTE HML)

```bash
# 1) linkar SOMENTE no projeto HML
supabase link --project-ref <HML_PROJECT_REF>

# 2) subir a função (diagnóstico: sem verify_jwt, protegida por token próprio)
supabase functions deploy efi-mtls-probe --no-verify-jwt --project-ref <HML_PROJECT_REF>
```

## Uso

```bash
curl -s "https://<HML_PROJECT_REF>.supabase.co/functions/v1/efi-mtls-probe" \
  -H "x-efi-probe-token: <EFI_PROBE_TOKEN>"
```

Resposta esperada (exemplo de forma, sem segredos):
```json
{ "ok": true, "result": {
  "createHttpClient_available": true,
  "cert_present": true, "key_present": true,
  "http_client_created": true,
  "tls_handshake": "PASS", "http_reached": true, "http_status": 401,
  "auth_api": "NOT_TESTED"
} }
```

## Remoção (após a prova)

```bash
supabase functions delete efi-mtls-probe --project-ref <HML_PROJECT_REF>
```
