# PLANO DE MELHORIAS FUTURAS — Express Connect Hub / TMS

**Data:** 26/06/2026  
**Classificação:** Melhorias pós-GO-LIVE (v2.1+)  
**Categorias:** Operacional, Financeiro, Fiscal, IA, UX, Arquitetura

---

## MELHORIAS OPERACIONAIS

### MO01 — Alocação Inteligente de Frota
**Problema:** Escala manual ou com `Math.random()`  
**Solução:** Algoritmo de otimização que considere:
- Disponibilidade do prestador
- Tipo de veículo adequado à carga
- Proximidade geográfica
- Histórico de performance
- Custo × benefício  
**Complexidade:** Alta  
**Prioridade:** Média

### MO02 — Roteirização com Restrições Reais
**Problema:** Roteirizador não considera restrições de tráfego  
**Solução:** Adicionar:
- Rodízio SP (placa × dia)
- Zonas de restrição de caminhões
- Pedágios urbanos
- Janelas de entrega
- Restrições de altura/peso em pontes e túneis  
**Complexidade:** Alta  
**Prioridade:** Média

### MO03 — Checklist Digital de Partida
**Problema:** Sem conferência do veículo antes da viagem  
**Solução:** App motorista com checklist:
- Documentos do veículo
- Condição dos pneus
- Nível de combustível
- Equipamentos de segurança
- Carga conferida (fotos)
- Termo de responsabilidade  
**Complexidade:** Média  
**Prioridade:** Média

### MO04 — Controle de Jornada do Motorista (Lei 12.619)
**Problema:** Sistema não controla horas trabalhadas  
**Solução:**
- Registrar início/fim da jornada
- Controlar intervalos de descanso
- Alertar violação (6h direção, 8h diárias, etc.)
- Bloquear nova alocação se motorista excedeu jornada
- Gerar relatório para fiscalização  
**Complexidade:** Média  
**Prioridade:** Alta

### MO05 — Cadeia de Custódia da Carga
**Problema:** Sem registro de quem manuseou a carga  
**Solução:**
- RFID ou QR code por volume
- Scan na coleta, transbordo e entrega
- Divergência de peso/volumes → alerta
- Relatório de avarias por etapa  
**Complexidade:** Alta  
**Prioridade:** Baixa

### MO06 — Precificação Dinâmica
**Problema:** Tabela de valores estática  
**Solução:**
- Ajuste automático baseado em demanda
- Sazonalidade (agrícola, natal, etc.)
- Clientes VIP × clientes standard
- Margem mínima garantida por cliente  
**Complexidade:** Alta  
**Prioridade:** Baixa

---

## MELHORIAS FINANCEIRAS

### MF01 — Split de Pagamento Automático
**Problema:** Prestador recebe valor bruto sem descontos  
**Solução:**
- Reter IRRF, INSS, ISS na fonte
- Split automático: 80% prestador, 10% combustível, 5% seguro, 5% taxa
- Pagar fornecedores diretamente (pedágio, combustível)  
**Complexidade:** Alta  
**Prioridade:** Média

### MF02 — Conciliação Bancária Automática via API
**Problema:** Conciliação manual ou mock  
**Solução:**
- Integração com API bancária (Itaú, Bradesco, etc.)
- Consulta automática de extratos
- Matching por pix, boleto, TED
- Conciliação em tempo real  
**Complexidade:** Alta  
**Prioridade:** Alta

### MF03 — Gestão de Fluxo de Caixa Cenarizada
**Problema:** Fluxo de caixa simples, sem cenários  
**Solução:**
- Projeção otimista, realista, pessimista
- Sensibilidade a atraso de clientes
- Simulação de investimentos
- Alerta de necessidade de capital de giro  
**Complexidade:** Média  
**Prioridade:** Média

### MF04 — Integração com Gateway de Pagamento
**Problema:** Sem boleto registrado, PIX, cartão  
**Solução:**
- Integrar com ASAAS, PagSeguro, Stone
- Geração automática de boletos ao finalizar OS
- PIX como forma de recebimento prioritária
- Link de pagamento para clientes
- Split de pagamento entre múltiplos prestadores  
**Complexidade:** Média  
**Prioridade:** Alta

### MF05 — FIDC / Antecipação de Recebíveis
**Problema:** Transportadora precisa de capital de giro  
**Solução:**
- Módulo de antecipação de recebíveis
- Integração com FIDC (Fundo de Investimento)
- Cálculo de desconto por cliente/taxa
- Gestão de cessão de crédito  
**Complexidade:** Muito Alta  
**Prioridade:** Baixa

---

## MELHORIAS FISCAIS

### MFI01 — Regime Tributário Parametrizável
**Problema:** Cálculo de impostos fixo, sem considerar regime  
**Solução:**
- Simples Nacional: alíquotas do anexo IV (transporte)
- Lucro Presumido: PIS/COFINS cumulativo
- Lucro Real: PIS/COFINS não cumulativo
- Cálculo automático de imposto por nota emitida  
**Complexidade:** Alta  
**Prioridade:** Alta

