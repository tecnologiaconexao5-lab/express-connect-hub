# RELATÓRIO UX-002 — ORDEM DE SERVIÇO E ORÇAMENTO EM FORMULÁRIO PREMIUM

**Data:** 2026-08-03
**Natureza:** Exclusivamente visual (UX/UI) — nenhuma regra de negócio alterada.

---

## 1. Objetivo

Reproduzir no formulário de **Ordem de Serviço (nova/edição)** e de **Orçamento Comercial (novo/edição)**
a experiência aprovada pelo proprietário: formulário destacado sobre a página, fundo escurecido, janela
centralizada (~96% largura / ~93% altura), fundo interno cinza-claro, detalhes e ações em laranja, **uma única
coluna lateral de contexto**, conteúdo por etapas, rodapé fixo e aparência corporativa premium.

---

## 2. Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `src/components/ui/enterprise.tsx` | Criados `PremiumDocumentDialog` e `PremiumDialogHeader`. Corrigido o **z-index** do overlay para `z-50` + render via portal em `document.body` (mesmo padrão do shadcn `Dialog` do "Gerenciar Alocação de Recurso"), de forma a cobrir o shell (sidebar `z-50`) **sem** esconder os dropdowns/diálogos internos (`Select`, `DropdownMenu`, `Dialog` — portais `z-50`) atrás do formulário. Import de `createPortal` e `X` adicionados. |
| `src/components/operacao/OrdemServicoForm.tsx` | Envolto em `PremiumDocumentDialog`; cabeçalho fixo `PremiumDialogHeader` (ícone, título dinâmico "Nova Ordem de Serviço"/"Ordem de Serviço", nº da OS, subtítulo, status, fechar); resumo horizontal (MetaChips + StatCards) no topo do workspace; **painel direito removido** e `ResumoOperacionalPanel` (Financeiro, Checklist, Pendências, Indicadores, Última Atualização) movido para a **única** coluna lateral esquerda; rodapé fixo preservado (`Cancelar`, `Salvar rascunho`, `Salvar OS`, `Avançar`). |
| `src/components/comercial/OrcamentoForm.tsx` | Mesmo padrão `PremiumDocumentDialog` + cabeçalho fixo (ícone, título "Novo Orçamento Comercial"/"Orçamento Comercial", nº, subtítulo, status, fechar); resumo horizontal; **painel direito removido** e `ResumoOrcamentoPanel` movido para a coluna esquerda; rodapé fixo e ações `Gerar PDF` / `Gerar Contrato` / `Converter em OS` mantidas nos pontos funcionais existentes. |
| `tests/e2e/missao_ux002_formulario_premium_os_orcamento.spec.ts` | Spec Playwright (2 descrições × 2 resoluções) — valida abertura do modal, cabeçalho, 1 sidebar, resumo, wizard, rodapé, cancelar/fechar; screenshots em `test-results/ux002` (guarda de QA — requer credenciais `PLAYWRIGHT_*`). |
| `AGENTS.md` | Resumo da missão adicionado. |

> **Nota funcional crítica resolvida:** o primeiro overlay usava `z-[70]`. Como `OrdemServicoForm` e `OrcamentoForm`
> usam `Select`, `DropdownMenu` e `Dialog` shadcn (portais em `z-50`), esse overlay deixaria dropdowns/diálogos
> invisíveis (atrás do modal). Corrigido para **portal no body + `z-50`**, o comportamento exato do shadcn `Dialog`
> que já cobre a sidebar e mantém os portais internos visíveis.

---

## 3. Componentes reutilizados (Gerenciar Alocação de Recurso / Design System existente)

| Componente | Origem | Uso |
|------------|--------|-----|
| `EnterpriseFormWorkspace` | `enterprise.tsx` (UX-001) | Contêiner interno do formulário (bg cinza-claro, cantos, sombra) |
| `EnterpriseWorkspaceHeader` | `enterprise.tsx` | Faixa clara do resumo horizontal / topo do workspace |
| `EnterpriseFormBody` | `enterprise.tsx` | Área `flex lg:flex-row` com sidebar + conteúdo principal |
| `EnterpriseContextSidebar` | `enterprise.tsx` | **Única** coluna lateral de contexto |
| `EnterpriseMainContent` | `enterprise.tsx` | Área central scrollável (edição/formulários) |
| `EnterpriseStepStrip` | `enterprise.tsx` | Faixa do wizard de etapas |
| `EnterpriseWorkspaceFooter` | `enterprise.tsx` | Rodapé fixo dentro do formulário |
| `FormSectionCard` | `premium-document.tsx` | Cards brancos com cabeçalho (ícone + título + subtítulo + borda) |
| `DocStepNavigation` | `premium-document.tsx` | Wizard premium (ativos laranja / concluídos verde / pendentes cinza) |
| `Field`, `MetaChip`, `StatusCard`, `PanelSection`, `PanelRow` | `enterprise.tsx` | Campos e agrupamentos visuais |
| `SearchableSelect`, `EnderecoCompleto`, `Select`, `Tabs`, inputs shadcn | existentes | Bindings/campos **preservados sem alteração** |

---

## 4. Componentes criados

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `PremiumDocumentDialog` | `enterprise.tsx` | Overlay escuro (`z-50`, portal em `document.body`) + painel centralizado `h-[93vh] w-[96vw] max-w-[1800px]`, cantos arredondados, sombra corporativa, fundo interno cinza-claro. |
| `PremiumDialogHeader` | `enterprise.tsx` | Cabeçalho fixo do formulário (flex, borda inferior, botão de fechar `X`). |

