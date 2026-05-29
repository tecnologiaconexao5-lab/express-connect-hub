# PLANO MESTRE TMS CONEXÃO EXPRESS

## 1. VISÃO GERAL DO SISTEMA

### Missão
O TMS Conexão Express deve ser uma **plataforma operacional logística inteligente**, não apenas um sistema de telas. Uma solução completa que integra operação, financeiro, recrutamento e automações para transformar a gestão logística através de inteligência artificial e automações avançadas.

### Objetivos Estratégicos
- **Operação Inteligente**: Automação de escalas, distribuição e monitoramento em tempo real
- **Financeiro Automatizado**: Faturamento, cobrança e repasses automáticos
- **Recrutamento IA**: Gestão inteligente de motoristas com IA conversacional
- **Portal Integrado**: Cliente e prestador com experiência digital completa
- **Compliance Fiscal**: CT-e, MDF-e e NFSe totalmente automatizados
- **Comunicação Omnichannel**: WhatsApp, e-mail e notificações integradas

## 2. STACK TECNOLÓGICA ATUAL

### Frontend
- **React 18** - Interface de usuário
- **TypeScript** - Type safety e desenvolvimento
- **Vite** - Build tool e desenvolvimento
- **Shadcn/UI** - Biblioteca de componentes
- **Tailwind CSS** - Estilização

### Backend & Infraestrutura
- **Supabase** - Database PostgreSQL, Auth, Storage, Edge Functions
- **Vercel** - Hosting e deployment
- **GitHub** - Repositório e CI/CD

### Desenvolvimento & IA
- **OpenCode** - IDE com agentes IA
- **OpenRouter** - Roteamento de modelos IA
- **Windows PowerShell** - Ambiente de desenvolvimento

### Integrações Futuras Planejadas
- **Focus NFe** - Emissão fiscal CT-e/MDF-e/NFSe
- **n8n** - Automações e workflows
- **WhatsApp Business API** - Comunicação automatizada
- **Modelos IA Específicos** - GPT-4, Claude, Gemini
- **OCR Services** - Leitura automática de documentos
- **Serviços de E-mail** - SMTP/APIs para comunicação

## 3. REGRA PRINCIPAL DE DESENVOLVIMENTO

### Antes de Qualquer Alteração:
1. ✅ **Localizar o arquivo real usado pela aplicação**
2. ✅ **Confirmar se já existe função parecida**
3. ✅ **Evitar duplicar componente**
4. ✅ **Não criar mock se já houver Supabase**
5. ✅ **Não gastar tokens refazendo o que já existe**
6. ✅ **Corrigir causa raiz, não sintoma**
7. ✅ **Alterar em etapas pequenas**
8. ✅ **Rodar `npm run build`** após alterações
9. ✅ **Rodar `npx tsc --noEmit`** quando necessário
10. ✅ **Informar exatamente quais arquivos foram alterados**

