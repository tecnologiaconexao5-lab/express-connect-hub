# Relatório Técnico de Auditoria — Módulo Fiscal (express-connect-hub)

**Data:** 2026-11-17
**Escopo:** Somente leitura. Nenhum código ou banco foi alterado.
**Objetivo:** Mapear o que já existe no módulo fiscal para reaproveitar na migração da **NFS-e para o Padrão Nacional (SEFIN)**, mantendo **CT-e/MDF-e na Focus NFe**.

---

## Sumário Executivo

| Área | Estado atual | Pronto para plugar novo motor NFS-e? |
|------|--------------|--------------------------------------|
| Tabelas fiscais | `fiscal_nfse/ctes/mdes` + suporte (events, logs, historico, docs vinculados, regras) | ✅ Sim — `fiscal_nfse` é genérica (colunas `numero`, `chave_acesso`, `protocolo`, `xml_url`, `pdf_url`, `metadata`) |
| Edge Functions Focus | 5 functions; **todas operam só CT-e** na prática (`focus-emissao` aceita `nfse` no tipo mas sem caminho real de NFS-e) | ⚠️ Parcial — a function emite é o ponto de troca |
| Frontend/serviços | `focusService.ts` é o único invoker; `NfseTab.tsx` já acopla emissão NFS-e à configuração Focus | ⚠️ Alto acoplamento em 2 pontos (ver §5) |
| Armazenamento XML/PDF | Buckets privados `fiscal-documentos` + `certificados-fiscais`; verdade em `metadata.documentos_storage` / `storage_path`, **não** em `xml_url/pdf_url` | ✅ Sim — reuso direto, só trocar o writer |
| Isolamento Focus × neutro | Inverteria: criar path NFS-e paralelo sem tocar em CT-e/MDF-e | ✅ Caminho claro (ver §5.3) |

**Conclusão:** o módulo foi desenhado com três documentos irmãos (`fiscal_nfse`, `fiscal_ctes`, `fiscal_mdfes`) e uma tabela de eventos/logs compartilhada — a base para desacoplar NFS-e da Focus já existe. O acoplamento real está no **frontend** (`focusService` + `NfseTab`) e no **dispatcher** da `focus-emissao`.

---

## 1. Tabelas e Migrations Fiscais

### 1.1 Tabelas de documento (irmãs, schema idêntico)

Criadas em `supabase/migrations/20260602099998_central_fiscal_fundacao.sql`:

| Tabela | Colunas-chave |
|--------|---------------|
| `fiscal_nfse` | `id, filial_id, cliente_id, ordem_servico_id, numero, chave_acesso, status (default 'pendente'), valor, data_emissao, xml_url, pdf_url, protocolo, motivo_rejeicao, metadata JSONB, created_at, updated_at` |
| `fiscal_ctes` | idem |
| `fiscal_mdfes` | idem |

- Índices por `status`, `cliente_id`, `ordem_servico_id`, `data_emissao`, `chave_acesso`.
- Trigger `updated_at` nas três.
- **`xml_url`/`pdf_url` existem como colunas mas na prática ficam `NULL`** — a verdade do arquivo vive em `metadata.documentos_storage.{xml,dacte}` (CT-e) e/ou `fiscal_documentos_vinculados.xml_storage_path` (ver §4).

### 1.2 Tabelas de suporte

| Tabela | Migration | Papel |
|--------|-----------|-------|
| `fiscal_events` | fundação | Eventos por `documento_tipo` (`'NFSE' \| 'CTE' \| 'MDFE'`) + `documento_id` — **já é multi-documento, reaproveitável para NFS-e** |
| `fiscal_logs` | fundação | Log de request/response (`entidade_tipo` inclui `'API_FOCUS'`) — genérico |
| `fiscal_historico_status` | `20260531_fiscal_historico_status.sql` | Histórico de status |
| `fiscal_documentos_vinculados` | `20260602100006_fiscal_documentos_vinculados.sql` | Vínculo NF-e/CT-e/MDF-e ↔ OS; coluna `xml_storage_path`; bucket `fiscal-documentos` (linha 98) |
| `regras_fiscais_nfse` | `20260602100001_regras_fiscais_nfse.sql` | Regras municipais NFS-e (código IBGE, alíquotas) — **já é caminho neutro, independente de emissor** |
| `regras_fiscais_cte` | `20260602100004_regras_fiscais_cte.cfop` | CFOP/ICMS CT-e |
| `configuracoes_fiscais` | `20260602100000_configuracoes_fiscais.sql` | Emitentes fiscais + colunas Focus (`focus_empresa_id`, `focus_token_configurado`, `focus_status`) + certificado |
| — | `20260602100005_certificados_fiscais.sql` | Bucket `certificados-fiscais` (linha 54) |

