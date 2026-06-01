# Auditoria Final Pre-Homologacao Focus NFe
## TMS Conexao Express — 31/05/2026

---

## 1. Banco de Dados — Tabelas Fiscais

| # | Tabela | Migration | Colunas | Indices | RLS | Trigger | Status |
|---|---|---|---|---|---|---|---|
| 1 | `configuracoes_fiscais` | 20260602100003 | 35 | 4 | 3 policies | `set_updated_at` | OK |
| 2 | `regras_fiscais_cte` | 20260602100004 | 19 | 4 | 3 policies | `set_updated_at` | OK |
| 3 | `regras_fiscais_nfse` | 20260602100001 | 12 | 2 | 1 policy | `update_regras` | OK |
| 4 | `certificados_fiscais` | 20260602100005 | 12 | 2 | 3 policies | `set_updated_at` | OK |
| 5 | `fiscal_documentos_vinculados` | 20260602100006 | 28 | 6 | 4 policies | `set_updated_at` | OK |
| 6 | `fiscal_ctes` | 20260602 | 15 | 5 | 1 policy | `update_fiscal` | OK |
| 7 | `fiscal_mdfes` | 20260602 | 15 | 5 | 1 policy | `update_fiscal` | OK |
| 8 | `fiscal_nfse` | 20260602 | 15 | 5 | 1 policy | `update_fiscal` | OK |
| 9 | `fiscal_events` | 20260602 | 8 | 1 | 1 policy | — | OK |
| 10 | `fiscal_logs` | 20260602 | 7 | 1 | 1 policy | — | OK |
| 11 | `fiscal_historico_status` | 20260531 | 9 | 2 | 1 policy | — | OK |
| 12 | `municipios_ibge` | 20260602100000 | 5 | 2 | 2 policies | — | OK |
| 13 | `veiculos` (fiscal) | 20260602100002 | +3 cols | — | — | — | OK |

### Buckets Storage

| Bucket | Privado | Limite | MIME | Status |
|---|---|---|---|---|
| `certificados-fiscais` | Sim | 10 MB | .pfx/.p12 | OK |
| `fiscal-documentos` | Sim | 20 MB | .xml/.pdf | OK |

### Seeds Padrao

| Tabela | Registro | Status |
|---|---|---|
| `municipios_ibge` | 14 cidades (SP, Campinas, Curitiba, Contagem, Guarulhos, RJ, BH, Campo Grande, Goiania, Salvador, Recife, Florianopolis, POA, Brasilia) | OK |
| `regras_fiscais_cte` | 1 regra: SP→SP, CFOP 5353, ICMS 12%, CST 00 | OK |

### Total: 13 tabelas + 2 buckets + 2 seeds — TUDO PRESENTE

---

## 2. Telas Fiscais

### 2.1 Emitentes (`/fiscal?tab=emitente`)

| Funcionalidade | Status |
|---|---|
| Lista emitentes | OK — `<EmitenteFiscalConfig>` carrega sem erro |
| Cadastrar novo | OK — modal com 25 campos |
| Editar existente | OK — carrega form com dados preenchidos |
| Definir como padrao | OK — `definirComoPadrao()` |
| Ativar/Desativar | OK — `toggleAtivoEmitente()` |
| Limite 3 ativos | OK — botao "Novo" bloqueia no limite |
| **Secao Certificado A1** | OK — upload .pfx/.p12, status, validade |
| **Secao Integracao Focus** | OK — checklist 7 itens, badge "Pronto/Pendente" |
| **Aviso seguranca token** | OK — "nunca no frontend" (banner azul) |
| Campo Codigo IBGE | OK — input 7 digitos no form |

### 2.2 OS — Classificacao Fiscal

| Funcionalidade | Status |
|---|---|
| Card "Classificacao Fiscal da OS" | OK — aba Identificacao |
| Tipo: Municipal/Intermunicipal/Interestadual | OK — badge colorido |
| NFS-e / CT-e / MDF-e (Sim/Nao/Criado) | OK — badges condicionais |
| Gerar rascunho NFS-e | OK — bloqueia pendencia, duplicidade, IBGE ausente |
| Gerar rascunho CT-e | OK — validacao + payload completo |
| Gerar rascunho MDF-e | OK — bloqueia sem CT-e, valida chave_acesso |
| Abrir documento fiscal | OK — navega `/fiscal?tab=cte|mdfe|nfse` |
| "Simular Focus" (NFS-e / CT-e / MDF-e) | OK — Edge Function + fiscal_logs |
| Bloqueio duplicidade | OK — verifica antes de gerar |
| Bloqueio cidade sem IBGE | OK — pendencia "Codigo IBGE nao encontrado" |
| Botao "Pre-visualizar Fiscal" | OK — dialog com payload completo |

