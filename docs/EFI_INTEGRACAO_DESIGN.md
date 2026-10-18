# EFI-INT-03 — Desenho Técnico da Integração Efí Bank (HML)

> Status: **DESENHO / PROPOSTA — NADA APLICADO**
> Escopo: HOMOLOGAÇÃO. Nenhuma migration aplicada, nenhuma Edge Function criada,
> nenhuma credencial inserida, produção intocada.
> Documento irmão: `EFI-INT-03-DESIGN.txt` (relatório da missão).

---

## 1. Visão de Arquitetura

```
Financeiro (React)
   │  bankingService.ts  (fino, SEM segredos, chama via JWT)
   ▼
Supabase Edge Function  efi-banking  (Deno, mTLS + secrets)   ◀── webhook Efi
   │  provider Efi (Cobranças / Pix / Pagamento de Contas)         │
   ▼                                                               ▼
Postgres: efi_cobrancas · efi_pix_pagamentos · efi_eventos      (validação + idempotência)
   │
   ▼
RPCs financeiros EXISTENTES (não recriar fato econômico):
   f_registrar_baixa_financeira      (A) baixa do MESMO recebível
   f_confirmar_pagamento_prestador   (B) baixa do MESMO pagamento
```

Princípios:
1. O frontend NUNCA fala com a Efí e NUNCA vê credencial.
2. A Efí só **anexa identificadores** ao registro financeiro já existente.
3. Toda liquidação passa pelas RPCs de baixa existentes (idempotentes).
4. CNAB permanece intacto.
5. Somente HOMOLOGAÇÃO nesta fase.

---

## 2. mTLS — Resultado Técnico

Runtime real do projeto: `supabase/config.toml` → `[edge_runtime] deno_version = 2`,
Edge Functions compatíveis com Deno 2 (hosted Supabase).

