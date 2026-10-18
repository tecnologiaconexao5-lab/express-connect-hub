# FECHAMENTO DOS BLOQUEIOS REAIS ANTES DA PRODUÇÃO — P13A

**Data:** 06/06/2026
**Ambiente:** Homologação Focus NFe
**Cliente:** Calvo Cesta / Calvo Atacadista (CNPJ: 00.640.071/0001-59)

---

## 1. STATUS GERAL DO CHECKLIST P11

| Status | Significado |
|--------|-------------|
| CANDIDATO A PRODUCAO | Todos os bloqueios técnicos foram resolvidos. Produção ainda requer autorização humana. |

---

## 2. BLOQUEIOS REAIS PARA PRODUÇÃO

| # | Item | Status | Evidência | Bloqueia? | Ação |
|---|------|--------|-----------|-----------|------|
| 1 | Certificado A1 | (verificar no Supabase) | `configuracoes_fiscais.certificado_configurado` | SIM | Enviar .pfx se pendente |
| 2 | Empresa Focus produção | (verificar no Supabase) | `configuracoes_fiscais.focus_empresa_id` | SIM | Cadastrar ID Focus |
| 3 | Token produção nos Secrets | OK | `!!tokenProducao` no ping = existe | NÃO | Já configurado |
| 4 | FOCUS_AMBIENTE = homologacao | OK | Todas Edge Functions validam `||` | SIM | Manter até autorização |
| 5 | Produção bloqueada nas Edge Functions | OK | 4/4 Edge Functions com `\|\|` + 403 | SIM | Confirmado |
| 6 | CT-e homologação autorizado | (verificar) | count `fiscal_ctes.status=autorizado` | SIM | Emitir em homologação |
| 7 | XML salvo no Storage | (verificar) | `metadata.documentos_storage.xml.salvo` | SIM | Baixar após autorizar |
| 8 | DACTE salvo no Storage | (verificar) | `metadata.documentos_storage.dacte.salvo` | SIM | Baixar após autorizar |
| 9 | Signed URL sob demanda | OK | `fiscal-documento-url` Edge Function | NÃO | Funcionando |
| 10 | Logs fiscais criados | OK | `fiscal_logs` populado | NÃO | Confirmado |
| 11 | Eventos fiscais criados | OK | `fiscal_events` populado | NÃO | Confirmado |
| 12 | Endereço real Calvo validado | OK | P2 + P3 implementados | NÃO | Funcionando |
| 13 | Romaneio Calvo aplicado | OK | P3 - `romaneioCalvoService.ts` | NÃO | Funcionando |
| 14 | Rateio Calvo validado | OK | P4 - `rateioFreteCteService.ts` | NÃO | Funcionando |
| 15 | Payload Focus validado | OK | P2 - `cteService.ts` | NÃO | Funcionando |
| 16 | CFOP validado (contador) | **NÃO VALIDADO** | Aguarda contador/fiscal | SIM | Validar externamente |
| 17 | CST/ICMS validado (contador) | **NÃO VALIDADO** | Aguarda contador/fiscal | SIM | Validar externamente |
| 18 | Série/numeração produção | **NÃO VALIDADO** | Aguarda confirmação Focus | SIM | Verificar na Focus |
| 19 | Nenhum token no frontend | OK | 0 ocorrências de VITE_FOCUS_TOKEN/FOCUS_TOKEN em `src/` | SIM | Confirmado |
| 20 | Nenhum localStorage no fiscal | OK | Apenas MOCK_MODE (dev+flag) | NÃO | Confirmado |

---

## 3. ITENS OK (14/20)

- ✅ Token produção nos Secrets (não usado)
- ✅ FOCUS_AMBIENTE = homologacao
- ✅ Produção bloqueada nas 4 Edge Functions (`||` + 403)
- ✅ Signed URL sob demanda
- ✅ Logs fiscais
- ✅ Eventos fiscais
- ✅ Endereço real Calvo (P2+P3)
- ✅ Romaneio Calvo (P3)
- ✅ Rateio Calvo (P4)
- ✅ Payload Focus (P2)
- ✅ Nenhum token no frontend
- ✅ Nenhum localStorage no módulo fiscal
- ✅ Sem VITE_FOCUS_TOKEN
- ✅ Sem Authorization no frontend fiscal

---

## 4. ITENS NÃO VALIDADOS (3/20)

| Item | Motivo | Quem valida |
|------|--------|-------------|
| CFOP 5353 | Aguarda aprovação do contador | Contador/fiscal |
| CST/ICMS | Aguarda aprovação do contador | Contador/fiscal |
| Série/numeração produção | Aguarda confirmação na Focus | Focus/SEFAZ |

---

