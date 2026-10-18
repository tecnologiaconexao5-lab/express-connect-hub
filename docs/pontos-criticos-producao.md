# PONTOS CRÍTICOS PARA PRODUÇÃO — Express Connect Hub / TMS

**Data:** 26/06/2026  
**Classificação:** Bloqueantes, Altos e Médios para GO-LIVE  
**Total de Pontos:** 47 (10 Críticos, 15 Altos, 22 Médios)

---

## 🔴 CRÍTICOS — Impedem GO-LIVE (10)

### PC01 — RLS Policies Totalmente Abertas
**Onde:** Todas as migrations com `CREATE POLICY "allow_all_*" FOR ALL TO anon, authenticated USING (true)`  
**Problema:** A chave anon do Supabase é pública no frontend. Qualquer pessoa pode ler/escrever em QUALQUER tabela do sistema.  
**Impacto:** Exposição total de dados financeiros, fiscais, operacionais e de clientes.  
**Solução:** Trocar para policies baseadas em `auth.uid()`. Usar `service_role` no backend.

### PC02 — DRE Gerencial Fabricado
**Onde:** `src/components/financeiro/DREGerencial.tsx` (linhas 92-193)  
**Problema:** 90% dos valores são estimados: deduções = 10% da receita, despesas admin = 15%, IR/CSLL = 25% fixo. Nada corresponde à realidade.  
**Impacto:** Tomada de decisão gerencial errada. Precificação incorreta. Risco fiscal.  
**Solução:** Refatorar com lançamentos contábeis reais. Desabilitar o DRE atual.

### PC03 — CNAB com Arquivo Fake
**Onde:** `src/components/financeiro/PagamentoCNAB.tsx` (linhas 45-46)  
**Problema:** O "CNAB gerado" é uma string concatenada: `"PAGAMENTO ${p.nome} ${p.valor}"`. Não segue layout FEBRABAN 240.  
**Impacto:** Impossível processar pagamentos em lote. Operação manual inviável para centenas de prestadores.  
**Solução:** Implementar gerador FEBRABAN 240/400 real.

### PC04 — Conciliação Bancária 100% Mock
**Onde:** `src/components/financeiro/ConciliacaoAvancada.tsx`  
**Problema:** Todo o componente é simulado com `setTimeout`. Não há parser OFX, matching automático ou integração bancária.  
**Impacto:** Impossível conferir se pagamentos foram compensados. Risco de desvio financeiro não detectado.  
**Solução:** Reimplementar do zero.

### PC05 — ICMS com Alíquota Fixa de 12%
**Onde:** `src/services/fiscal/cteService.ts` (linhas 382-389)  
**Problema:** `const aliquotaIcms = fiscal.icms_aliquota ?? 12;` — fallback de 12% independente da UF de destino.  
**Impacto:** ICMS declarado incorretamente → multa fiscal, glosa de crédito.  
**Solução:** Implementar cálculo por UF/CFOP/cliente conforme CONFAZ.

### PC06 — Certificado Digital sem Senha
**Onde:** `src/components/fiscal/EmitenteFiscalConfig.tsx`  
**Problema:** Upload do .pfx é feito para Storage, mas a senha não é armazenada. Frase literal: "A senha do certificado não é armazenada no sistema."  
**Impacto:** Impossível assinar digitalmente CT-e, NFS-e, MDF-e. Nenhum documento fiscal pode ser transmitido.  
**Solução:** Salvar senha no Supabase Vault. Implementar assinatura via Edge Function.

### PC07 — Sem Contingência SEFAZ
**Onde:** Em todo o módulo fiscal  
**Problema:** Não existe modo contingência (FS-DA, DPEC). Se SEFAZ ficar offline, operação para.  
**Impacto:** Parada total da operação. Impossível emitir CT-e. Multas por atraso na emissão.  
**Solução:** Implementar contingência com fila de retentativa e fallback para XML contingência.

### PC08 — IA Pode Criar/ Finalizar OS sem Validação
**Onde:** `src/services/ia/actionEngineService.ts` — `executarAcaoReal()`  
**Problema:** O dispatch `COM_CRIAR_ESCALA` faz INSERT direto sem verificar disponibilidade do prestador, duplicidade, ou limites de horário. `COM_ATUALIZAR_STATUS` pode marcar OS como concluída sem verificar etapas anteriores.  
**Impacto:** Criação de OS fantasmas. Finalização de serviços não realizados. Pagamentos indevidos.  
**Solução:** Adicionar validações de negócio. Implementar transações atômicas multi-etapas.