### MFI02 — Obrigações Acessórias Automáticas
**Problema:** Sem geração de SPED, DCTF, DEFIS  
**Solução:**
- Gerar SPED Fiscal a partir dos CT-es emitidos
- Gerar DCTF a partir dos pagamentos
- Gerar DEFIS (Simples Nacional)
- Envio automático para contabilidade  
**Complexidade:** Muito Alta  
**Prioridade:** Baixa

### MFI03 — CT-e de Redespacho / Subcontratação
**Problema:** Apenas CT-e de transporte direto  
**Solução:**
- CT-e de redespacho (prestador substitui transportador)
- CT-e de subcontratação
- Rateio automático de frete entre transportadores  
**Complexidade:** Média  
**Prioridade:** Média

### MFI04 — Validação Fiscal na Criação da OS
**Problema:** OS criada sem verificar situação fiscal  
**Solução:**
- Verificar inscrição estadual do cliente
- Verificar CNPJ na Receita Federal
- Verificar IE na SEFAZ
- Bloquear OS se cliente com problemas fiscais  
**Complexidade:** Média  
**Prioridade:** Média

### MFI05 — Integração com Contabilidade
**Problema:** Sistema não se comunica com contador  
**Solução:**
- Exportação de lançamentos contábeis
- API para sistemas contábeis (Omie, ContaAzul, etc.)
- Envio automático de XML de notas
- Plano de contas integrado  
**Complexidade:** Alta  
**Prioridade:** Média

---

## MELHORIAS DE IA

### MIA01 — Motor de Seleção com LLM Real
**Problema:** Keyword scoring determinístico (frágil)  
**Solução:**
- Usar embeddings semânticos para seleção
- LLM (Gemini/Groq) para interpretar intenção
- RAG com memória corporativa para contexto
- Confiança mínima configurável por ação  
**Complexidade:** Alta  
**Prioridade:** Alta

### MIA02 — Detecção de Anomalias em Tempo Real
**Problema:** IA pode agir sem supervisão adequada  
**Solução:**
- Monitorar ações da IA por desvio padrão
- Detectar: muitas ações em curto período, valores fora da curva, operações em horário não comercial
- Pausar automaticamente o robô com alerta
- Dashboard de supervisão de IA  
**Complexidade:** Média  
**Prioridade:** Alta

### MIA03 — Assistente Virtual para Operadores
**Problema:** Operador precisa navegar por várias telas  
**Solução:**
- Chat em linguagem natural: "Cria uma OS para o cliente X com urgência"
- IA executa ações rotineiras sob demanda
- Sugestão proativa: "Cliente X está ligando, quer criar uma OS"
- Explicação de anomalias: "Por que esta OS está atrasada?"  
**Complexidade:** Alta  
**Prioridade:** Média

### MIA04 — Previsão de Demanda com ML
**Problema:** Sem planejamento de capacidade  
**Solução:**
- Modelo ML para prever volume de entregas
- Sugestão de alocação antecipada de frota
- Identificar sazonalidade por cliente/rota
- Alertar necessidade de contratar mais prestadores  
**Complexidade:** Muito Alta  
**Prioridade:** Baixa

### MIA05 — Análise de Sentimento de Clientes
**Problema:** Sem métrica de satisfação contínua  
**Solução:**
- Processar mensagens WhatsApp/email com NLP
- Detectar insatisfação antes de ocorrência formal
- Alertar gestor para intervenção proativa
- Score de satisfação por cliente  
**Complexidade:** Alta  
**Prioridade:** Baixa

### MIA06 — Auditoria Automática de Ações IA
**Problema:** Quem fez o quê via IA não é rastreável  
**Solução:**
- Imprimir em todas as tabelas: `criado_por_robo_id`, `acao_ia_id`
- Relatório de ações da IA por período
- Capacidade de reverter ações via IA
- Simular impacto antes de executar  
**Complexidade:** Média  
**Prioridade:** Alta

---

## MELHORIAS DE UX

### MUX01 — App Motorista Nativo (Offline-first)
**Problema:** AppPrestador é painel web, não app real  
**Solução:**
- PWA ou Flutter para motoristas
- Funcionar offline (cache de escala, POD offline)
- Sincronizar quando tiver internet
- Navegação GPS integrada
- Chat com torre de controle
- Notificações push  
**Complexidade:** Alta  
**Prioridade:** Alta

### MUX02 — Dashboard Executivo em Tempo Real
**Problema:** Dados não refletem momento atual  
**Solução:**
- WebSockets/Supabase Realtime
- OS sendo criadas aparecem em segundos
- Tracking no mapa atualizado em tempo real
- Alertas push para eventos críticos  
**Complexidade:** Média  
**Prioridade:** Média

