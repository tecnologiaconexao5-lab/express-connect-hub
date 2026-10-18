# SIMULAÇÃO REAL CT-e CALVO EM HOMOLOGAÇÃO — P13B-SIM

**Data:** (preencher)
**Ambiente:** Homologação Focus NFe  
**Cliente:** Calvo Cesta / Calvo Atacadista (CNPJ: 00.640.071/0001-59)  
**Responsável:** (preencher)

---

## 1. ARQUIVOS UTILIZADOS

| Arquivo | Nome | Tamanho |
|---------|------|---------|
| XMLs NF-e | | |
| PDF Romaneio | | |
| Critério rateio | | |
| Valor frete rota | | |

---

## 2. XMLs IMPORTADOS

| # | Nº NF-e | Chave | Valor | Destinatário | Cidade/UF XML | Importado? |
|---|---------|-------|-------|-------------|---------------|------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

**Resumo:**
- Total XMLs: 
- Sucesso: 
- Erro: 
- Duplicados: 

---

## 3. ROMANEIO IMPORTADO

| # | NF-e lida | Endereço real | Cidade/UF | Peso | Caixas | Cruzou? |
|---|-----------|---------------|-----------|------|--------|---------|
| 1 | | | | | | |
| 2 | | | | | | |

**Resumo:**
- Total itens lidos: 
- Cruzados com XML: 
- Pendentes: 
- Divergências endereço: 

---

## 4. CRUZAMENTO XML × ROMANEIO (CASOS MANUAIS)

### Caso 1: NF-e ________

| Fonte | Endereço |
|-------|----------|
| XML (fiscal) | |
| Romaneio (real) | |
| metadata.endereco_real_entrega | |
| fonte_endereco_entrega | |
| divergencia_endereco_xml_romaneio | |

### Caso 2: NF-e ________

| Fonte | Endereço |
|-------|----------|
| XML (fiscal) | |
| Romaneio (real) | |
| metadata.endereco_real_entrega | |
| fonte_endereco_entrega | |
| divergencia_endereco_xml_romaneio | |

---

## 5. LOTE CT-e GERADO

| Configuração | Valor |
|-------------|-------|
| Lote ID | |
| Valor total frete | |
| Regra rateio | |
| Total CT-es | |
| CT-es aptos | |
| CT-es bloqueados | |

### Rateio por CT-e

| # | NF-e | Destino | Valor rateado | Ajuste |
|---|------|---------|--------------|--------|
| 1 | | | | |
| 2 | | | | |
| Soma | | | | |

---

## 6. PAYLOAD FOCUS VALIDADO (1 CT-e)

| Campo | Esperado | Real | OK? |
|-------|----------|------|-----|
| natureza_operacao | Transporte | | |
| modal | 01 (rodoviário) | | |
| tipo_servico | 0 (normal) | | |
| tomador | Remetente (Calvo) | | |
| CFOP | 5353 | | |
| origem | Guarulhos/SP | | |
| destino | Endereço real | | |
| NF-e vinculada | Sim | | |
| valor | Rateado | | |
| observacao | Endereço real | | |

---

## 7. ENVIO HOMOLOGAÇÃO

| CT-e | Status retornado | Protocolo | Erro |
|------|-----------------|-----------|------|
| 1 | | | |
| 2 | | | |
| Total | sucessos: / falhas: | | |

---

## 8. CONSULTA HOMOLOGAÇÃO

| CT-e | Status SEFAZ | Chave acesso | Rejeição |
|------|-------------|-------------|----------|
| 1 | | | |
| 2 | | | |

---

## 9. XML/DACTE STORAGE

| CT-e | XML salvo? | DACTE salvo? | Storage path |
|------|-----------|-------------|-------------|
| 1 | | | |
| 2 | | | |

---

## 10. VERIFICAÇÕES DE SEGURANÇA

| Verificação | OK? |
|-------------|-----|
| Token NÃO aparece no console | ( ) |
| Token NÃO aparece no Network | ( ) |
| Produção bloqueada (FOCUS_AMBIENTE=homologacao) | ( ) |
| VITE_FOCUS_TOKEN = 0 | ( ) |
| localStorage no módulo fiscal = 0 (exceto MOCK_MODE) | ( ) |