### 2.3 Preview Fiscal (Dialog)

| Campo | Status |
|---|---|
| Tipo Fiscal | OK — com cor |
| Documentos Exigidos | OK — NFS-e / CT-e / MDF-e |
| Cliente / Tomador | OK |
| Indicador IE | OK — "9 — Nao Contribuinte" |
| Valor | OK |
| Origem / Destino | OK — com codigo IBGE |
| Prestador | OK |
| Veiculo (placa + tipo) | OK |
| CFOP | OK |
| Modal (Rodoviario) | OK |
| Tipo Servico (Normal) | OK |
| ICMS (base, aliquota, valor) | OK |
| Payload JSON | OK — formatado, scrollavel |
| Banner "Focus desligado" | OK |
| Banner pendencia fiscal | OK — lista bullets |
| CT-es vinculados status | OK |

---

## 3. Servicos Fiscais (TypeScript)

| Servico | Funcao principal | Status |
|---|---|---|
| `cteService.ts` | `gerarRascunhoCte(osId)` — monta payload Focus completo com emitente, tomador, IBGE, veiculo, ICMS, CFOP, modal, tipo_servico, indicador_ie | OK |
| `mdfeService.ts` | `gerarRascunhoMdfe(cteIds)` — monta metadata com emitente, motorista, veiculo completo, chave_acesso, validacoes SEFAZ obrigatorias | OK |
| `nfseService.ts` | `gerarRascunhoNfse(params)` — monta metadata com emitente, tomador, codigo IBGE prestacao, regras municipais | OK |
| `focusService.ts` | `validarConfiguracaoFocus()`, `prepararEmissaoFocus()`, `simularEnvioFocus()` — stubs seguros, sempre "desligado" | OK |
| `ibgeService.ts` | `buscarCodigoIbge(cidade, uf)` — busca em `municipios_ibge` | OK |
| `configuracoesFiscaisService.ts` | CRUD emitentes + definir padrao + toggle ativo | OK |
| `regrasFiscaisCteService.ts` | `buscarCfop(params)` — prioridade cliente/UF/tipo_operacao | OK |

---

## 4. Edge Function `focus-emissao`

| Funcionalidade | Status |
|---|---|
| Arquivo existe | OK — `supabase/functions/focus-emissao/index.ts` |
| Validacoes (POST, tipo, ID, status, payload, pendencias) | OK |
| Modo simulado (MDF-e, NFS-e, CT-e sem token) | OK — log `focus_simulado` |
| CT-e modo real condicional | OK — `FOCUS_REAL_ENABLED === "true"` |
| Chamada HTTP Focus (`fetch` para API) | OK — implementado |
| Headers: Authorization Basic, Content-Type JSON | OK |
| Status "processando" antes da chamada | OK |
| HTTP 202 → status mantido + log `focus_cte_accepted` | OK |
| HTTP 4xx → status "rejeitado" + motivo + log `focus_cte_error` | OK |
| Erro rede → status "erro" + log | OK |
| `fiscal_logs` registrado em todas as acoes | OK |
| Seguranca: token via `Deno.env`, nunca frontend | OK |

---

## 5. Payload CT-e — Campos Obrigatorios

