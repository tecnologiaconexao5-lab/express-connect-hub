# PRIMEIRA EMISSÃO PRODUÇÃO CONTROLADA CT-e — P13B

**Data:** (a preencher no momento da emissão)
**Ambiente:** Produção Focus NFe
**Cliente:** Calvo Cesta / Calvo Atacadista (CNPJ: 00.640.071/0001-59)
**Responsável:** (a preencher)

---

## 1. AUTORIZAÇÕES OBRIGATÓRIAS (ANTES DA EMISSÃO)

| Autorização | Status | Data | Responsável |
|-------------|--------|------|-------------|
| Contador aprovou CFOP 5353 | ( ) | | |
| Contador aprovou CST/ICMS | ( ) | | |
| Contador aprovou tomador | ( ) | | |
| Contador aprovou origem/destino | ( ) | | |
| Focus confirmou série produção | ( ) | | |
| Focus confirmou numeração | ( ) | | |
| Certificado A1 válido | ( ) | | |
| Responsável autorizou por escrito | ( ) | | |

**Se qualquer item acima não estiver confirmado, PARAR e NÃO emitir.**

---

## 2. CT-e CANDIDATO

| Campo | Valor |
|-------|-------|
| CT-e ID | (preencher) |
| NF-e vinculada | (preencher) |
| Chave NF-e | (preencher) |
| Endereço real entrega | (preencher) |
| Destino prestação | (preencher) |
| Valor CT-e | (preencher) |
| CFOP | 5353 |
| Status | rascunho / pronto_para_emissao |

---

## 3. CHECKLIST PRÉ-EMISSÃO

- [ ] CT-e status = rascunho
- [ ] metadata.pronto_para_emissao = true
- [ ] metadata.pendente_conferencia_endereco !== true
- [ ] metadata.payload_focus existe
- [ ] NF-e vinculada (documentos_vinculados.length > 0)
- [ ] Chave NF-e presente
- [ ] Endereço real de entrega validado
- [ ] CFOP/CST/tomador aprovados pelo contador
- [ ] Série/numeração confirmadas na Focus
- [ ] Token produção configurado (nunca exposto)
- [ ] FOCUS_PRODUCAO_LIBERADA = true (alterado manualmente)
- [ ] FOCUS_AMBIENTE = producao (alterado manualmente)

---

## 4. PROCEDIMENTO DE ATIVAÇÃO

### 4.1 Alterar Supabase Secrets (manual)

```
FOCUS_AMBIENTE = producao
FOCUS_PRODUCAO_LIBERADA = true
```

### 4.2 Confirmar antes de emitir

- Abrir `/fiscal?tab=cte`
- Selecionar CT-e candidato
- Clicar "Emitir em Producao (Individual)"
- Digitar `EMITIR PRODUCAO`
- Confirmar

---

## 5. RESULTADO DO ENVIO

| Campo | Valor |
|-------|-------|
| Horário | (preencher) |
| Status retornado | (processando / rejeitado / erro) |
| Protocolo | (preencher) |
| Chave acesso | (preencher) |
| Mensagem Focus | (preencher) |
| Erro (se houver) | (preencher) |
| Token exposto? | NÃO |

---

## 6. RESULTADO DA CONSULTA

| Campo | Valor |
|-------|-------|
| Horário | (preencher) |
| Status SEFAZ | (autorizado / rejeitado / processando) |
| Chave acesso final | (preencher) |
| Protocolo final | (preencher) |
| Motivo rejeição | (preencher se rejeitado) |

---

## 7. XML/DACTE PRODUÇÃO

| Documento | Salvo? | Storage Path | Tamanho |
|-----------|--------|-------------|---------|
| XML | ( ) | cte/producao/... | |
| DACTE | ( ) | cte/producao/... | |
| Signed URL funciona? | ( ) | | |

---

## 8. EVENTOS CRIADOS (PRODUÇÃO)

- [ ] ENVIO_FOCUS_PRODUCAO
- [ ] CTE_AUTORIZADO_FOCUS_PRODUCAO / CTE_REJEITADO_FOCUS_PRODUCAO
- [ ] DOCUMENTOS_CTE_PRODUCAO_SALVOS_STORAGE (se documentos baixados)

---

## 9. LOGS CRIADOS (PRODUÇÃO)

- [ ] focus_cte_producao_request
- [ ] focus_cte_producao_accepted / error
- [ ] focus_cte_producao_consulta
- [ ] focus_documentos_producao_storage

---

## 10. DECISÃO FINAL PÓS-EMISSÃO

| Decisão | Marcar |
|---------|--------|
| Manter produção bloqueada (FOCUS_PRODUCAO_LIBERADA=false) | ( ) |
| Liberar nova emissão individual | ( ) |
| Liberar lote futuramente | ( ) |

**Justificativa:** (preencher)

---

## 11. PLANO DE ROLLBACK

Se necessário reverter:
1. `FOCUS_AMBIENTE = homologacao`
2. `FOCUS_PRODUCAO_LIBERADA = false`
3. Emissões de produção já realizadas são documentos fiscais válidos
4. Analisar erro antes de nova tentativa
5. Validar com contador/fiscal

---

## 12. PRÓXIMA ETAPA

- Se autorizado: P14 — Segunda emissão produção + liberação gradual
- Se rejeitado: P13C — Correção fiscal da rejeição
- Se erro técnico: P13D — Rollback e correção