### 1.3 RLS / Policies (relevante para o novo motor)

- **Fundação (20260602099998):** policies `Enable ALL for authenticated users` (FOR ALL, `auth.role()='authenticated'`) em `fiscal_nfse/ctes/mdes/events/logs` — sem filtro de tenant.
- **`20260801000001_e3_fiscal_policies_cleanup.sql`:** dropa policies públicas e cria policies **SELECT-only** com guard `EXISTS (tenant_usuarios WHERE user_id = auth.uid())` para `fiscal_documentos_vinculados`, `fiscal_events`, `fiscal_historico_status`, `fiscal_logs`; INSERT/UPDATE só em `fiscal_documentos_vinculados`.
  - **Leitura confirmada (linhas 1–128):** o arquivo dropa `Enable ALL for authenticated users` em `fiscal_ctes` (L15), `fiscal_mdfes` (L46) e `fiscal_nfse` (L51), recriando para essas três tabelas **somente** as policies scoped `fcte_*`/`fnfse_*`/`fmdfe_*` já existentes (SELECT/INSERT/UPDATE, `tenant_usuarios` guard — `20260801000005_m06_rls_remaining_tables.sql` L588–690, reaplicadas por `20260802000000_m07_rls_final_cleanup.sql` L213–288). Para as 4 tabelas de apoio cria SELECT-only + INSERT/UPDATE em `fiscal_documentos_vinculados` (L60–128). **Resultado: nenhuma escrita aberta a anon em tabela fiscal** — `fiscal_nfse` não é SELECT-only (mantém escrita authenticated com guard), seguro para o novo motor via service_role/RPC.
- **`configuracoes_sistema`** (`202605200001`): RLS sem guard (`USING true`) — se algum config de emissão NFS-e for gravada ali, é ponto de atenção.

**Regra para o novo motor:** não criar tabela paralela de NFS-e. Reusar `fiscal_nfse` + `fiscal_events` + `fiscal_logs` + `fiscal_documentos_vinculados` + `regras_fiscais_nfse`.

---

## 2. Edge Functions Focus (Supabase)

Todas em `supabase/functions/`:

| Function | Arquivo | O que faz | Foco |
|----------|---------|-----------|------|
| `focus-emissao` | `index.ts` (607) + `mapper.ts` (406) | Emissão | `TIPOS_VALIDOS = ["cte","mdfe","nfse"]`; `TABELAS = { cte: "fiscal_ctes", mdfe: "fiscal_mdfes", nfse: "fiscal_nfse" }`; ação `ping`; `cadastrar_cliente` (upsert em `clientes`); status `rascunho`; payload em `metadata.payload_focus`; modo real gateado por `focusRealEnabled === "true" && focusToken`, baseUrl `https://homologacao.focusnfe.com.br/v2`, `ref = cte-${documentoId}`, `Basic ${btoa(focusToken + ":")}`; erros → `fiscal_events`/`fiscal_logs`; 500 `TOKEN_HOMOLOGACAO_AUSENTE` |
| `focus-consulta` | `index.ts` | Consulta | **Só `tipoDocumento === "cte"`**; `ambiente` default `homologacao` |
| `focus-documentos` | `index.ts` | Download XML/DACFE | **Só CT-e**; upload `storage.from("fiscal-documentos")` (212–214); `createSignedUrl(3600/600)`; grava `storage_path` em `metadata.documentos_storage[tipoDoc]` (228–288); **`xml_url`/`pdf_url` ficam null** (comentário linha 249) |
| `fiscal-documento-url` | `index.ts` (168) | Signed URL | **Só `cte`**, `xml\|dacte`; dupla trava de produção (`FOCUS_AMBIENTE=producao` + `FOCUS_PRODUCAO_LIBERADA === "true"` senão 403); `createSignedUrl` linha 121 |
| `fiscal-email-documentos` | `index.ts` (181) | E-mail lote | body `{ cteIds, destinatarios, cc, assunto, mensagem, romaneioNumero, loteId }`; `createSignedUrl` linhas 59/73 |