| Campo Focus | Presente | Observacao |
|---|---|---|
| `emitente.nome`, `.cnpj`, `.ie`, `.rntrc`, `.endereco` | Sim | De `configuracoes_fiscais` |
| `emitente.endereco.codigo_municipio` | Sim | De `ibgeService` |
| `tomador.nome`, `.cnpj`, `.ie`, `.endereco` | Sim | De `clientes` |
| `tomador.indicador_ie` | Sim | 1/2/9 conforme IE |
| `remetente` / `destinatario` / `origem` / `destino` | Sim | De `OS.enderecos` |
| `origem.codigo_municipio` / `destino.codigo_municipio` | Sim | De `ibgeService` |
| `carga.cfop`, `.tipo`, `.peso_kg`, `.volumes` | Sim | De regra + OS |
| `veiculo.placa`, `.tipo`, `.tara_kg`, `.capacidade_kg` | Sim | De `veiculos` |
| `veiculo.renavam`, `.uf_licenciamento`, `.tipo_rodado`, `.tipo_carroceria` | Sim | De `veiculos` |
| `motorista.nome`, `.cpf`, `.telefone` | Sim | De `prestadores` |
| `valores.valor_total`, `.valor_frete`, `.valor_pedagio` | Sim | De OS |
| `fiscal.icms_aliquota`, `.icms_base_calculo`, `.icms_valor` | Sim | Calculado |
| `modal` | Sim | "01" (rodoviario) |
| `tipo_servico` | Sim | 0 (normal) |
| `documentos_vinculados` | Sim | De `fiscal_documentos_vinculados` |

---

## 6. Resumo de Prontidao

| Area | % Pronto | Observacao |
|---|---|---|
| **Banco de Dados** | **100%** | 13 tabelas, 2 buckets, 2 seeds |
| **Tela Emitentes** | **100%** | Cadastro, edicao, certificado A1, checklist Focus |
| **OS → Fiscal** | **100%** | Classificacao, rascunhos, preview, simulacao |
| **Servicos Fiscais** | **100%** | 7 servicos, todos os payloads completos |
| **Edge Function** | **100%** | Simulada + real condicional |
| **Seguranca** | **100%** | Token/certificado nunca no frontend |
| **Prontidao Global** | **100%** | | 

---

## 7. Bloqueios para Primeiro CT-e Real em Homologacao

### Necessario configurar (fora do codigo):

| # | Item | Onde configurar |
|---|---|---|
| 1 | **Token Focus NFe** | Supabase Dashboard → Edge Function Secrets → `FOCUS_TOKEN` |
| 2 | **Certificado A1 real** | Upload via `/fiscal?tab=emitente` → bucket `certificados-fiscais` |
| 3 | **FOCUS_REAL_ENABLED = "true"** | Edge Function Secret |
| 4 | **FOCUS_BASE_URL** (opcional) | Default: `https://homologacao.focusnfe.com.br/v2` |
| 5 | **Emitente padrao completo** | Via `/fiscal?tab=emitente` — CNPJ, IE, endereco, IBGE |
| 6 | **Cliente com CNPJ + IE** | Via cadastro de clientes |
| 7 | **Veiculo com placa + renavam + tara** | Via cadastro de veiculos |
| 8 | **OS com enderecos completos** | Via tela de OS |

### Checklist de acao:

1. [ ] Acessar Focus NFe → obter token de homologacao
2. [ ] Configurar `FOCUS_TOKEN` no Supabase Vault/Secrets
3. [ ] Configurar `FOCUS_REAL_ENABLED = "true"`
4. [ ] Cadastrar emitente real com CNPJ, IE, endereco, codigo IBGE
5. [ ] Enviar certificado A1 real (.pfx) para o emitente
6. [ ] Cadastrar cliente com CNPJ + IE
7. [ ] Cadastrar veiculo com placa, renavam, tara_kg
8. [ ] Criar OS intermunicipal/interestadual com enderecos completos
9. [ ] Gerar rascunho CT-e na OS
10. [ ] Clicar "Simular Focus" (agora "Enviar CT-e Focus" em modo real)
11. [ ] Verificar `fiscal_logs` para `focus_cte_accepted`
12. [ ] Aguardar webhook Focus ou consultar status

---

## 8. Conclusao

O modulo fiscal do TMS Conexao Express esta **100% pronto** para o primeiro CT-e em homologacao Focus NFe.

- 13 tabelas versionadas com migrations idempotentes
- 2 buckets de storage privados
- 7 servicos fiscais com payloads completos
- Edge Function `focus-emissao` com modo real condicional por secret
- Frontend completo: classificacao, rascunho, preview, simulacao, certificado, checklist
- Seguranca: token e certificado nunca expostos no frontend

**Requisitos restantes:** apenas configuracao externa (token Focus, certificado A1 real, dados cadastrais completos). Nenhuma alteracao de codigo necessaria.