| Questão | Conclusão |
|---|---|
| `fetch()` aceita `.p12` direto? | **NÃO.** Deno só aceita PEM. PKCS#12 (.p12) e DER não são aceitos. |
| Existe API de cliente TLS no runtime? | **SIM.** `Deno.createHttpClient({ cert, key, caCerts })` foi exposto no edge-runtime pelo PR #515 (merge 18/03/2025, Deno 2.1). |
| Nomes corretos das opções? | **`cert` e `key`** (PEM). Nomes do ecossistema Node (`certChain`/`privateKey`) são **ignorados silenciosamente** — não usar. |
| Formato da chave? | **PKCS#8** (`-----BEGIN PRIVATE KEY-----`). PKCS#1 (`BEGIN RSA PRIVATE KEY`) pode **derrubar o isolate** no runtime atual (regressão reportada em 1.76.0 / Deno 2.1.4). |
| `.p12` via secret base64? | Armazenar o `.p12` não resolve: precisa ser **convertido para PEM cert + PEM key (PKCS#8)** antes. |
| Senha do `.p12`? | Necessária apenas na conversão **fora** do runtime. O runtime recebe cert/key já em PEM (sem senha). |
| Egress IP | **NÃO é estático** nas Edge Functions — validar se a Efí exige allowlist de IP. |
| mTLS de ENTRADA (webhook) | **NÃO é possível** na URL gerenciada da Edge Function (TLS termina na infra Supabase). Se a Efí exigir rejeição do probe sem certificado no handshake, será necessário um **shim** em infra controlada. |

Formato recomendado do certificado:
1. Converter o `.p12` HML (fora do repositório, em máquina controlada) para:
   - `cert.pem` (X.509, cadeia) — `openssl pkcs12 -in efi-hml.p12 -clcerts -nokeys -out cert.pem`
   - `key.pkcs8.pem` — `openssl pkcs12 -in efi-hml.p12 -nocerts -nodes ... | openssl pkcs8 -topk8 -nocrypt ...`
2. Registrar SÓ os conteúdos (base64) nos Supabase Secrets.
3. **Nunca** copiar o `.p12` para o projeto; `.gitignore` já cobre `*.p12/*.pem/*.key`.

Nomes finais das secrets (HML, somente nomes):
- `EFI_ENVIRONMENT` = `"homologacao"`
- `EFI_CLIENT_ID_HML`
- `EFI_CLIENT_SECRET_HML`
- `EFI_CERTIFICATE_HML` (PEM cert, base64)
- `EFI_PRIVATE_KEY_HML` (PEM key PKCS#8, base64) ← adicional, tecnicamente necessário para o par `cert`/`key` do Deno.
- (condicional) `EFI_WEBHOOK_SECRET_HML` — só se a Efí oferecer validação por token/HMAC (não assumido).

---

## 3. Schema Aditivo PROPOSTO (NÃO APLICAR)

Convenções seguem o padrão do projeto: `tenant_id DEFAULT current_tenant_id_safe()`,
RLS com guard `EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())`,
grants restritos a `authenticated`/`service_role` (sem `anon`/`PUBLIC`).

```sql
-- ============================================================================
-- EFI-INT-03 — SCHEMA PROPOSTO (ADITIVO) — NÃO APLICAR NESTA MISSÃO
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. efi_cobrancas — boleto/cobrança (API Cobranças)
--    Vinculação OBRIGATÓRIA: fatura_id + receber_id + ambiente
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.efi_cobrancas (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL DEFAULT current_tenant_id_safe(),
    ambiente          text NOT NULL DEFAULT 'homologacao',
    fatura_id         uuid NOT NULL REFERENCES public.faturas(id) ON DELETE RESTRICT,
    receber_id        uuid NOT NULL REFERENCES public.financeiro_receber(id) ON DELETE RESTRICT,

    -- Identificadores da cobrança na Efí (mascarados no domínio; aqui são IDs)
    charge_id         text,                 -- id da cobrança na Efí
    txid              text,                 -- identificador próprio (Pix/Bolix)
    nosso_numero      text,

    -- Dados de cobrança
    status            text NOT NULL DEFAULT 'criada',
    valor             numeric(18,2) NOT NULL,
    vencimento        date,

    -- Instrumentos
    linha_digitavel   text,
    codigo_barras     text,
    pdf_url           text,
    barcode_url       text,
    pix_copia_cola    text,
    pix_qrcode_url    text,
    bolix             jsonb,                -- dados Bolix quando aplicável

    -- Rastreabilidade (payload sanitizado — sem segredos/certificado)
    metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,

    criado_em         timestamptz NOT NULL DEFAULT now(),
    atualizado_em     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ck_efi_cobrancas_ambiente CHECK (ambiente IN ('homologacao','producao')),
    CONSTRAINT ck_efi_cobrancas_status CHECK (status IN (
      'criada','registrada','paga','cancelada','expirada','falhou','baixada'
    ))
);

-- Anti-duplicidade: 1 cobrança ATIVA por recebível (e por fatura)
CREATE UNIQUE INDEX IF NOT EXISTS uq_efi_cobrancas_receber_ativa
  ON public.efi_cobrancas (receber_id)
  WHERE status NOT IN ('cancelada','expirada','baixada');
CREATE UNIQUE INDEX IF NOT EXISTS uq_efi_cobrancas_charge
  ON public.efi_cobrancas (ambiente, charge_id)
  WHERE charge_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_efi_cobrancas_txid
  ON public.efi_cobrancas (ambiente, txid)
  WHERE txid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_efi_cobrancas_fatura ON public.efi_cobrancas (fatura_id);
CREATE INDEX IF NOT EXISTS idx_efi_cobrancas_receber ON public.efi_cobrancas (receber_id);
CREATE INDEX IF NOT EXISTS idx_efi_cobrancas_status ON public.efi_cobrancas (status);

-- ----------------------------------------------------------------------------
-- 2. efi_pix_pagamentos — Pix a prestador (API Pix)
--    Vinculação OBRIGATÓRIA: pagamento_prestador_id + ambiente
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.efi_pix_pagamentos (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL DEFAULT current_tenant_id_safe(),
    ambiente               text NOT NULL DEFAULT 'homologacao',
    pagamento_prestador_id uuid NOT NULL REFERENCES public.pagamentos_prestadores(id) ON DELETE RESTRICT,

    idempotency_key        text NOT NULL,          -- chave de idempotência do TMS
    end_to_end_id          text,                   -- E2E da Efí quando existir
    status                 text NOT NULL DEFAULT 'preparado',
    valor                  numeric(18,2) NOT NULL,
    chave_pix_destino      text,
    referencia             text,                   -- id/URL do comprovante, quando aplicável
    comprovante_url        text,
    baixa_id               uuid REFERENCES public.financeiro_baixas(id) ON DELETE SET NULL,

    erro                   text,
    metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

    criado_em              timestamptz NOT NULL DEFAULT now(),
    atualizado_em          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ck_efi_pix_ambiente CHECK (ambiente IN ('homologacao','producao')),
    CONSTRAINT ck_efi_pix_status CHECK (status IN (
      'preparado','enviado','liquidado','falhou','cancelado','devolvido'
    ))
);

-- Anti-duplicidade: idempotência forte + 1 Pix ATIVO por pagamento
CREATE UNIQUE INDEX IF NOT EXISTS uq_efi_pix_idempotency
  ON public.efi_pix_pagamentos (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_efi_pix_e2e
  ON public.efi_pix_pagamentos (ambiente, end_to_end_id)
  WHERE end_to_end_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_efi_pix_pagamento_ativo
  ON public.efi_pix_pagamentos (pagamento_prestador_id)
  WHERE status NOT IN ('falhou','cancelado','devolvido');
CREATE INDEX IF NOT EXISTS idx_efi_pix_pagamento ON public.efi_pix_pagamentos (pagamento_prestador_id);
CREATE INDEX IF NOT EXISTS idx_efi_pix_status ON public.efi_pix_pagamentos (status);

-- ----------------------------------------------------------------------------
-- 3. efi_eventos — webhooks/eventos (idempotência de ingestão)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.efi_eventos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid,
    ambiente        text NOT NULL DEFAULT 'homologacao',
    tipo            text NOT NULL,               -- ex.: 'cobranca.paga','pix.liquidado',...
    efi_id          text,                        -- identificador externo do evento/recurso
    idempotency_key text NOT NULL,               -- chave determinística do evento
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- sanitizado (sem segredos)
    processado      boolean NOT NULL DEFAULT false,
    erro            text,
    recebido_em     timestamptz NOT NULL DEFAULT now(),
    processado_em   timestamptz,

    CONSTRAINT ck_efi_eventos_ambiente CHECK (ambiente IN ('homologacao','producao'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_efi_eventos_idempotency
  ON public.efi_eventos (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_efi_eventos_externo
  ON public.efi_eventos (ambiente, tipo, efi_id)
  WHERE efi_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_efi_eventos_processado ON public.efi_eventos (processado);

-- ----------------------------------------------------------------------------
-- 4. efi_config — AVALIADA. DECISÃO: NÃO CRIAR AGORA.
--    Credenciais/certificado DEVEM ficar em Supabase Secrets (nunca em tabela).
--    Mapeamento conta_financeira ↔ conta Efí pode usar `metadata` em uma futura
--    evolução ou coluna aditiva em contas_financeiras, quando houver multi-conta.
--    Criar tabela "por conveniência" foi descartado nesta fase.
-- ----------------------------------------------------------------------------
```

RLS proposta (mesmo padrão das tabelas financeiras do projeto):

```sql
-- Aplica às 3 tabelas (efi_cobrancas, efi_pix_pagamentos, efi_eventos)
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<t>_select_tms" ON public.<tabela> FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
CREATE POLICY "<t>_insert_tms" ON public.<tabela> FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
CREATE POLICY "<t>_update_tms" ON public.<tabela> FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
-- Sem policy DELETE (integração é auditável; falha/cancelamento é UPDATE de status)

REVOKE ALL ON TABLE public.<tabela> FROM anon;
REVOKE ALL ON TABLE public.<tabela> FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.<tabela> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<tabela> TO service_role;
```

Observação: para `efi_eventos`, a ingestão do webhook ocorre via Edge Function com
`service_role`; usuários TMS apenas leem (poderia restringir INSERT só a service_role).

---

## 4. Contratos das RPCs Existentes (vigentes — NÃO MODIFICAR)

### 4.1 `f_registrar_baixa_financeira` — versão final: `20260903000000_fin_master361_core_financeiro.sql`

Assinatura vigente (11 parâmetros):
```
f_registrar_baixa_financeira(
  p_titulo_tabela       TEXT,
  p_titulo_id           UUID,
  p_valor_baixado       NUMERIC,
  p_data_baixa          DATE DEFAULT CURRENT_DATE,
  p_forma_pagamento     TEXT DEFAULT NULL,
  p_conta_financeira    TEXT DEFAULT NULL,
  p_conta_financeira_id UUID DEFAULT NULL,
  p_referencia_bancaria TEXT DEFAULT NULL,
  p_observacao          TEXT DEFAULT NULL,
  p_usuario_id          UUID DEFAULT NULL,
  p_usuario_nome        TEXT DEFAULT NULL
)
RETURNS TABLE(sucesso BOOLEAN, mensagem TEXT, baixa_id UUID, saldo_restante NUMERIC, status_titulo TEXT)
```
- **Aceita `p_titulo_tabela = 'financeiro_receber'`?** **SIM** (branch introduzida em
  `20260818000002_f0d` e mantida em `fin_master361`).
- Atualiza `financeiro_receber`: `status`, `data_pagamento`, `conta_entrada`, `observacoes`.
- Status resultante: `parcial` (saldo > 0) ou `pago`.
- Grava `financeiro_baixas` (com `conta_financeira_id`, `referencia_bancaria`).
- Grants: `authenticated` + `service_role` (sem `anon`/`PUBLIC`).
- ATENÇÃO: como as duas versões foram criadas com `CREATE OR REPLACE` mudando a
  aridade, a assinatura de 10 parâmetros (F0-C4/F0-D) pode **coexistir** como
  overload no banco. Verificar/consolidar em EFI-INT-04 (não alterar agora).

### 4.2 `f_confirmar_pagamento_prestador` — versão final: `20260920_02mf_fix_rpc_pagamento_prestador_parcial.sql`

Assinatura vigente (3 parâmetros, com default):
```
f_confirmar_pagamento_prestador(
  p_pagamento_id   uuid,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_valor_pago     numeric DEFAULT NULL
)
RETURNS TABLE(
  sucesso boolean, mensagem text, pagamento_id uuid, titulo_id uuid, baixa_id uuid,
  valor_pagamento numeric, valor_liquidado numeric, saldo_restante numeric,
  conta_financeira_id uuid, conta_financeira text, status_pagamento text
)
```
- Suporta pagamento **parcial** (`p_valor_pago`); `NULL` = valor integral.
- Idempotente: rejeita se `status_pagamento`/`status` já for `pago` ou `cancelado`.
- Atômica: baixa (`financeiro_baixas`) + status do pagamento na mesma transação.
- Localiza o título (`financeiro_pagar`) por OS+valor+prestador (ou prestador+valor).
- Grants: `authenticated` + `service_role`.
- A RPC de fechamento (`f_confirmar_pagamento_fechamento`) reutiliza esta por item.

Fluxo de baixa da Efi (desenho):
```
A) Boleto pago   → webhook → efi_eventos → localizar efi_cobrancas.receber_id
                 → f_registrar_baixa_financeira('financeiro_receber', receber_id, valor,
                    p_forma_pagamento:='boleto', p_referencia_bancaria:=<id Efi>)
B) Pix liquidado → webhook → efi_eventos → localizar efi_pix_pagamentos.pagamento_prestador_id
                 → f_confirmar_pagamento_prestador(pagamento_id, data, valor)
```

---

## 5. Idempotência / Anti-duplicidade (resumo)

| Risco | Mecanismo |
|---|---|
| Duas cobranças para o mesmo recebível | `uq_efi_cobrancas_receber_ativa` (parcial) |
| Webhook repetido (at-least-once) | `uq_efi_eventos_idempotency` + `uq_efi_eventos_externo` |
| Baixa dupla no recebível | RPC `f_registrar_baixa_financeira` (saldo + status) + `referencia_bancaria` |
| Pix duplicado | `uq_efi_pix_idempotency` + `uq_efi_pix_pagamento_ativo` |
| Baixa dupla no prestador | RPC `f_confirmar_pagamento_prestador` (bloqueia se pago) |
| Novo fato econômico | PROIBIDO: nenhum INSERT em `financeiro_receber`/`pagamentos_prestadores` |

---

## 6. Riscos e Bloqueios

1. **mTLS no edge-runtime 1.76.0 (Deno 2.1.4):** regressão reportada — chave PKCS#1
   derruba o isolate; `certChain/privateKey` são ignorados. Mitigação: usar `cert`+`key`
   com **PKCS#8**. **Validar empiricamente em HML na EFI-INT-04** (prova de mTLS real).
2. **mTLS de ENTRADA no webhook:** se a Efí exigir rejeição TLS do probe sem certificado,
   a URL gerenciada não atende → shim (container/VM com reverse proxy) necessário.
3. **Egress IP não estático:** se a Efí exigir allowlist de IP, avaliar shim.
4. **Overload da RPC de baixa** (10 vs 11 args) — verificar e consolidar (sem alterar em EFI-INT-03).
5. **Ambiente:** somente HML. Nenhum dado de produção.
6. **Doc legada:** `src/docs/FINANCEIRO_INTEGRACOES.md` também cita ConfiguracaoEfi genérica
   (clientId/clientSecret/callbackUrl) — sem valores; alinhar em missão futura se necessário.

---

## 7. Micro-missões seguintes

- EFI-INT-04 — Edge Function `efi-banking` HML: autenticação mTLS (cert/key PKCS#8 via Secrets)
  + endpoint de health/consulta somente-leitura. Prova de handshake.
- EFI-INT-05 — API Cobranças (A) + migration aditiva `efi_cobrancas` + UI "Gerar Boleto".
- EFI-INT-06 — Webhook de cobrança + baixa do mesmo `financeiro_receber`.
- EFI-INT-07 — API Pix (B) + `efi_pix_pagamentos` + `f_confirmar_pagamento_prestador`.
- EFI-INT-08 — E2E financeiro/bancário HML + prova de zero duplicidade.
- EFI-INT-09 — API Pagamento de Contas (C) — somente após A/B homologados.
