# AUDITORIA FINAL HOMOLOGAÇÃO CT-e CALVO — P12

**Data:** 06/06/2026  
**Ambiente:** Homologação Focus NFe  
**Cliente:** Calvo Cesta / Calvo Atacadista (CNPJ: 00.640.071/0001-59)  
**Responsável:** Diego Balbino  

---

## 1. IDENTIFICAÇÃO DO LOTE AUDITADO

| Campo | Valor |
|-------|-------|
| Lote ID | (preencher com lote_id real gerado na P4) |
| Cliente | Calvo |
| Quantidade CT-es | (preencher após geração) |
| Valor total | (preencher após rateio) |
| Ambiente | homologacao |
| Data auditoria | 06/06/2026 |

---

## 2. DADOS FOCUS

| Item | Status | Evidência |
|------|--------|-----------|
| Ambiente confirmado | OK | FOCUS_AMBIENTE=homologacao |
| Produção bloqueada | OK | `\|\|` nas 4 Edge Functions (emissao, consulta, documentos, documento-url) |
| Token NÃO exposto no frontend | OK | `grep -R "FOCUS_TOKEN" src/` = 0 resultados |
| VITE_FOCUS_TOKEN ausente | OK | `grep -R "VITE_FOCUS_TOKEN" src/` = 0 resultados |
| Token produção NUNCA usado | OK | Apenas verificação `!!tokenProducao` no ping |
| Edge Functions ativas | OK | focus-emissao, focus-consulta, focus-documentos, fiscal-documento-url |

---

## 3. EVIDÊNCIAS DE SEGURANÇA

### 3.1 Busca por VITE_FOCUS_TOKEN
```
Select-String -Path "src/**" -Pattern "VITE_FOCUS_TOKEN"
→ 0 resultados
```

### 3.2 Busca por FOCUS_TOKEN no frontend
```
Select-String -Path "src/**" -Pattern "FOCUS_TOKEN"
→ 0 resultados
```

### 3.3 Busca por localStorage no módulo fiscal
```
Select-String -Path "src/components/fiscal/**","src/services/fiscal/**" -Pattern "localStorage"
→ 0 resultados
```
Nota: `Fiscal.tsx` possui localStorage apenas em `MOCK_MODE` (dev + flag explícita), nunca em produção.

### 3.4 Busca por Authorization no frontend fiscal
```
Select-String -Path "src/components/fiscal/**","src/services/fiscal/**" -Pattern "Authorization"
→ 0 resultados
```

### 3.5 Token produção nas Edge Functions
```
focus-emissao/index.ts: apenas !!tokenProducao no ping (booleano, nunca usado em chamadas)
focus-consulta/index.ts: 0 referências a FOCUS_TOKEN_PRODUCAO
focus-documentos/index.ts: 0 referências a FOCUS_TOKEN_PRODUCAO
fiscal-documento-url/index.ts: 0 referências a FOCUS_TOKEN_PRODUCAO
```

---

## 4. AUDITORIA DO LOTE CALVO

### 4.1 Checklist por CT-e

Cada CT-e do lote deve ser verificado:

- [ ] Todos pertencem ao mesmo `lote_id`
- [ ] Cliente = Calvo
- [ ] NF-e vinculada (`documentos_vinculados`)
- [ ] Chave NF-e presente
- [ ] `metadata.payload_focus` existe
- [ ] `metadata.pronto_para_emissao = true` (se rascunho)
- [ ] `metadata.endereco_real_entrega_usado` existe
- [ ] `metadata.pendente_conferencia_endereco !== true`
- [ ] Valor rateado soma = valor total da rota
- [ ] Ajuste de centavos no último CT-e

---

## 5. AUDITORIA XML × ROMANEIO × CT-e

### Caso 1: NF-e 2301029

| Fonte | Endereço |
|-------|----------|
| XML (fiscal) | AVENIDA MOINHO FABRINI, 385, São Bernardo do Campo/SP |
| Romaneio (real) | RUA AGUA DOCE, 69, JD SAO DOMINGOS, São Bernardo do Campo/SP |
| metadata.endereco_real_entrega | (verificar) |
| Destino da prestação | (verificar) |
| Observação CT-e | (verificar) |

### Caso 2: NF-e 2300909

| Fonte | Endereço |
|-------|----------|
| XML (fiscal) | Guarulhos/SP |
| Romaneio (real) | AVENIDA MONTEIRO LOBATO, 5624, São Paulo/SP |
| metadata.endereco_real_entrega | (verificar) |
| Destino da prestação | (verificar) |
| Observação CT-e | (verificar) |

---

## 6. AUDITORIA PAYLOAD FOCUS

Para 1 CT-e do lote, validar `metadata.payload_focus`:

- [ ] natureza_operacao = prestação de serviço de transporte
- [ ] modal = 01 (rodoviário)
- [ ] tipo_servico = 0 (normal)
- [ ] tomador = remetente (cliente Calvo)
- [ ] CFOP = 5353 (intermunicipal SP)
- [ ] origem = Guarulhos/SP
- [ ] destino = município/UF do endereço real
- [ ] documento originário = NF-e vinculada
- [ ] valor = rateado corretamente
- [ ] observacao = endereço real de entrega
- [ ] carga.descricao = produto predominante

---

## 7. AUDITORIA ENVIO / CONSULTA / DOWNLOAD