### PC09 — Frota 100% Mockada
**Onde:** `src/pages/Frota.tsx`  
**Problema:** Manutenção, abastecimento, documentos, seguros, custos — todos dados fixos em HTML. Zero consulta ao banco.  
**Impacto:** Impossível controlar frota. Sem manutenção preventiva, veículos quebram. Sem controle de combustível, roubo não é detectado.  
**Solução:** Reimplementar do zero com tabelas no banco.

### PC10 — Seguros 100% Mockado
**Onde:** `src/pages/Seguros.tsx`, `src/components/seguros/`  
**Problema:** Apólices fixas em array estático. Sem CRUD, sem cálculo, sem averbação real, sem sinistros.  
**Impacto:** Carga não segurada. Risco de prejuízo milionário em caso de acidente.  
**Solução:** Criar migrations e reimplementar.

---

## 🟡 ALTOS — Impedem Excelência Operacional (15)

### PA01 — Ocorrências sem Persistência
**Onde:** `src/components/operacao/OcorrenciasLista.tsx`  
**Problema:** 100% mockado. Dados morrem ao recarregar. Sem tabela no banco.  
**Impacto:** Perde histórico de problemas. Impossível gerar relatórios de ocorrências.

### PA02 — POD UI não usa Serviço Real
**Onde:** `src/components/operacao/PodLista.tsx`  
**Problema:** Componente estático. Não importa nem chama `podService.ts` que tem funções reais.  
**Impacto:** Usuário vê dados falsos. Não consegue consultar POD real.

### PA03 — Escala com Geração Automática Mockada
**Onde:** `src/components/operacao/EscalaLista.tsx` — `handleGerarEscalaAutomatica()`  
**Problema:** Usa `Math.random() > 0.7` para decidir alocações. Gera dados fictícios.  
**Impacto:** Escala automática inútil. Operador precisa criar tudo manualmente.

### PA04 — Tracking Placeholder
**Onde:** Modal de tracking em OS  
**Problema:** Aviso "Tracking em tempo real não disponível. Aguardando integração com o app."  
**Impacto:** Cliente não vê onde está a carga. Operador não consegue monitorar rota.

### PA05 — Sem NFS-e Real
**Onde:** `src/services/fiscal/nfseService.ts`, `NfseTab.tsx`  
**Problema:** Não há Edge Function para NFS-e. Emissão é 100% simulada.  
**Impacto:** Nota fiscal de serviço não emitida. Sonegação fiscal. Multa.

### PA06 — Sem MDF-e Real
**Onde:** `src/services/fiscal/mdfeService.ts`, `MdfeTab.tsx`  
**Problema:** Rascunho apenas. Sem Edge Function, sem integração Focus, sem encerramento.  
**Impacto:** Manifesto não enviado ao fisco. Viagem sem documentação fiscal.

### PA07 — Inadimplência Mockada na UI
**Onde:** `src/components/financeiro/Inadimplencia.tsx`  
**Problema:** Componente com 3 clientes hardcoded. Não usa `inadimplenciaService.ts` que consulta o banco real.  
**Impacto:** Gestão de cobrança ineficaz. Clientes inadimplentes não são identificados.

### PA08 — Fluxo de Caixa com Erro de Classificação
**Onde:** `src/components/financeiro/FluxoCaixaEnterprise.tsx` (linha 101)  
**Problema:** `realizado: vencimentoStr <= hojeStr` — trata título vencido como "realizado".  
**Impacto:** Projeção de fluxo de caixa otimista. Empresa pode ficar sem dinheiro sem perceber.

### PA09 — Simulador de Frete Didático
**Onde:** `src/components/comercial/SimuladorFrete.tsx`  
**Problema:** Valores fixos: R$ 350 base, R$ 0,45/kg extra, 0,3% ad-valorem. Não usa banco de dados.  
**Impacto:** Precificação incorreta. Cliente recebe orçamento errado.

### PA10 — SLA sem Dados Reais
**Onde:** `src/pages/SLA.tsx`  
**Problema:** Valores hardcoded (94.2%, 0.8%, 1.2%). Não consulta OS ou entregas reais.  
**Impacto:** Indicador de qualidade fictício. Gestão baseada em dados falsos.

### PA11 — Manifestação do Destinatário Ausente
**Onde:** Módulo fiscal  
**Problema:** Cliente não consegue dar ciência, confirmar ou desconhecer operação no CT-e.  
**Impacto:** CT-e irregular. Risco de rejeição fiscal.