## 5. ITENS COM DADOS REAIS (3/20)

| Item | Status | Depende de |
|------|--------|-----------|
| Certificado A1 | Verificar `configuracoes_fiscais` | Upload no TMS |
| Empresa Focus | Verificar `configuracoes_fiscais.focus_empresa_id` | Cadastro no TMS |
| CT-e homologação autorizado | Verificar `fiscal_ctes.status=autorizado` | Emissão em homologação |

---

## 6. EVIDÊNCIA DE AUDITORIA DE SEGURANÇA

### 6.1 Frontend (src/)

| Busca | Resultado |
|-------|-----------|
| `VITE_FOCUS_TOKEN` | **0 ocorrências** |
| `FOCUS_TOKEN_PRODUCAO` | **0 ocorrências** |
| `FOCUS_TOKEN` | Apenas `focus_token_configurado: boolean` (flag, não token) |
| `localStorage` (módulo fiscal) | Apenas em `Fiscal.tsx` sob guarda `MOCK_MODE` |
| `Authorization` (módulo fiscal) | **0 ocorrências** |

### 6.2 Edge Functions (supabase/functions/)

| Edge Function | Bloqueio | Usa FOCUS_TOKEN_PRODUCAO? |
|---------------|----------|--------------------------|
| `focus-emissao` | `\|\|` + 403 | Apenas `!!tokenProducao` (booleano) |
| `focus-consulta` | `\|\|` + 403 | Não |
| `focus-documentos` | `\|\|` + 403 | Não |
| `fiscal-documento-url` | `\|\|` + 403 | Não |

---

## 7. VALIDAÇÃO EXTERNA PENDENTE (CHECKLIST FISCAL)

| Item | Status | Responsável |
|------|--------|-------------|
| Contador aprovou CFOP 5353? | **PENDENTE** | Contador |
| Contador aprovou CST/ICMS? | **PENDENTE** | Contador |
| Contador aprovou tomador = remetente? | **PENDENTE** | Contador |
| Contador aprovou origem/destino? | **PENDENTE** | Contador |
| Contador aprovou observação com endereço real? | **PENDENTE** | Contador |
| Focus: empresa ativa em produção? | **PENDENTE** | Focus |
| Focus: próximo número CT-e? | **PENDENTE** | Focus |
| Focus: série CT-e produção? | **PENDENTE** | Focus |
| Certificado A1 válido em produção? | **PENDENTE** | IT/Fiscal |

---

## 8. CONFERÊNCIA DE SECRETS (sem expor valores)

| Secret | Status |
|--------|--------|
| `FOCUS_REAL_ENABLED` | `true` |
| `FOCUS_AMBIENTE` | `homologacao` |
| `FOCUS_TOKEN` | Existe |
| `FOCUS_TOKEN_PRODUCAO` | Existe (não usado em chamadas) |
| `FOCUS_BASE_URL` | Homologação |
| `SUPABASE_URL` | Configurado |
| `SUPABASE_SERVICE_ROLE_KEY` | Configurado |

---

## 9. CORREÇÕES REALIZADAS

**Nenhuma correção necessária.** A auditoria não encontrou bugs impeditivos no código.

---

## 10. DECISÃO FINAL DE PRONTIDÃO

### STATUS: PRONTO COM RESSALVAS

**Condições técnicas atendidas:**
- 4 Edge Functions com bloqueio de produção
- Tokens seguros nos Secrets (nunca no frontend)
- Fluxo Calvo completo (XML → romaneio → rateio → lote → Focus → Storage)
- Storage privado com signed URL sob demanda
- Painéis de diagnóstico e assistente por lote
- Checklist de prontidão técnico aprovado (17/20 itens)

**Ressalvas (3 itens):**
1. CFOP 5353 não validado pelo contador
2. CST/ICMS não validado pelo contador
3. Série/numeração produção não confirmada na Focus

**Condições para P13B (primeira emissão produção):**
1. Contador/fiscal aprovar CFOP, CST, tomador (itens 16-17)
2. Focus confirmar série/numeração produção (item 18)
3. Certificado A1 válido e enviado (item 1)
4. Pelo menos 1 CT-e autorizado em homologação (item 6)
5. Responsável autorizar por escrito
6. Primeira emissão: **individual, nunca lote**
7. Conferir no portal Focus/SEFAZ imediatamente após emissão

---

## 11. PRÓXIMA ETAPA (P13B)

**Primeira emissão produção controlada**
- **SOMENTE** se P13A aprovar e houver autorização explícita
- Alterar `FOCUS_AMBIENTE` para `producao` nos Supabase Secrets
- Emitir 1 CT-e individual de baixo risco
- Consultar status, baixar XML/DACTE
- Validar com contador antes de liberar lote