### 2.1 `mapper.ts` (406 linhas)

- `validarPayloadAntesDeEnviar`: CNPJ ≥14, RNTRC 8 dígitos.
- `converterPayloadInternoParaFocusCteOficial`: monta payload CT-e oficial (ICMS 12%).
- **Não existe equivalente NFS-e** — o mapper é CT-e específico.

### 2.2 Achados-chave da function emissoa

- O tipo `nfse` **é aceito** no dispatcher (linhas 12, 135–149) e roteia para `fiscal_nfse`, mas:
  - `mapper.ts` só converte para o formato Focus **CT-e**;
  - `focus-consulta`/`focus-documentos`/`fiscal-documento-url` **recusam** NFS-e (filtros `cte`);
  - o `ref` gerado é `cte-${documentoId}` mesmo para outros tipos (prefixo fixo).
- Ou seja: **NFS-e via Focus está apenas esboçada, não implementada**. Isso facilita a troca — não há investimento Focus a proteger em NFS-e.

---

## 3. Frontend e Serviços

### 3.1 Página e abas — `src/pages/Fiscal.tsx` (356 linhas)

Aba `focus` (linhas 199, 243–245) renderiza `<FocusNfeConfig />`. Toasts `MSG_FOCUS_SECRETS` (linha 36) orientam a configurar token **só em Supabase Secrets** (`focus-emissao`), nunca no frontend (linhas 109, 113, 117). Modal "Focus NFe / Efí" (255–272) e fluxo descrito "OS → Focus NFe → Documento" (319).

Demais abas: `dashboard, cte, mdfe, nfse, emitente, regras, regras_nfse, documentos, focus, auditoria`.

### 3.2 Serviço único de emissão — `src/services/fiscal/focusService.ts` (847 linhas)

- **Único ponto do frontend que invoca as Edge Functions Focus** (linhas 86, 109, 151, 259, 351, 410, 434, 452, 498 — `functions.invoke`).
- Lote bloqueia `ambiente !== "homologacao"` (guard de produção).
- Tipos `FocusCte*` importados de `src/types/fiscal.ts`.
- Checklist de produção (821–833).
- Lê/grava `metadata.payload_focus`, `focus_empresa_id`, `focus_token_configurado`, `focus_status`.

### 3.3 Componentes

