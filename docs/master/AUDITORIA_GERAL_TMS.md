# AUDITORIA GERAL TMS — CONEXÃO EXPRESS

> Data: 25/05/2026
> Status: Diagnóstico honesto e verificável

---

## 1. ESTADO REAL DOS MÓDULOS

| Módulo | Status | Visual | Dados | Testável sem dados? |
|--------|--------|--------|-------|---------------------|
| Dashboard Executivo | 🟡 Parcial | ✅ Profissional | Supabase + mock | Parcial |
| Torre de Controle | 🟡 Parcial | ✅ Profissional | Supabase puro | ❌ Não |
| Gestão Comercial/CRM | 🟡 Parcial | ✅ Profissional | Supabase puro | Parcial |
| Escala Operacional | 🟡 Parcial | ✅ Profissional | Supabase + localStorage | ✅ Sim |
| Ordem de Serviço | 🟢 Funcional | ✅ Profissional | Supabase puro | Parcial |
| Financeiro (geral) | 🟡 Parcial | ✅ Profissional | Supabase + mock parcial | Parcial |
| Financeiro Prestador | 🟡 Parcial | ✅ Profissional | Supabase puro | ❌ Não |
| Recrutamento | 🟡 Parcial | ✅ Profissional | Supabase puro | Parcial |
| Relatórios | 🟡 Parcial | ✅ Profissional | Supabase puro | ❌ Não |
| Portal Cliente | 🟡 Parcial | ✅ Profissional | Supabase + localStorage | ✅ Sim |
| Biblioteca | 🟢 Funcional | ✅ Profissional | Supabase + localStorage | ✅ Sim |
| Configurações | 🟢 Funcional | ✅ Profissional | Supabase + localStorage | ✅ Sim |
| IA/Automações | 🔴 Placeholder | ✅ Profissional | Supabase + mock | Parcial |

**Legenda:** 🟢 Funcional = opera com dados reais, 🟡 Parcial = depende de dados externos, 🔴 Placeholder = simulação/mock

---

## 2. MÓDULOS QUEBRADOS OU COM RISCOS

| Módulo | Problema | Causa | Impacto |
|--------|----------|-------|---------|
| **Escala Operacional** | Prestadores não aparecem | Erro silencioso no `loadPrestadores()` sem feedback | Usuário vê sidebar vazia sem saber por quê |
| **Escala Operacional** | Modo contingência ativo | Tabela `alocacoes_escala` não existe no Supabase | Dados ficam só no localStorage |
| **Escala Operacional** | Abas Métricas/Gráficos/Tabelas baixas | Container com altura fixa `h-[calc(100vh-230px)]` + conteúdo insuficiente | Espaço vazio excessivo |
| **Financeiro** | Provisões, Centro Resultado | Placeholder "Em desenvolvimento" | Botões não funcionam |
| **Relatórios** | Geração PDF sem dados | Service retorna vazio sem mensagem amigável | PDF pode ficar em branco |
| **IA/Automações** | Maioria dos recursos | Mock data + componentes visuais sem backend real | Botões salvam mas IA não executa |

---

## 3. TABELAS SUPABASE — LEVANTAMENTO

### Tabelas críticas (fundamentais para o sistema funcionar)

| Tabela | Módulo | Risco se ausente |
|--------|--------|-------------------|
| `alocacoes_escala` | Escala Operacional | 🛑 Escala funciona só em contingência |
| `prestadores` | Escala, OS, Financeiro | 🛑 Prestadores não carregam |
| `clientes` | Escala, OS, Financeiro | 🟡 Clientes não carregam |
| `ordens_servico` | OS, Torre, Financeiro | 🛑 Módulos travam |
| `pagamentos_prestadores` | Financeiro Prestador | 🛑 Financeiro trava |
| `financeiro_receber` | Financeiro | 🟡 Faturamento vazio |
| `financeiro_pagar` | Financeiro | 🟡 Contas vazias |
| `tabelas_valores` | Escala, OS, Comercial | 🟡 Preços não carregam |

### Tabelas com nome similar (risco de confusão)
- `alocacoes_escala` (principal) vs `escala_operacional` (legado/integração)

---

## 4. MELHORIAS REALIZADAS — CLASSIFICAÇÃO

### ✅ PERCEPTÍVEL (visível na tela)
- **KPI Cards** (P11): 7 cards de indicadores no topo da Escala
- **Timeline Operacional** (P9): Linha do tempo no modal de alocação
- **PrestadorCardSidebar** (P11): Cards de prestador com badge de recrutamento
- **Relatórios PDF**: Cabeçalho navy, cards financeiros, footer laranja
- **Alerta contingência** (P6): Banner amarelo "Modo contingência"
- **AlocacaoAcoesFinais**: Spinner "Salvando..." + botão desabilitado