---

## 11. DECISÃO FINAL

### ( ) APROVADO PARA PRODUÇÃO INDIVIDUAL
- Todos CT-es autorizados em homologação
- XML/DACTE salvos no Storage
- Payload Focus validado
- Próxima etapa: P13B-RUN (primeira emissão produção)

### ( ) APROVADO COM RESSALVAS
- Ressalvas: _____________
- Próxima etapa: corrigir ressalvas antes de P13B-RUN

### ( ) REPROVADO
- Motivo: _____________
- Próxima etapa: P13C (correção fiscal) ou P13D (correção técnica)

---

## 12. CORREÇÕES REALIZADAS (se houver)

| Bug | Causa | Correção | TSC/Build |
|-----|-------|----------|-----------|
| | | | |

---

## 13. RESULTADO FINAL — ROMANEIO 294929

### 13.1 Controle de Romaneios
- [ ] Romaneio 294929 aparece na lista
- [ ] Cliente: Calvo, Layout: Calvo
- [ ] Total PDF: 9 itens
- [ ] XMLs cruzados: 8
- [ ] XML faltante: 2300644
- [ ] XML fora do romaneio: 2290644
- [ ] Status: com_pendencias

### 13.2 Geração Parcial
- [ ] 8 CT-es gerados (sem 2300644)
- [ ] metadata.geracao_parcial = true
- [ ] metadata.xmls_faltantes = ["2300644"]
- [ ] Todos com lote_id
- [ ] Todos com romaneio_numero=294929

### 13.3 Rateio Final (R$ 600,00 por quantidade)
| NF-e | Valor CT-e | Conferido? |
|------|-----------|------------|
| 2298441 | R$ 16,22 | [ ] |
| 2299050 | R$ 129,73 | [ ] |
| 2299207 | R$ 32,43 | [ ] |
| 2299453 | R$ 64,86 | [ ] |
| 2299698 | R$ 32,43 | [ ] |
| 2299703 | R$ 32,43 | [ ] |
| 2300645 | R$ 243,24 | [ ] |
| 2300857 | R$ 48,66 | [ ] |
| **Soma** | **R$ 600,00** | [ ] |

### 13.4 Prévia sem Valor Fiscal
- [ ] NF-e 2299207: destino Santana de Parnaíba/SP, valor R$ 32,43
- [ ] NF-e 2299698: destino Barueri/SP, valor R$ 32,43
- [ ] NF-e 2300645: destino Cotia/SP, valor R$ 243,24
- [ ] Marca d'água "SEM VALOR FISCAL" presente

### 13.5 Envio Focus Homologação
- [ ] 8 CT-es enviados sequencialmente
- [ ] Nenhum token exposto
- [ ] Status: processando/rejeitado/erro_emissao

### 13.6 Consulta Focus
- [ ] Consulta sequencial executada
- [ ] Autorizados com chave/protocolo
- [ ] Rejeitados com motivo visível

### 13.7 XML/DACTE Storage
- [ ] XML baixado para CT-es autorizados
- [ ] DACTE baixado para CT-es autorizados
- [ ] Storage path: cte/homologacao/{ano}/{mes}/{id}/
- [ ] Signed URL sob demanda funciona

### 13.8 Envio ao Cliente
- [ ] CT-es autorizados com XML/DACTE
- [ ] Modal de envio lista corretamente
- [ ] Envio manual registrado ou webhook configurado
- [ ] metadata.email_cliente preenchido

### 13.9 Pendências Restantes
- XML 2300644 continua faltando
- XML 2290644 continua fora do romaneio

### 13.10 Decisão Final

| Decisão | Marcar |
|---------|--------|
| Simulação aprovada | ( ) |
| Simulação aprovada com ressalvas | ( ) |
| Simulação reprovada | ( ) |

**Justificativa:** (preencher)

---

## 14. PRÓXIMA ETAPA

- **Aprovado:** P13B-RUN — primeira emissão produção individual
- **Ressalvas:** corrigir ressalvas antes de P13B-RUN
- **Reprovado:** P13D — correção fiscal/técnica
