# EXECUÇÃO DA PRIMEIRA EMISSÃO CT-e PRODUÇÃO INDIVIDUAL — P13B-EXEC

**Data:** (preencher no momento da emissão)
**Hora:** (preencher)
**Ambiente:** Produção Focus NFe
**Cliente:** Calvo Cesta / Calvo Atacadista (CNPJ: 00.640.071/0001-59)
**Responsável:** (preencher)

---

## ⚠️ AVISO CRÍTICO

Esta operação gera **documento fiscal real**. Cada passo deve ser executado com atenção.

---

## PASSO 1 — CONFIRMAR AUTORIZAÇÕES EXTERNAS

Antes de qualquer ação técnica, confirmar verbalmente/por escrito:

| Item | Quem | Confirmado? |
|------|------|-------------|
| CFOP 5353 aprovado | Contador | ( ) |
| CST/ICMS aprovado | Contador | ( ) |
| Tomador = Remetente aprovado | Contador | ( ) |
| Origem/Destino aprovado | Contador | ( ) |
| Endereço real na observação aprovado | Contador | ( ) |
| Empresa ativa em produção | Focus | ( ) |
| Certificado A1 válido | IT/Fiscal | ( ) |
| Série CT-e produção correta | Focus | ( ) |
| Próximo número CT-e correto | Focus | ( ) |
| Autorização explícita do responsável | Gestor | ( ) |

**Se QUALQUER item estiver em branco → PARAR.**

---

## PASSO 2 — CONFERIR SECRETS (sem expor valores)

No Supabase Dashboard → Edge Functions → Secrets:

| Secret | Deve estar | Conferido? |
|--------|-----------|-------------|
| `FOCUS_REAL_ENABLED` | `true` | ( ) |
| `FOCUS_AMBIENTE` | `producao` | ( ) |
| `FOCUS_PRODUCAO_LIBERADA` | `true` | ( ) |
| `FOCUS_TOKEN_PRODUCAO` | Existe | ( ) |
| `FOCUS_TOKEN` | Existe (backup) | ( ) |

⚠️ Não copiar/colar/imprimir os tokens em lugar nenhum.

---

## PASSO 3 — SELECIONAR CT-e CANDIDATO

Abrir `/fiscal?tab=cte` e escolher 1 CT-e Calvo.

| Campo | Valor |
|-------|-------|
| CT-e ID | |
| Número interno | |
| Lote ID | |
| Cliente | Calvo |
| Valor | |
| Chave NF-e | |
| Origem | Guarulhos/SP |
| Destino | |
| Status | rascunho |

Checklist por CT-e:
- [ ] `status` = rascunho
- [ ] `metadata.pronto_para_emissao` = true
- [ ] `metadata.pendente_conferencia_endereco` ≠ true
- [ ] `metadata.payload_focus` existe
- [ ] `documentos_vinculados.length` > 0
- [ ] Observação contém endereço real
- [ ] Destino da prestação = município/UF do endereço real

---

## PASSO 4 — VERIFICAÇÕES DE SEGURANÇA (pré-emissão)

| Verificação | OK? |
|-------------|-----|
| Botão "Emitir em Producao (Individual)" visível | ( ) |
| Botão de lote produção NÃO existe | ( ) |
| Console do navegador aberto (F12) → Network | ( ) |
| Nenhum token visível no código-fonte | ( ) |
| TypeScript: `npx tsc --noEmit` → sem erros | ( ) |
| Build: `npm run build` → OK | ( ) |

---

## PASSO 5 — EMITIR CT-e PRODUÇÃO

1. Abrir CT-e candidato no drawer
2. Clicar **"Emitir em Producao (Individual)"** (botão vermelho)
3. No modal, digitar exatamente: **`EMITIR PRODUCAO`**
4. Clicar **"Emitir CT-e Producao"**

### Resultado

| Campo | Valor |
|-------|-------|
| Horário | |
| Status retornado | |
| Protocolo | |
| Mensagem | |
| Erro (se houver) | |

---

## PASSO 6 — CONSULTAR STATUS PRODUÇÃO

Se o CT-e ficou como `processando`:

1. Clicar **"Consultar Status Focus"**
2. Aguardar retorno da Focus

### Resultado

| Campo | Valor |
|-------|-------|
| Status SEFAZ | |
| Chave de acesso | |
| Protocolo final | |
| Motivo rejeição (se houver) | |

---

## PASSO 7 — BAIXAR XML/DACTE (se autorizado)

Se status = autorizado:

1. Clicar na aba **XML/DACTE**
2. Clicar **"Baixar XML/DACTE"**
3. Conferir que foram salvos no Storage

### Resultado

| Documento | Storage Path | Tamanho | Abriu? |
|-----------|-------------|---------|--------|
| XML | `cte/producao/{ano}/{mes}/{id}/xml-{chave}.xml` | | ( ) |
| DACTE | `cte/producao/{ano}/{mes}/{id}/dacte-{chave}.pdf` | | ( ) |

---

## PASSO 8 — VALIDAR LOGS E EVENTOS

No drawer do CT-e, aba Logs:

- [ ] `focus_cte_producao_request`
- [ ] `focus_cte_producao_accepted` ou `focus_cte_producao_error`
- [ ] `focus_xml_download_success` (se XML baixado)
- [ ] `focus_dacte_download_success` (se DACTE baixado)

Validar:
- [ ] Nenhum token nos logs
- [ ] Nenhuma signed URL permanente

---

## PASSO 9 — CONFERIR NO PORTAL FOCUS

Abrir painel Focus NFe (produção):

| Verificação | OK? |
|-------------|-----|
| CT-e aparece na lista | ( ) |
| Número/série corretos | ( ) |
| Status = autorizado | ( ) |
| Chave de acesso confere com TMS | ( ) |
| Protocolo confere com TMS | ( ) |
| XML disponível para download | ( ) |
| DACTE disponível para download | ( ) |

---

## PASSO 10 — DECISÃO PÓS-EMISSÃO

Marcar UMA opção:

### ( ) PRODUÇÃO AUTORIZADA COM SUCESSO
- CT-e autorizado
- XML/DACTE salvos
- Próxima etapa: **P14** — segunda emissão + monitoramento

### ( ) PRODUÇÃO REJEITADA — BLOQUEAR
- Motivo da rejeição: _____________
- Próxima etapa: **P13C** — correção fiscal
- Alterar Secrets: `FOCUS_PRODUCAO_LIBERADA=false`

### ( ) ERRO TÉCNICO — ROLLBACK
- Erro: _____________
- Próxima etapa: **P13D** — rollback + correção técnica
- Alterar Secrets: `FOCUS_AMBIENTE=homologacao`, `FOCUS_PRODUCAO_LIBERADA=false`

---

## PLANO DE ROLLBACK (se necessário)

```
1. Supabase Secrets:
   FOCUS_AMBIENTE = homologacao
   FOCUS_PRODUCAO_LIBERADA = false

2. NÃO tentar nova emissão sem análise da causa raiz

3. Emissões já realizadas são válidas (documentos fiscais reais)

4. Validar com contador/fiscal antes de qualquer correção
```

---

## RESULTADO FINAL

| Decisão | |
|---------|-|
| Data/Hora | |
| Responsável | |
| Assinatura | |