> Apenas dois componentes compartilhados foram criados — reduzem duplicação dos dois formulários sem criar
> arquitetura global nova.

---

## 5. Checklist de funcionalidades preservadas

### Ordem de Serviço
- [x] Todos os campos (Nº OS, Data, Cliente, Tipo de Operação, Unidade, Carga, Veículo, Rotas/Paradas, Torre e Financeiro, Histórico, etc.)
- [x] Todas as etapas (1 Identificação · 2 Carga · 3 Veículo · 4 Rotas e Paradas · 5 Torre e Financeiro · 6 Histórico)
- [x] Classificação fiscal (CTE, XML, tomador, CSOSN, CFC, aliás)
- [x] Salvar OS / Salvar rascunho / Cancelar / Avançar (handlers originais `handleSalvar...`/`onVoltar`)
- [x] Status (operacional e financeiro) e badges
- [x] Integração Escala (diagnóstico de divergência) e Torre
- [x] Rotas e paradas
- [x] Financeiro (receita, custo, margem, margem %)
- [x] Histórico
- [x] Ações pós-salvamento: PDF Cliente/Prestador, Copiar/Enviar WhatsApp, Link Rastreio, OS Cliente/Prestador
- [x] Validações, alertas de cubagem e pendências fiscais
- [x] Painel lateral atualiza conforme os dados (contexto dinâmico)

### Orçamento
- [x] Todos os campos (Documento, Contexto Comercial, Carga, Veículo, Endereços, Valores, Documentos/PDF, Histórico)
- [x] Todas as etapas (1 Identificação · 2 Carga · 3 Veículo · 4 Endereços · 5 Valores · 6 Documentos e PDF · 7 Histórico)
- [x] Salvar / Salvar rascunho / Cancelar / Avançar
- [x] Geração de PDF e Contrato (mantidos nos pontos funcionais)
- [x] Converter em OS
- [x] Tabela de valores/utilizada
- [x] Valores, veículo, endereços, documentos, histórico
- [x] Validações

> Nenhum campo, botão, indicador ou etapa foi removido. Apenas **reposicionados** (painel direito → sidebar
> esquerda; resumo → faixa horizontal no topo do workspace).

---

## 6. Duplicidade visual removida

Antes havia um painel de resumo à direita e informações de contexto à esquerda. Agora:

- **Esquerda (única):** contexto geral (Dados principais + Prioridade/Status + Pendências + Resumo financeiro compacto).
- **Centro:** edição/formulários em cards, com wizard por etapas.
- **Topo do conteúdo central:** resumo horizontal compacto de indicadores rápidos (Prioridade, Status Op., Status Fin., Escala, Receita, Margem, Costo).
- **Painel direito:** eliminado — nenhuma informação citada deixou de existir.

---

## 7. Resultado dos testes

| Comando | Resultado |
|---------|-----------|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` | ✅ 36s, build ok (4778 módulos) |
| `npx vitest run` | ✅ 31/31 testes |

---

## 8. Screenshots

As 12 capturas obrigatórias são produzidas pelo spec `tests/e2e/missao_ux002_formulario_premium_os_orcamento.spec.ts`
e gravadas em `test-results/ux002/` (nomes previstos):

1. OS aberta em formulário premium
2. OS — coluna lateral
3. OS — wizard
4. OS — etapa Identificação
5. OS — etapa Veículo
6. OS — Rotas e Paradas
7. OS — rodapé fixo
8. Orçamento aberto em formulário premium
9. Orçamento — coluna lateral
10. Orçamento — etapa Valores
11. Orçamento — Docs e PDF
12. Comparação antes/depois (faixa superior + sidebar única vs. layout de dupla lateral)

> **Observação:** a execução E2E exige ambiente QA/dev com credenciais reais (`PLAYWRIGHT_*`) — conforme
> guard-rails do repositório (PRODUÇÃO bloqueia testes — MISSÃO 003 / M136-C.2). As capturas são geradas ao
> rodar o spec no ambiente apropriado.

---

## 9. Comparação antes / depois

| Aspecto | Antes (UX-001.2) | Depois (UX-002) |
|---------|------------------|------------------|
| Apresentação | workspace inline oculto pelo app | **modal premium** sobre overlay escuro, centralizado (96% × 93%) |
| Fundo da página | normal | escurecido + blur discreto, sem interação |
| Fundo interno | cinza-claro do workspace | confere cinza-claro `#F3F5F8`-like nos cards/áreas |
| Cabeçalho | interno do workspace | **fixo** no topo do modal (ícone, título, nº, status, fechar) |
| Coluna lateral | esquerda de contexto | **única** (contexto + painéis unificados) |
| Painel direito | existia (Resumo) | **removido**; conteúdo incorporado à esquerda + faixa horizontal |
| Wizard | barra de etapas | números circulares (ativo laranja / concluído verde / pendente cinza) |
| Rodapé | interno | **fixo** dentro do modal (Cancelar/Salvar rascunho/Salvar/Avançar) |
| Laranja | destaque pontual | destaca ação principal e etapa ativa |

---

## 10. Confirmação de preservação funcional

- **Nenhuma regra de negócio alterada** (Supabase, banco, SQL, RPC, RLS, trigger, API, payload, query, cálculo, handler, validação, permissão).
- **Nenhum campo, botão, indicador ou etapa removido** — apenas reposicionados.
- **Fluxos de salvamento / PDF / contrato / classificação fiscal / integração Escala / Torre / rotas internas** intactos.
- Alteração foi limitada a **composição e apresentação** via componentes 100% visuais.
- Corrigido o único defeito de z-index que poderia esconder `Select`/`Dropdown`/`Dialog` internos.