### Princípios de Qualidade:
- **DRY (Don't Repeat Yourself)** - Evitar duplicação de código
- **YAGNI (You Aren't Gonna Need It)** - Não implementar funcionalidades prematuras
- **SOLID** - Princípios de design orientado a objetos
- **Fail Fast** - Detectar erros rapidamente
- **Progressive Enhancement** - Funcionalidades básicas primeiro, depois melhorias

## 4. MÓDULOS OBRIGATÓRIOS DO SISTEMA

### A) OPERAÇÃO / ESCALA OPERACIONAL

**Objetivo**: Central de comando operacional com gestão inteligente de recursos logísticos.

**Funcionalidades Core**:
- 📅 **Escala Diária Automatizada**
  - Algoritmo de distribuição inteligente
  - Consideração de capacidade, região e histórico
  - Backup automático para ausências

- 👨‍🚗 **Gestão de Motoristas Escalados**
  - Status em tempo real (disponível, ocupado, offline)
  - Localização GPS integrada
  - Produtividade e performance

- 🚚 **Controle de Entregas**
  - Pipeline de status (agendada → em rota → entregue)
  - Tempo estimado vs real
  - Comprovantes digitais

- 🗺️ **Roteirização Inteligente**
  - Otimização automática de rotas
  - Consideração de trânsito e condições
  - Reagendamento dinâmico

- ⚡ **Monitoramento de SLA**
  - Alertas de atraso preventivos
  - Métricas de performance
  - Dashboard executivo

- 🔄 **Redistribuição Automática**
  - Quando motorista fica indisponível
  - Priorização por urgência
  - Notificação automática

- 🚨 **Gestão de Ocorrências**
  - Registro de problemas em tempo real
  - Classificação automática
  - Escalação para suporte

**Integrações Necessárias**:
- OS/OC para vínculo de serviços
- App Prestador para comunicação
- Financeiro para cálculos
- IA Operacional para otimizações
- WhatsApp para notificações

### B) ORDENS DE SERVIÇO / ORDEM DE CARREGAMENTO

**Objetivo**: Gestão completa do ciclo de vida dos serviços logísticos.

**Funcionalidades Core**:
- 📋 **Criação de OS (Ordem de Serviço)**
  - Templates por tipo de cliente
  - Preenchimento automático de dados
  - Validações em tempo real
  - Numeração sequencial automática

- 📦 **Criação de OC (Ordem de Carregamento)**
  - Vinculação automática com OS
  - Detalhamento de carga
  - Instruções específicas
  - Documentos necessários

- 🏢 **Gestão de Vínculos**
  - Cliente → OS → OC → Motorista
  - Rastreabilidade completa
  - Histórico de alterações
  - Auditoria de ações

- 💰 **Gestão Financeira Integrada**
  - Valores automáticos por cliente/rota
  - Cálculos de custo e margem
  - Aprovações por alçada
  - Integração com cobrança

- 📊 **Controle de Status**
  - Pipeline visual de progresso
  - Notificações automáticas
  - SLA por etapa
  - Alertas de atraso

- 📄 **Gestão Documental**
  - Upload de comprovantes
  - Validação automática
  - Armazenamento seguro
  - Acesso por perfil

**Base para Módulos Futuros**:
- Fiscal CT-e/MDF-e/NFSe
- Relatórios personalizados
- Portal do cliente
- BI e analytics

### C) RELATÓRIOS OPERACIONAIS / PDFs CLIENTE

**Objetivo**: Inteligência de negócio e comunicação profissional com clientes.

**Funcionalidades Core**:
- 📈 **Relatórios Gerenciais**
  - Operacional por cliente/período
  - Performance de entregas
  - Análise de atrasos
  - Produtividade por motorista

- 📋 **Relatórios Customizados**
  - Templates por cliente
  - Métricas específicas
  - Comparativos históricos
  - Projeções e tendências

- 🎨 **PDFs Profissionais**
  - Identidade visual por cliente
  - Dados em tempo real
  - Gráficos e dashboards
  - Assinatura digital

- ✅ **Comprovação de Entregas**
  - Relatório consolidado
  - Fotos e assinaturas
  - Horários precisos
  - Observações do motorista

- 📧 **Envio Automatizado**
  - Agendamento de relatórios
  - Múltiplos destinatários
  - Diferentes formatos
  - Confirmação de entrega

**Integrações Necessárias**:
- Portal Cliente para acesso
- OS/OC para dados
- Operação para métricas
- E-mail para envio

### D) FINANCEIRO CLIENTE

**Objetivo**: Automação completa do ciclo de faturamento e cobrança.

**Funcionalidades Core**:
- 💳 **Faturamento Automatizado**
  - Geração automática por OS/OC
  - Regras específicas por cliente
  - Múltiplas modalidades de cobrança
  - Integração com tabelas de preço

- 🧾 **Gestão de Cobrança**
  - Vencimentos automáticos
  - Múltiplas formas de pagamento
  - Juros e multas por atraso
  - Negociação e parcelamento

- 📊 **Controle de Recebimento**
  - Conciliação automática
  - Status em tempo real
  - Provisão de inadimplência
  - Relatórios de aging

- 🏛️ **Emissão Fiscal**
  - NFSe integrada
  - Dados fiscais automáticos
  - Transmissão SEFAZ
  - Arquivo XML/PDF

- 📈 **Análises Financeiras**
  - DRE por cliente
  - Margem por operação
  - Previsão de recebimento
  - Indicadores de saúde financeira

**Integrações Necessárias**:
- OS/OC para base de faturamento
- Operação para confirmação de entregas
- Portal Cliente para transparência
- IA Financeira para análises

### E) FINANCEIRO PRESTADOR

**Objetivo**: Gestão transparente e automatizada de pagamentos a prestadores.

**Funcionalidades Core**:
- 💰 **Cálculo de Repasses**
  - Valores automáticos por entrega
  - Bonificações por performance
  - Descontos por ocorrências
  - Tabela progressiva de valores

- 📊 **Extrato Detalhado**
  - Histórico completo de serviços
  - Valores por período
  - Descontos aplicados
  - Saldo disponível para saque

- 💳 **Gestão de Pagamentos**
  - Múltiplas formas (PIX, conta, cartão)
  - Cronograma automático
  - Antecipação quando possível
  - Comprovantes digitais

- 📈 **Análise de Produtividade**
  - Ranking de performance
  - Metas e incentivos
  - Comparativo histórico
  - Projeções de ganhos

- 🎯 **Gestão de Performance**
  - Score automático
  - Penalizações por atraso
  - Bonificações por qualidade
  - Plano de desenvolvimento

**Integrações Necessárias**:
- App Prestador para transparência
- Escala para produtividade
- OS/OC para base de cálculo
- Recrutamento para gestão

### F) CONTRATOS AUTOMÁTICOS

**Objetivo**: Automação da geração e gestão de contratos comerciais.

**Funcionalidades Core**:
- 📄 **Geração Automática**
  - Templates inteligentes
  - Dados do Supabase em tempo real
  - Cláusulas personalizáveis
  - Valores dinâmicos

- 🏢 **Contratos por Cliente**
  - Modalidades específicas
  - SLA customizados
  - Tabelas de preço
  - Termos comerciais

- 🚚 **Contratos por Prestador**
  - Regras de repasse
  - Responsabilidades
  - Penalizações
  - Benefícios

- 🔄 **Gestão de Ciclo de Vida**
  - Vencimentos automáticos
  - Renovação facilitada
  - Aditivos e alterações
  - Histórico completo

- ✍️ **Assinatura Digital** (Futuro)
  - Validação eletrônica
  - Certificado digital
  - Rastreabilidade legal
  - Arquivamento seguro

**Integrações Necessárias**:
- Supabase para dados dinâmicos
- Clientes e Prestadores
- Financeiro para valores
- Jurídico para templates

### G) PORTAL CLIENTE

**Objetivo**: Experiência digital completa para acompanhamento de serviços.

**Funcionalidades Core**:
- 🔍 **Acompanhamento em Tempo Real**
  - Status de entregas
  - Localização GPS
  - Previsão de chegada
  - Notificações automáticas

- 📋 **Gestão de Solicitações**
  - Novos serviços
  - Alterações de agenda
  - Cancelamentos
  - Solicitações especiais

- 📊 **Relatórios Personalizados**
  - Performance das entregas
  - Custos por período
  - Comparativos históricos
  - Exportação de dados

- 💰 **Área Financeira**
  - Faturas pendentes
  - Histórico de pagamentos
  - Documentos fiscais
  - Segunda via de boletos

- 💬 **Comunicação Direta**
  - Chat com suporte
  - Abertura de chamados
  - FAQ dinâmico
  - Avaliação de serviços

**Refatoração Necessária**:
- PortalCliente.tsx (5.553 linhas) deve ser dividido em módulos
- Eliminar dependência de localStorage
- Migrar para persistência Supabase
- Implementar arquitetura de micro-frontends

### H) APP PRESTADOR

**Objetivo**: Aplicativo móvel para gestão operacional de motoristas.

**Funcionalidades Core**:
- 📱 **Interface Mobile-First**
  - Design responsivo
  - Offline-first
  - Performance otimizada
  - UX intuitiva

- ✅ **Gestão de Serviços**
  - Aceitar/recusar serviços
  - Detalhes da entrega
  - Navegação integrada
  - Check-list operacional

- 📸 **Comprovação Digital**
  - Fotos de entrega
  - Assinatura digital
  - Observações
  - Localização automática

- 💰 **Área Financeira**
  - Extrato em tempo real
  - Histórico de ganhos
  - Projeções
  - Solicitação de pagamento

- 🏆 **Gamificação**
  - Score de performance
  - Ranking
  - Conquistas
  - Programa de incentivos

**Correções Necessárias**:
- Ações aceitar/finalizar devem salvar no Supabase
- Implementar sincronização offline
- Melhorar UX de comprovação de entregas

### I) RECRUTAMENTO E GESTÃO INTELIGENTE DE MOTORISTAS

**Objetivo**: Sistema enterprise de gestão de talentos logísticos com IA.

**Funcionalidades Core**:

#### 🧠 **Inteligência Artificial Conversacional**
- Entrevistas automáticas via WhatsApp
- Análise de perfil comportamental
- Score de compatibilidade
- Previsão de performance

#### 👥 **Banco de Talentos**
- Cadastro completo de motoristas
- Pipeline de recrutamento
- Tags e categorização
- Busca inteligente

#### 📋 **Gestão Documental Avançada**
- OCR para leitura automática
- Validação de autenticidade
- Controle de vencimentos
- Alertas preventivos

#### 📊 **Analytics Preditivos**
- Previsão de abandono
- Identificação de baixa performance
- Análise de compatibilidade com vagas
- Campanhas de retenção

#### 🎯 **Gestão de Performance**
- Score operacional automático
- Taxa de aceite/cancelamento
- Métricas de pontualidade
- Avaliação de clientes

#### 📱 **Automações WhatsApp**
- Envio automático de vagas
- Cobrança de documentos
- Lembretes de vencimento
- Comunicação personalizada

**Documentos Obrigatórios**:
- CNH com categoria adequada
- CRLV do veículo
- ANTT (quando aplicável)
- Seguro obrigatório
- Comprovante de endereço
- Antecedentes criminais

**Integrações Necessárias**:
- WhatsApp API para comunicação
- App Prestador para onboarding
- Escala para disponibilidade
- Financeiro para histórico
- OCR para documentos

### J) FISCAL / CT-e / MDF-e / NFSe / FOCUS

**Objetivo**: Compliance fiscal automatizado com emissão eletrônica.

**Funcionalidades Core**:

#### 📧 **Captura Automática**
- Leitura de e-mails com XML
- Parser de NF-e e romaneios
- Extração automática de dados
- Validação fiscal

#### 🧮 **Cálculos Fiscais**
- Divisão proporcional de frete
- CFOP por tipo de operação
- Impostos por município
- Base de cálculo automática

#### 📄 **Emissão CT-e**
- Geração por entrega/parada
- Templates por cliente
- Dados do tomador/remetente/destinatário
- Transmissão SEFAZ via Focus

#### 🚛 **MDF-e Integrado**
- Manifesto por viagem
- Vincular múltiplos CT-e
- Encerramento automático
- Controle de trajeto

#### 🏛️ **NFSe Municipal**
- Emissão por município
- Integração com prefeituras
- Cálculo de ISS
- Certificado digital

#### ⚙️ **Configurações por Cliente**
- Templates fiscais
- Regras específicas
- Responsabilidades tributárias
- Aprovações automáticas

**Integração Focus NFe**:
- API para emissão
- Webhooks para retornos
- Gestão de certificados
- Logs de transmissão

### K) WHATSAPP / n8n / IA

**Objetivo**: Automação inteligente de comunicação e processos.

**Funcionalidades Core**:

#### 📱 **WhatsApp Business**
- Múltiplos números de negócio
- Templates aprovados
- Botões interativos
- Mídia e documentos

#### 🔄 **Automações n8n**
- Workflows visuais
- Triggers por eventos
- Integrações múltiplas
- Logs detalhados

#### 🤖 **Agentes IA Especializados**
- Atendimento ao cliente
- Suporte ao motorista
- Cobrança inteligente
- Triagem de solicitações

#### 📊 **Controle e Auditoria**
- Logs de conversas
- Aprovação humana quando necessário
- Métricas de efetividade
- Compliance LGPD

**Casos de Uso Principais**:
- Envio de vagas para motoristas
- Cobrança de documentos vencidos
- Avisos de atraso nas entregas
- Comprovantes de entrega
- Feedback de serviços
- Alertas operacionais

### L) CENTRAL DE AUTOMAÇÕES / AGENTES IA

**Objetivo**: Orquestração inteligente de todos os processos do sistema.

**Funcionalidades Core**:

#### 🚌 **Event Bus**
- Sistema de eventos pub/sub
- Garantia de entrega
- Replay de eventos
- Deadletter queue

#### ⚙️ **Motor de Regras**
- Engine de business rules
- Configuração visual
- A/B testing automático
- Versionamento de regras

#### 🤖 **Agentes Especializados**

**Agente Operacional**:
- Otimização de rotas
- Redistribuição automática
- Alertas preventivos
- Análise de performance

**Agente Fiscal**:
- Validação de documentos
- Cálculos automáticos
- Compliance tributário
- Transmissão SEFAZ

**Agente Financeiro**:
- Cálculo de repasses
- Análise de inadimplência
- Projeções de fluxo
- Reconciliação automática

**Agente de Atendimento**:
- Triagem de solicitações
- Respostas automáticas
- Escalação inteligente
- Satisfação do cliente

**Agente de Recrutamento**:
- Matching motorista x vaga
- Análise de perfil
- Campanhas personalizadas
- Prevenção de churn

**Agente de BI**:
- Análises preditivas
- Detecção de anomalias
- Relatórios automáticos
- Insights acionáveis

**Agente de Roteirização**:
- Otimização contínua
- Machine learning aplicado
- Consideração de variáveis externas
- Reagendamento dinâmico

#### 🔒 **Segurança e Governança**
- Logs auditáveis
- Controle de acesso
- Aprovações por workflow
- Compliance automatizado

## 5. ACHADOS DO DIAGNÓSTICO ATUAL

### 🚨 Problemas Críticos Identificados

#### **Arquivos Monolíticos**:
- **PortalCliente.tsx**: 5.553 linhas / 322KB
  - Múltiplas responsabilidades em um arquivo
  - Dificuldade de manutenção
  - Performance comprometida
  - Necessita refatoração em micro-módulos

#### **Dados Mock vs Real**:
- **EscalaLista.tsx**: 1.980 linhas com mocks hardcoded
  - Dados fictícios em produção
  - Não reflete realidade operacional
  - Precisa migração para Supabase

#### **Duplicação de Código**:
- **IAAutomacoes.tsx e IaAutomacao.tsx**: Componentes duplicados
- **BancoTalentos.tsx**: Existe em `/pages` e `/components`
- Violação do princípio DRY

#### **Inconsistências de Persistência**:
- **App Prestador**: Lê dados mas ações não salvam no Supabase
- **Portal Cliente**: Usa localStorage em vez de persistência real
- **Financeiro.tsx**: Mocks em Recibos e Rentabilidade

#### **Débito Técnico**:
- **40+ scripts de debug** na raiz do projeto
- **Logística Reversa/Reentregas**: Apenas placeholders
- **Provisões/Centro de Resultado**: Em desenvolvimento incompleto

### ✅ Pontos Positivos Identificados

#### **Infraestrutura Sólida**:
- Supabase integrado e funcional
- TypeScript configurado
- Build pipeline estável
- Sistema de autenticação funcional

#### **Componentes Reutilizáveis**:
- Biblioteca Shadcn/UI implementada
- Componentes base bem estruturados
- Sistema de temas consistente

#### **Fundação para IA**:
- Estrutura para agentes inteligentes
- Integração com OpenRouter
- Base para automações

## 6. ORDEM DE PRIORIDADE RECOMENDADA

### 🚀 **Fase 1 - Estabilização (Concluída)**
1. ✅ **Corrigir e estabilizar build**
2. ✅ **Documentação mestre**

### 🏗️ **Fase 2 - Base Operacional**
3. **Operação/Escala** - Coração do sistema
4. **OS/OC** - Base transacional
5. **App Prestador** - Interface crítica

### 🎯 **Fase 3 - Inteligência e Automação**
6. **Recrutamento Inteligente** - Diferencial competitivo
7. **Central de Automações** - Orquestração

### 💰 **Fase 4 - Financeiro**
8. **Financeiro Cliente** - Receita
9. **Financeiro Prestador** - Custos

### 📱 **Fase 5 - Experiência Digital**
10. **Portal Cliente** - Refatoração completa
11. **Relatórios/PDFs** - Comunicação profissional

### ⚖️ **Fase 6 - Compliance**
12. **Fiscal CT-e/MDF-e/NFSe** - Obrigações legais
13. **WhatsApp/n8n/IA** - Automação de comunicação

### **Critérios de Priorização**:
- **Impacto no Core Business**: Operação > Financeiro > Portal
- **Dependências Técnicas**: Base antes de automações
- **ROI Esperado**: Automações de alto impacto primeiro
- **Complexidade vs Valor**: Quick wins seguidos de projetos estruturais

## 7. ESTRATÉGIA DE IA POR TIPO DE TAREFA

### 🎯 **Claude Sonnet** - Tarefas Críticas de Backend
**Ideal para**:
- Desenvolvimento de serviços Supabase
- Arquitetura de sistemas complexos
- Regras fiscais e compliance
- Refatorações críticas (PortalCliente.tsx, EscalaLista.tsx)
- Edge Functions e integrações
- Lógica financeira sensível

**Evitar para**:
- Design de interfaces
- Textos marketing
- Tarefas triviais

### 🎨 **GPT-4.1 / GPT-5** - Experiência do Usuário
**Ideal para**:
- Design de interfaces premium
- UX/UI optimization
- Textos e comunicação
- Dashboards executivos
- Componentes visuais complexos
- Experiência mobile

**Evitar para**:
- Lógica fiscal crítica
- Integrações bancárias
- Refatorações arquiteturais

### 📊 **Gemini 2.5 Pro** - Análise e Documentação
**Ideal para**:
- Auditoria de código large-scale
- Análise de contexto amplo
- Documentação técnica abrangente
- Revisões arquiteturais
- Análise de performance
- Mapeamento de dependências

**Evitar para**:
- Desenvolvimento de features específicas
- Correções pontuais
- Implementações críticas de negócio

### ⚡ **DeepSeek** - Tarefas de Manutenção
**Ideal para**:
- Correções pequenas e ajustes
- Algoritmos não-críticos
- Testes automatizados
- Refatorações simples
- Documentação de código
- Linting e formatting

**Evitar para**:
- Módulos fiscais
- Integrações bancárias
- Lógica financeira
- Refatorações arquiteturais
- Componentes críticos de negócio

### 🚫 **Modelos Fracos - Nunca Usar Para**:
- **Fiscal**: CT-e, MDF-e, NFSe, cálculos tributários
- **Financeiro**: Repasses, cobranças, conciliação
- **Arquitetura**: PortalCliente.tsx, EscalaLista.tsx
- **Integrações Críticas**: Supabase, APIs bancárias
- **Compliance**: LGPD, auditoria, segurança

## 8. COMO TRABALHAR DAQUI PARA FRENTE

### 📋 **Metodologia por Módulo**

#### **1. Diagnóstico** (Claude Sonnet)
- Análise do estado atual
- Identificação de débitos técnicos
- Mapeamento de dependências
- Estimativa de esforço

#### **2. Planejamento** (Gemini 2.5 Pro)
- Arquitetura detalhada
- Quebra em épicos/stories
- Definição de interfaces
- Plano de testes

#### **3. Schema/Banco** (Claude Sonnet)
- Modelagem de dados
- Migrations Supabase
- Índices e performance
- RLS (Row Level Security)

#### **4. Serviços** (Claude Sonnet)
- Lógica de negócio
- Edge Functions
- Integrações externas
- Validações e regras

#### **5. Frontend** (GPT-4.1)
- Interface de usuário
- Componentes reutilizáveis
- Estados e contextos
- UX otimizada

#### **6. Integração** (Claude Sonnet)
- Conexão frontend-backend
- Testes de integração
- Fluxos end-to-end
- Tratamento de erros

#### **7. Testes** (DeepSeek + Claude Sonnet)
- Testes unitários
- Testes de integração
- Cenários de negócio
- Performance testing

#### **8. Build e Deploy** (CloudeClaude Sonnet)
- Configuração de build
- CI/CD pipeline
- Monitoramento
- Logs e observabilidade

#### **9. Documentação** (Gemini 2.5 Pro)
- Documentação técnica
- Guias de usuário
- Runbooks operacionais
- Troubleshooting

### 🔄 **Fluxo de Desenvolvimento Contínuo**

#### **Check-list Obrigatório Antes de Commit**:
```bash
# 1. Verificação de tipos
npx tsc --noEmit

# 2. Build de produção  
npm run build

# 3. Testes (quando disponíveis)
npm test

# 4. Linting
npm run lint

# 5. Verificação de performance
npm run analyze
```

#### **Padrão de Commits**:
```
tipo(escopo): descrição concisa

feat(operacao): implementar escala automática
fix(app-prestador): corrigir salvamento no supabase  
refactor(portal): dividir PortalCliente.tsx em módulos
docs(readme): atualizar documentação de setup
```

#### **Code Review Obrigatório**:
- **Arquitetura**: Aprovação de arquiteto sênior
- **Fiscal/Financeiro**: Double check obrigatório
- **Integrações**: Testes em ambiente de staging
- **Performance**: Análise de bundle size

### 📈 **Métricas de Sucesso**

#### **Técnicas**:
- Build time < 60s
- Bundle size < 5MB
- TypeScript errors = 0
- Test coverage > 80%
- Performance score > 90

#### **Negócio**:
- Tempo de operação reduzido em 50%
- Erros manuais < 1%
- Satisfação do cliente > 95%
- Automação > 80% dos processos
- ROI > 300% em 12 meses

---

## 🎯 **PRÓXIMOS PASSOS IMEDIATOS**

1. **Validar este documento** com stakeholders
2. **Escolher o primeiro módulo** (recomendado: Operação/Escala)
3. **Executar o Prompt 3** para diagnóstico detalhado
4. **Definir equipe e responsabilidades**
5. **Setup de ambiente de desenvolvimento**

---

**Documento criado em**: {{ new Date().toLocaleDateString('pt-BR') }}  
**Versão**: 1.0  
**Status**: ✅ Aprovado para execução  
**Próximo milestone**: Diagnóstico Módulo Operacional