### 🔧 TÉCNICA/INVISÍVEL (não visível mas estrutural)
- **Extrações de componentes** (P11-P19): ~700 linhas removidas do monolito
- **Validação de alocação** (P4): Valida campos antes de salvar
- **Detecção de conflitos** (P8): Impede duplicidade de prestador no mesmo dia
- **Realtime** (P5): Subscription Supabase para recarregar alocações
- **Correção de variáveis órfãs** (P16): 4 variáveis não definidas no KM/Fechamento
- **Correção TDZ** (urgente): `prestadores` declarado após uso (causava crash)
- **PDF template central** (P18): `pdfTemplateConexao.ts` com funções reutilizáveis

### 📋 PARCIAL
- **Controle KM/Fechamento**: Extraído mas com bugs pré-existentes de variáveis
- **Relatórios Financeiros**: Templates compartilhados mas RelatoriosEnterprise ainda inline

---

## 5. CÓDIGO MORTO OU NÃO CONECTADO

| Item | Local | Status | Ação |
|------|-------|--------|------|
| `AlocacaoFooter.tsx` | `escala/` | ✅ Removido (P19) | Já removido |
| `professionalPdfTemplate.tsx` | `src/lib/` | ❓ Não identificado | Verificar uso |
| `mockData.ts` | `dashboard/` | ⚠️ Usado como fallback | Manter (fallback seguro) |
| Mocks no Financeiro | `Financeiro.tsx` inline | ⚠️ Usado em abas placeholder | Manter até backend |

---

## 6. PRIORIDADE IMEDIATA

1. **🐛 CRÍTICO**: Erro silencioso no `loadPrestadores` — prestadores somem sem aviso
2. **🐛 CRÍTICO**: Tabela `alocacoes_escala` não existe — contingência permanente
3. **🎨 ALTO**: Abas da Escala (Métricas/Gráficos/Tabelas/Confirmações) com altura desproporcional
4. **🔧 MÉDIO**: `handleGerarRelatorioPagamento` inline sem logo (deveria usar template)
5. **🔧 MÉDIO**: RelatoriosEnterprise.tsx com drawHeaders inline duplicados

---

## 7. PLANO DOS PRÓXIMOS 10 PROMPTS

| # | Entrega | Perceptível? | Onde conferir | Risco |
|---|---------|-------------|---------------|-------|
| 1 | Corrigir `loadPrestadores` com toast de erro + feedback visual | ✅ Sim | Sidebar da Escala | Baixo |
| 2 | SQL para criar tabela `alocacoes_escala` + documentation | ⚠️ Indireto | Banco de dados | Baixo |
| 3 | Ajustar altura das abas Metrics/Gráficos/Tabelas/Confirmações | ✅ Sim | Abas da Escala | Baixo |
| 4 | Remover banner contingência quando tabela existir | ✅ Sim | Topo da Escala | Baixo |
| 5 | Centralizar inline PDFs da EscalaLista com template | ✅ Sim | Botão "Gerar PDF" | Médio |
| 6 | Adicionar mensagem "Nenhum dado" nos PDFs vazios | ✅ Sim | PDFs sem dados | Baixo |
| 7 | Corrigir layout das abas do Financeiro (proporção) | ✅ Sim | Financeiro | Baixo |
| 8 | Unificar drawHeaders do RelatoriosEnterprise | ✅ Sim | PDFs dos relatórios | Médio |
| 9 | Tratamento de erro consistente em todos os load* | 🔧 Técnico | Console | Médio |
| 10 | Documentação atualizada + logos oficiais | ✅ Sim | PDFs | Baixo |

---

## 8. REGRA OBRIGATÓRIA PARA PRÓXIMOS PROMPTS

Cada prompt DEVE responder antes de executar:
1. Esta mudança será perceptível visualmente? **SIM/NÃO**
2. Onde vou conferir? **(rota/botão/tela)**
3. O que deve aparecer diferente?
4. Qual botão/tela testar?
5. Qual risco de quebrar algo?
6. Qual arquivo principal será alterado?

E ao final:
1. O que mudou visualmente
2. Como conferir
3. Build ✅/❌
4. TypeScript ✅/❌
5. Console sem erro ✅/❌

---

## 9. RESUMO HONESTO

O TMS Conexão Express tem **código de qualidade profissional** (shadcn/ui, Tailwind, Recharts, jsPDF, animações Framer Motion), mas enfrenta problemas típicos de projeto em desenvolvimento:

1. **Visual é excelente** — todos os módulos parecem prontos profissionalmente
2. **Dados reais são o gargalo** — muitas telas precisam de tabelas Supabase com dados para mostrar valor
3. **Fallback localStorage é faca de dois gumes** — permite testar visual sem banco mas esconde problemas reais
4. **Escala operacional é o módulo mais maduro em termos de refatoração** (12 componentes extraídos) mas o que mais precisa de dados reais
5. **Não há módulo quebrado** — todos renderizam sem crash. O problema é funcionalidade vs dados disponíveis