- [ ] Envio: CT-es aptos → status processando/rejeitado
- [ ] Consulta: processando → autorizado/rejeitado
- [ ] Download: autorizados → XML/DACTE no Storage
- [ ] Rejeitados: motivo visível, não mascarado

---

## 8. AUDITORIA SUPABASE STORAGE

- [ ] Bucket `fiscal-documentos` é privado (`public: false`)
- [ ] `metadata.documentos_storage.xml.storage_path` existe
- [ ] `metadata.documentos_storage.dacte.storage_path` existe
- [ ] `xml_url`/`pdf_url` = null (não são signed URLs expiradas)
- [ ] "Abrir XML" gera signed URL sob demanda (fiscal-documento-url)
- [ ] "Abrir DACTE" gera signed URL sob demanda
- [ ] signed URL não fica salva como definitiva

---

## 9. AUDITORIA fiscal_events

Eventos esperados por CT-e:

| Evento | Origem | Status |
|--------|--------|--------|
| CRIACAO_RASCUNHO_LOTE | P4 - cteLoteService | (verificar) |
| ENVIO_FOCUS_HOMOLOGACAO | P5 - focus-emissao | (verificar) |
| CTE_AUTORIZADO_FOCUS | P6 - focus-consulta | (verificar) |
| XML_CTE_SALVO_STORAGE | P8 - focus-documentos | (verificar) |
| DACTE_CTE_SALVO_STORAGE | P8 - focus-documentos | (verificar) |
| DOCUMENTOS_CTE_SALVOS_STORAGE | P8 - focus-documentos | (verificar) |

---

## 10. AUDITORIA fiscal_logs

Logs esperados:

| Log | Ação | Status |
|-----|------|--------|
| GERAR_RASCUNHO_LOTE | P4 - cteLoteService | (verificar) |
| focus_cte_request | P5 - focus-emissao | (verificar) |
| focus_cte_accepted | P5 - focus-emissao | (verificar) |
| focus_cte_consulta_request | P6 - focus-consulta | (verificar) |
| focus_cte_consulta_autorizado | P6 - focus-consulta | (verificar) |
| focus_documentos_request | P8 - focus-documentos | (verificar) |
| focus_xml_download_success | P8 - focus-documentos | (verificar) |
| focus_dacte_download_success | P8 - focus-documentos | (verificar) |
| fiscal_documento_signed_url | P9 - fiscal-documento-url | (verificar) |

Validação crítica:
- [ ] NENHUM token nos logs
- [ ] NENHUMA service role key nos logs
- [ ] NENHUMA signed URL permanente nos logs

---

## 11. RESULTADO DO PAINEL EXECUTIVO (P11)

- [ ] Total CT-es real (não mock)
- [ ] Contagem por status real
- [ ] Lotes reais
- [ ] Pendências reais
- [ ] Checklist coerente
- [ ] Produção NÃO marcada como liberada indevidamente
- [ ] Bloqueios aparecem corretamente

---

## 12. RESULTADO FINAL

| Status | Descrição |
|--------|-----------|
| ( ) Aprovado em homologação | Todos os itens OK |
| ( ) Aprovado com ressalvas | Pendências menores documentadas |
| ( ) Reprovado | Bloqueios críticos |

---

## 13. PLANO CONTROLADO PARA PRODUÇÃO

### 13.1 O que já está pronto
- Fluxo Calvo completo: XML → romaneio → endereço real → rateio → lote
- Envio individual e em lote para Focus
- Consulta de status
- Download XML/DACTE com Storage privado
- Signed URL sob demanda
- Painéis de diagnóstico e assistente por lote
- Checklist de prontidão

### 13.2 O que ainda bloqueia produção
(preencher após auditoria do checklist P11)

### 13.3 O que exige validação do contador/fiscal
- CFOP 5353
- CST/ICMS
- Tomador (remetente)
- Origem/destino
- Série e numeração CT-e
- Observações fiscais
- Regime tributário

### 13.4 O que exige validação com Focus/SEFAZ
- Empresa ativa em produção na Focus
- Certificado A1 válido
- Token produção válido
- Série CT-e produção correta
- Próximo número correto

### 13.5 Checklist antes de trocar ambiente
- [ ] Contador/fiscal aprovou
- [ ] Focus/SEFAZ validado
- [ ] Certificado válido
- [ ] Token produção configurado (apenas nos Secrets)
- [ ] Primeiro CT-e produção selecionado (individual, baixo risco)
- [ ] Plano de rollback documentado

### 13.6 Plano de rollback
1. Reverter FOCUS_AMBIENTE para homologacao
2. Nenhum dado de produção foi alterado
3. Logs de produção preservados para auditoria

### 13.7 Regras para primeira emissão em produção
1. **NUNCA lote** — sempre individual
2. CT-e de baixo risco e já validado em homologação
3. Enviar → consultar → baixar XML/DACTE imediatamente
4. Conferir no portal Focus/SEFAZ
5. Validar com contador

### 13.8 Ativação futura (NÃO executar agora)
```
# Somente quando autorizado:
1. Alterar Supabase Secret: FOCUS_AMBIENTE=producao
2. Confirmar FOCUS_TOKEN_PRODUCAO configurado
3. Emitir 1 CT-e individual
4. Consultar e baixar documentos
5. Validar com contador
6. Só depois liberar lote em produção
```

---

## 14. PRÓXIMA ETAPA (P13)

**Correções finais + primeira emissão produção controlada**
- Somente se P12 aprovar
- Somente com autorização explícita do responsável fiscal/contador
- NÃO executar automaticamente