### PA12 — Baixa Parcial Corrompe Valor
**Onde:** `src/components/financeiro/ContasReceberEnterprise.tsx` (linha 903)  
**Problema:** `novoValor = valorAnterior - valorRecebido` — altera `valor_liquido` em vez de controlar recebido separadamente.  
**Impacto:** Histórico financeiro impreciso. Relatórios de contas a receber mostram valores errados.

### PA13 — Worker sem Circuit Breaker
**Onde:** `src/services/ia/workforceOrchestratorWorker.ts`  
**Problema:** Se banco cai, o worker tenta 4x/minuto para sempre. Sem backoff exponencial.  
**Impacto:** Logs de erro infinitos. Consumo desnecessário de recursos.

### PA14 — Agente Autônomo sem Transação
**Onde:** `src/services/ia/actionEngineService.ts` — `executarAcaoReal()`  
**Problema:** Cada ferramenta executa uma operação isolada. Se criar OS funciona mas criar financeiro falha, sistema fica inconsistente.  
**Impacto:** Dados órfãos. Serviço concluído sem pagamento, ou pagamento sem serviço.

### PA15 — Roteirizador não Integra com OS/Escala
**Onde:** `src/components/operacao/RoteirizadorWeb.tsx`  
**Problema:** Rotas geradas não viram OS automaticamente. Não integram com escala.  
**Impacto:** Ferramenta isolada. Operador precisa recriar dados manualmente.

---

## 🟢 MÉDIOS — Afetam Qualidade (22)

### PM01 — Portal Cliente: Ocorrências salvam em estado local
### PM02 — Portal Cliente: Avaliações salvam em estado local
### PM03 — Contratos sem controle de vigência/renovação
### PM04 — Sem Logística Reversa
### PM05 — Sem Reentregas
### PM06 — Sem App Motorista nativo (PWA Flutter não integrado)
### PM07 — Orçamento → OS não valida se OS já foi criada
### PM08 — Tabela de Valores: faixas existem no tipo mas não no motor de cálculo
### PM09 — CRM com fallback para leads mock
### PM10 — Follow-up depende de webhook n8n (sem fallback)
### PM11 — Certificado A3 (token) não suportado
### PM12 — Validação de CNPJ não implementada
### PM13 — Validação de IE não implementada
### PM14 — Validação de RNTRC não implementada
### PM15 — Sem rateio de custos indiretos por OS
### PM16 — Tabela de valores: markup existe mas não impacta cálculo real
### PM17 — Sem bloqueio automático de cliente inadimplente no financeiro
### PM18 — Portal Cliente 5472 linhas (precisa refatorar)
### PM19 — Sem webhook de retorno Focus para processamento assíncrono
### PM20 — Motor de seleção IA usa keyword scoring (não LLM)
### PM21 — Sem UI para sessões de agente IA
### PM22 — Sem gatilhos de agenda F31 para iniciar sessões IA

---

## MATRIZ DE DECISÃO PARA GO-LIVE

### GO-LIVE COM RESSALVAS (2-3 meses):
Se a empresa aceitar operar com limitações e plano de correção:

```
✅ PODE OPERAR:
  - CRM Comercial
  - Orçamentos (exceto simulador)
  - Contratos (com assinatura canvas)
  - OS (cadastro, acompanhamento básico)
  - Contas a Receber/Pagar (baixa manual)
  - Portal Cliente (pedidos, histórico)
  - Portal Prestador (escalas, aceite, POD)

❌ NÃO PODE OPERAR:
  - Frota (não funciona)
  - Seguros (não funciona)
  - SLA (não funciona)
  - Emissão fiscal (CT-e/NFS-e/MDF-e)
  - Conciliação bancária
  - CNAB / Pagamento em lote
  - DRE (fabricado)
  - Tracking em tempo real
  - Ocorrências (sem persistência)

⚠️ REQUER SUPERVISÃO HUMANA:
  - IA Autônoma (apenas modo assistido)
  - Geração de escalas automáticas
  - Qualquer ação financeira via IA
```

### GO-LIVE IDEAL (3-4 meses):
Após correção de todos os críticos e altos.

---

## RECOMENDAÇÃO FINAL

**Não colocar em produção nos próximos 30 dias.** O risco de exposição de dados (RLS), erro fiscal (ICMS, certificado) e decisão financeira errada (DRE) é inaceitável para uma transportadora profissional.

**Prazo otimista:** 8 semanas para um MVP seguro (corrigindo apenas Críticos e Altos).
**Prazo realista:** 12-16 semanas para um sistema confiável.