| Componente | Papel | Acoplamento Focus |
|------------|-------|-------------------|
| `NfseTab.tsx` (355) | Aba NFS-e | **Linha 349 condiciona emissão NFS-e à configuração Focus** (ponto de troca #1). **Bug na linha 62:** usa `sup` em vez de `supabase` (Referência não definida em runtime) |
| `FocusNfeConfig.tsx` (305) | Config Focus | Token/empresa (só Secrets); ações desabilitadas |
| `EmitenteFiscalConfig.tsx` (403) | Emitentes | Upload certificado → bucket `certificados-fiscais` |
| `AuditoriaFiscal.tsx` | Auditoria | Cruza `fiscal_nfse` + `regras_fiscais_nfse` + `payload_focus` (linhas 26–112) |
| `RegrasFiscaisNfse.tsx` / `RegrasFiscaisCte.tsx` / `DocumentosTab.tsx` / `cte/` / `mdfe/` / `FiscalDashboard` | Demais abas | não lidos em detalhe nesta auditoria |

### 3.4 Serviços

| Serviço | Papel |
|---------|-------|
| `nfseService.ts` | Validações NFS-e: emitente, tomador, CNPJ, município, `buscarRegraNfse`, `buscarCodigoIbge` — **neutro, reaproveitável** |
| `configuracoesFiscaisService.ts` (169) | CRUD emitentes fiscais — **neutro** |
| `regrasFiscaisNfseService.ts` | Regras municipais — **neutro** |
| `xmlImportService.ts` | `detectarTipoXml` (`nfe\|cte\|mdfe\|evento_nfe\|cancelamento_nfe\|desconhecido`); `importarXmlNfe` grava **só registro** em `fiscal_documentos_vinculados` — **sem upload para Storage** |
| `cteService.ts`, `cteLoteService.ts`, `mdfeService.ts`, `fiscalStatusService.ts`, `ibgeService.ts`, `romaneioCalvoService.ts`, `rateioFreteCteService.ts` | CT-e/MDF-e/fiscal — fora do escopo da troca NFS-e |
| `storageRefService.ts` | `KNOWN_BUCKETS`, `parseStorageRef`, `createSignedUrl` (92), `SIGN_TTL_SECONDS=600` |

### 3.5 Tipos — `src/types/fiscal.ts`

- Colunas Focus: `focus_empresa_id` (82), `focus_token_configurado` (83), `focus_status?` (84).
- Tipos `FocusCte*`: `Endereco/Emitente/Tomador/Carga/Veiculo/Motorista/DocumentoVinculado/Valores/Fiscal` (99–209).
- `FocusCtePayloadDraft` (216); `xml_url?`/`pdf_url?` (13–14).
- `pdfPreviaCteSemValorFiscal.ts` lê `cte.metadata?.payload_focus` (22, 65, 137).

---

## 4. Armazenamento XML/PDF

### 4.1 Buckets

| Bucket | Privacidade | Limite | Content-types | Uso |
|--------|-------------|--------|---------------|-----|
| `fiscal-documentos` | **private** | 20 MB | `application/xml`, `text/xml`, `application/pdf` | XML/DACFE de documentos fiscais |
| `certificados-fiscais` | **private** | 10 MB | `application/x-pkcs12`, `application/octet-stream` | Certificados A1 (.p12) |
| `documentos` | public | 10 MB | imagens + PDF (**sem XML**) | Documentos operacionais gerais |

### 4.2 Verdade do arquivo (regra a preservar)

- **Não** usar `fiscal_*.xml_url` / `pdf_url` — ficam `null`.
- **CT-e:** `fiscal_ctes.metadata.documentos_storage.{xml,dacte}.{salvo,storage_path}` (escrito por `focus-documentos`, linhas 228–288).
- **Vínculos:** `fiscal_documentos_vinculados.xml_storage_path`.
- **Signed URL:** sempre via `createSignedUrl` (TTL 600s no front, 3600/600 na edge) — nunca URL permanente.

### 4.3 Uso no frontend

- `grep "storage.from\("` em `src`: 13 matches — **nenhum em `src/services/fiscal/`**.
- O módulo fiscal grava/resolve Storage **apenas via Edge Functions** (ou `storageRefService`).
- `xml_url|pdf_url|documentos_storage` (53 matches): `src/types/fiscal.ts:13-14`, `focusService.ts:20-21,144-145,606,739,812`, `romaneioCalvoService.ts:1746`, `contratosService.ts:16,848-851,925` (fluxo próprio de contratos, não fiscal).

**Para o novo motor NFS-e:** seguir o mesmo padrão — gravar `storage_path` em `fiscal_nfse.metadata.documentos_storage.{xml,danfse}` (ou coluna equivalente) e servir por signed URL; não inventar writer direto do frontend.

---

## 5. Acoplamentos Focus × Caminho Neutro

### 5.1 Inventario de acoplamento

| Tipo | Onde | Evidência |
|------|------|-----------|
| Invoke das edges | `focusService.ts` | Único invoker; 9 chamadas `functions.invoke` (86, 109, 151, 259, 351, 410, 434, 452, 498) |
| Greps `focus-emissao\|focus-consulta\|focus-documentos\|fiscal-documento-url\|fiscal-email-documentos\|focusService\|focus_nfe\|FOCUS_` | 32 matches | **Todos** em `focusService.ts` — nenhum em componentes frontend (exceto strings/UX em `Fiscal.tsx`) |
| Tipos Focus | `src/types/fiscal.ts` | 100+ matches `focus_empresa\|focus_token\|focus_status\|payload_focus\|FocusCte` |
| **Emissão NFS-e condicionada à Focus** | `NfseTab.tsx:349` | **Ponto de troca #1** |
| Auditoria lê `payload_focus` | `AuditoriaFiscal.tsx:26-112` | Cruza `fiscal_nfse` + `regras_fiscais_nfse` + `payload_focus` |
| Dispatcher com ramo `nfse` | `focus-emissao/index.ts:12-24,135-149` | Aceita `nfse` mas sem mapper/consulta/documentos NFS-e |
| Prévia PDF lê payload Focus | `pdfPreviaCteSemValorFiscal.ts:22,65,137` | `cte.metadata?.payload_focus` (CT-e — não tocar) |

### 5.2 O que NÃO está acoplado (reaproveitável intocado)

- `fiscal_nfse` (schema), `fiscal_events`, `fiscal_logs`, `fiscal_historico_status`, `fiscal_documentos_vinculados`.
- `regras_fiscais_nfse` + `nfseService.ts` + `regrasFiscaisNfseService.ts` + `ibgeService.ts`.
- Buckets `fiscal-documentos` / `certificados-fiscais` + `storageRefService`.
- CT-e/MDF-e inteiros (`cteService`, `mdfeService`, edges de consulta/documentos/email, mapper CT-e).

### 5.3 Caminho recomendado para plugar o motor NFS-e (Padrão Nacional/SEFIN) sem quebrar Focus

1. **Não tocar** em `focus-emissao` (ramo `cte`/`mdfe`), `focus-consulta`, `focus-documentos`, `fiscal-documento-url`, `fiscal-email-documentos`, `mapper.ts` — CT-e/MDF-e continuam na Focus.
2. **Criar nova Edge Function** (ex.: `nfse-emissao` ou `sefin-emissao`) com o mesmo contrato de escrita: status → `fiscal_nfse`, eventos → `fiscal_events` (`documento_tipo='NFSE'`), logs → `fiscal_logs` (`entidade_tipo` próprio), Storage → `fiscal-documentos` via `storage_path` em `metadata.documentos_storage`.
3. **Desacoplar o frontend em 2 pontos:**
   - `NfseTab.tsx:349` — deixar de condicionar emissão NFS-e ao config Focus; passar a chamar o novo serviço (ex.: `nfseEmissaoService.ts`) mantendo `nfseService`/`regras` como camada neutra.
   - `focusService.ts` — **não** estender para NFS-e; criar serviço irmão (mesmo padrão de invoke) para o novo motor. `focusService` permanece só CT-e/MDF-e.
4. **Auditoria:** `AuditoriaFiscal.tsx` já lê `fiscal_nfse` + `regras_fiscais_nfse`; alinhar a leitura do payload (`payload_focus` → chave neutra do novo motor, ex. `metadata.payload_nfse`) sem quebrar o histórico (ler ambos, priorizar o novo).
5. **Configuração:** novo bloco de config (credenciais SEFIN/ambiente) — preferir tabela `configuracoes_fiscais` (já existe, com colunas Focus) em vez de `configuracoes_sistema` (RLS sem guard). Token/segredo **só em Supabase Secrets**, espelhando o padrão Focus (`MSG_FOCUS_SECRETS`).
6. **Emitente:** reusar `configuracoes_fiscais` + `EmitenteFiscalConfig` + certificado em `certificados-fiscais` (NFS-e padrão nacional pode exigir certificado ICP-Brasil — confirmar).

### 5.4 Riscos / pendências de leitura

| # | Item | Impacto |
|---|------|---------|
| R1 | `NfseTab.tsx:62` — `sup` vs `supabase` | Bug latente na aba NFS-e (corrigir na implementação) |
| R2 | ~~Final de `20260801000001_e3_fiscal_policies_cleanup.sql` (linhas 1–59 não lidas)~~ **CONFIRMADO** | Dropa `Enable ALL for authenticated users` em `fiscal_ctes/mdes/nfse`, deixando só as policies scoped `fcte_*`/`fmdfe_*`/`fnfse_*` (SELECT/INSERT/UPDATE, `tenant_usuarios` guard — `20260801000005_m06` linhas 588–690 e `20260802000000_m07` linhas 213–288). `fiscal_documentos_vinculados` ganha SELECT/INSERT/UPDATE authenticated com guard (linhas 60–128); `fiscal_events/historico_status/logs` só SELECT. **Nenhuma policy de escrita aberta a anon** — o novo motor pode gravar via service_role/RPC sem violar RLS |
| R3 | `configuracoes_sistema` RLS `USING true` | Não usar para segredos/config sensível de emissão |
| R4 | `xml_url`/`pdf_url` sempre null | Não expor como coluna de verdade no novo fluxo (documentar `metadata.documentos_storage`) |
| R5 | `focus-emissao` aceita `nfse` mas sem caminho real | Remover/ignorar o ramo `nfse` da Focus ao plugar o novo motor, para evitar emissão "meio pronta" |
| R6 | `xmlImportService` não faz upload | Se o novo fluxo importar XML de NFS-e, decidir se grava Storage (padrão §4) ou só registro |

---

## 6. Inventário de Arquivos

### Banco (`supabase/migrations/`)
- `20260602099998_central_fiscal_fundacao.sql` — `fiscal_nfse/ctes/mdes`, `fiscal_events`, `fiscal_logs`, RLS, triggers
- `20260602100000_configuracoes_fiscais.sql` — emitentes + colunas Focus/certificado
- `20260602100001_regras_fiscais_nfse.sql` — regras municipais NFS-e
- `20260602100004_regras_fiscais_cte.sql` — CFOP/ICMS CT-e
- `20260602100005_certificados_fiscais.sql` — bucket `certificados-fiscais`
- `20260602100006_fiscal_documentos_vinculados.sql` — tabela + bucket `fiscal-documentos`
- `20260531_fiscal_historico_status.sql` — histórico de status
- `20260801000001_e3_fiscal_policies_cleanup.sql` — RLS SELECT-only + guard tenant
- `202605200001_configuracoes_sistema.sql` / `202605200003_documentos_bucket.sql` — atenção RLS/bucket

### Edge Functions (`supabase/functions/`)
- `focus-emissao/` (`index.ts`, `mapper.ts`) — **ponto de dispatcher**
- `focus-consulta/`, `focus-documentos/`, `fiscal-documento-url/`, `fiscal-email-documentos/`

### Frontend (`src/`)
- `pages/Fiscal.tsx`
- `components/fiscal/`: `NfseTab.tsx`, `FocusNfeConfig.tsx`, `EmitenteFiscalConfig.tsx`, `AuditoriaFiscal.tsx`, `RegrasFiscaisNfse.tsx`, `RegrasFiscaisCte.tsx`, `DocumentosTab.tsx`, `cte/`, `mdfe/`, `FiscalDashboard`
- `services/fiscal/`: `focusService.ts`, `nfseService.ts`, `configuracoesFiscaisService.ts`, `regrasFiscaisNfseService.ts`, `xmlImportService.ts`, `fiscalStatusService.ts`, `ibgeService.ts`, `cteService.ts`, `cteLoteService.ts`, `mdfeService.ts`, `romaneioCalvoService.ts`, `rateioFreteCteService.ts`
- `services/storage/storageRefService.ts`
- `types/fiscal.ts`
- `utils/pdfPreviaCteSemValorFiscal.ts`

---

## 7. Próximos Passos Sugeridos (não executados — fora do escopo desta auditoria)

1. ~~Confirmar RLS final de `fiscal_nfse` (leitura de `20260801000001` linhas 1–59).~~ **CONCLUÍDO** — ver R2 (§5.4): RLS final confirmado, sem escrita aberta a anon.
2. Definir contrato da nova Edge Function NFS-e (espelho do `focus-emissao`, sem mapper Focus).
3. Projetar `nfseEmissaoService.ts` + troca do guard em `NfseTab.tsx:349`.
4. Definir chave de payload neutra (`metadata.payload_nfse`) e compatibilidade de leitura na auditoria.
5. Corrigir `sup` → `supabase` em `NfseTab.tsx:62` na hora da implementação.
6. Validação com a regra `regras_fiscais_nfse` + IBGE para o Padrão Nacional (campos obrigatórios do SEFIN).