### MUX03 — Refatoração do Portal Cliente
**Problema:** 5472 linhas em um arquivo  
**Solução:**
- Quebrar em componentes menores
- Lazy loading por rota
- Estado global (Zustand) para dados compartilhados
- Testes unitários para cada submódulo  
**Complexidade:** Média  
**Prioridade:** Alta

### MUX04 — Relatórios Customizáveis com Drag-and-Drop
**Problema:** Relatórios fixos, sem customização  
**Solução:**
- Construtor de relatórios visual
- Arrastar campos, filtros, agrupamentos
- Salvar relatórios personalizados
- Agendar envio por email
- Exportar em múltiplos formatos  
**Complexidade:** Alta  
**Prioridade:** Média

### MUX05 — Modo Escuro Profissional
**Problema:** Apenas modo claro  
**Solução:**
- Tema escuro completo
- Adaptação automática (sistema/usuário)
- Contraste adequado para uso em caminhão (claro)
- Paleta de cores corporativa  
**Complexidade:** Baixa  
**Prioridade:** Baixa

---

## MELHORIAS DE ARQUITETURA

### MARQ01 — API Pública (REST + Webhook)
**Problema:** Sem API para integração externa  
**Solução:**
- API REST documentada (OpenAPI/Swagger)
- Webhooks para eventos: OS criada, finalizada, CT-e emitido
- Rate limit por cliente externo
- Chave de API por integrador  
**Complexidade:** Alta  
**Prioridade:** Média

### MARQ02 — Cache e Performance
**Problema:** Consultas repetitivas ao Supabase  
**Solução:**
- Redis para cache de consultas frequentes
- Paginação eficiente em todas as listas
- Materialized views para relatórios
- Indexação adequada (revisar)  
**Complexidade:** Média  
**Prioridade:** Média

### MARQ03 — Multi-tenancy
**Problema:** Sistema atende uma empresa apenas  
**Solução:**
- Isolamento por tenant (empresa)
- Schema por tenant ou coluna `empresa_id`
- Configurações independentes por empresa
- Possibilidade de franchising / operador logístico  
**Complexidade:** Muito Alta  
**Prioridade:** Baixa

### MARQ04 — Disaster Recovery
**Problema:** Sem plano de recuperação  
**Solução:**
- Backup automático a cada 6h
- Restore point diário
- Procedimento documentado de DR
- Teste de restore a cada trimestre  
**Complexidade:** Média  
**Prioridade:** Alta

### MARQ05 — Modo Offline (PWA)
**Problema:** Dependência total de internet  
**Solução:**
- Service worker para cache de assets
- IndexedDB para dados offline
- Fila de operações offline para sincronizar
- App rodando mesmo sem internet (leitura de OS, consultas)  
**Complexidade:** Alta  
**Prioridade:** Baixa

---

## MATRIZ DE PRIORIZAÇÃO

```
Alta │ MIA01 MIA02 MIA06  MF01 MF02 MF04
     │ MUX01 MUX03 MO04   MFI01
     │
Média│ MO01 MO02 MO03 MO05 MF03
     │ MFI03 MFI04 MFI05 MIA03
     │ MUX02 MUX04 MARQ01 MARQ02 MARQ04
     │
Baixa│ MO06 MF05 MFI02 MIA04 MIA05
     │ MUX05 MARQ03 MARQ05
     │
     └───────────────────────────→
       Curto Prazo    Longo Prazo
```

---

## ESTIMATIVA DE ESFORÇO TOTAL

| Categoria | Itens | Esforço Estimado |
|-----------|:-----:|:-----------------:|
| Operacional (MO01-MO06) | 6 | 180h |
| Financeiro (MF01-MF05) | 5 | 160h |
| Fiscal (MFI01-MFI05) | 5 | 200h |
| IA (MIA01-MIA06) | 6 | 220h |
| UX (MUX01-MUX05) | 5 | 200h |
| Arquitetura (MARQ01-MARQ05) | 5 | 200h |
| **Total** | **32** | **~1.160h** |

**Estimativa de Prazo:** 6-8 meses após v2.0  
**Custo Estimado:** R$ 350.000 - R$ 600.000

---

## RECOMENDAÇÕES FINAIS

1. **Priorizar o que dá retorno financeiro direto:**
   - MF04 (Gateway de pagamento) → reduz inadimplência, acelera recebimento
   - MUX01 (App motorista) → reduz erros operacionais, melhora eficiência
   - MFI01 (Regime tributário) → reduz impostos pagos incorretamente

2. **Priorizar o que reduz risco:**
   - MIA02 (Detecção de anomalias) → previne ações indevidas da IA
   - MARQ04 (Disaster recovery) → garante continuidade do negócio
   - MIA06 (Auditoria IA) → rastreabilidade de ações

3. **Deixar para depois:**
   - MARQ03 (Multi-tenancy) — complexo, retorno apenas se vender como SaaS
   - MF05 (FIDC) — nicho, poucas transportadoras usam
   - MIA05 (Análise de sentimento) — interessante mas não essencial
