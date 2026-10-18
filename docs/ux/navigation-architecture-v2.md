# Arquitetura Oficial de Navegação (v2)
**Projeto:** TMS Conexão Express Enterprise
**Status:** Consolidação Arquitetural (Sem Implementação)

---

## 1. Visão Geral

Este documento estabelece a versão consolidada e definitiva da **Arquitetura Oficial de Navegação** do TMS Conexão Express Enterprise. Evoluindo a partir da v1, esta versão substitui regras excessivamente rígidas por princípios adaptativos, introduz o conceito de Workspaces para módulos de alta densidade e define acessos contextuais, garantindo que a arquitetura suporte a realidade operacional dinâmica do transporte sem esconder funcionalidades vitais.

---

## 2. Princípios Oficiais

1. **Adaptação Operacional:** A interface deve se adaptar à rotina do usuário. Módulos de uso contínuo priorizam velocidade e cliques reduzidos; módulos administrativos priorizam organização e categorização.
2. **Única Fonte da Verdade (SSOT):** O conceito e o nome de um escopo são imutáveis através da jornada (Sidebar → Breadcrumb → H1 → Aba).
3. **Descoberta sem Carga Cognitiva:** Funcionalidades não devem ser escondidas para atingir metas arbitrárias de interface, mas devem ser agrupadas logicamente quando a quantidade prejudicar a escaneabilidade.
4. **Preservação de Contexto:** A arquitetura permite e encoraja atalhos contextuais transversais (ex: acessar seguros dentro de frota) sem duplicar a administração do dado.

---

## 3. Hierarquia Oficial Revisada

A estrutura oficial define como a navegação se desdobra do macro ao micro:

1. **Sidebar:** Módulo Principal (ex: Financeiro Enterprise).
2. **Landing Page / Workspace (Opcional):** Áreas de alta densidade (ex: Receitas, Despesas).
3. **Tabs (Abas):** Funcionalidades irmãs do mesmo contexto (ex: Contas a Receber, Inadimplência).
4. **Subtabs (Exceções):** Filtros rápidos ou sub-visões operacionais muito específicas.

---

## 4. Critérios Adaptativos para Tabs e Agrupamentos

A antiga regra rígida de "7 a 9 itens" foi substituída pelo **Princípio Adaptativo**:
*Agrupar abas quando a quantidade, largura ou diversidade dos itens começar a prejudicar a leitura, a descoberta ou a velocidade operacional.*

**Critérios Objetivos:**
- **Manter Tabs Simples:** Quando as funções pertencerem ao mesmo fluxo cognitivo, couberem na tela sem scroll horizontal, e forem usadas sequencialmente no dia a dia (ex: Apoio Operacional).
- **Utilizar Tabs com Agrupamento / Workspace:** Quando houver mais de 10 abas ou quando as abas pertencerem a áreas de negócio distintas (ex: Contas a Receber vs. Contábil no Financeiro).
- **Utilizar Landing Page com Cards:** Para módulos estritamente de cadastro base ou configuração, onde a navegação entre telas não ocorre rapidamente em paralelo.

---

## 5. Conceito de Workspace

Módulos de altíssima complexidade (como o **Financeiro Enterprise**) utilizam **Workspaces** para organizar a interface.

**Hierarquia do Workspace:**
`Sidebar → Módulo → Workspace → Grupo Funcional → Tabs Operacionais`

**Exemplo Prático (Financeiro Enterprise):**
- **Workspace Visão Geral:** Dashboard, DRE, Fluxo, Rentabilidade, Margem.
- **Workspace Receitas:** Contas a Receber, Inadimplência, Recibos.
- **Workspace Despesas:** Contas a Pagar, Pagamento Prestadores, Remessas e Retornos CNAB.
- **Workspace Bancário:** Contas e Caixas, Conciliação, Extratos.
- **Workspace Contábil:** Plano de Contas, Centro Resultado, Provisões, Contabilidade.

*Regras do Workspace:*
- Não usar se o módulo possuir menos de 7 abas funcionais.
- A navegação entre workspaces do mesmo módulo deve ser visível (ex: menu secundário lateral ou switch no topo).

---

## 6. Módulos Centrais e Acessos Contextuais

Para evitar duplicidade e manter a coesão de dados transversais.

**Módulo Central:**
O local oficial onde o recurso é criado, configurado e administrado.
- *Exemplo:* **Seguros e Risco** (gestão de apólices, alertas, regras matriz).
- *Exemplo:* **Central de Robôs IA** (configuração de agentes, limites, governança).

**Acesso Contextual:**
Atalho dentro de outro módulo operacional que abre o Módulo Central **pré-filtrado** para o contexto atual, sem criar uma segunda fonte da verdade.
- *Exemplo em Frota:* Aba "Seguros" abre a apólice daquele veículo específico.
- *Exemplo em Recrutamento:* Aba "IA" abre os logs do agente específico de triagem.

---

## 7. Navegação Operacional de Alta Frequência

Módulos como **Apoio Operacional, Torre de Controle e Escala** exigem resposta imediata. Nestes casos:
- **Priorizar:** Menor quantidade de cliques, navegação paralela (Tabs) e URL direta.
- **Evitar:** Workspaces profundos, Landing Pages de Cards intermediárias ou recarregamentos (full reload) para alternar entre "OS" e "Escala".
- *Exceção Justificada:* "Controle de Pátio" pode abrir em nova rota/aba do navegador caso necessite de layout full-screen (tipo mapa/dashboard de docas), mas o link de retorno deve ser claro.

---

## 8. Persistência Futura de Contexto

A arquitetura prevê que, no futuro, o sistema lembre o estado do usuário.
- **Formato:** Armazenamento seguro de *Preferences* ou `sessionStorage`.
- **Limites:** Não restaurar dados sensíveis, formulários incompletos ou contextos bloqueados por alteração de permissão.
- **Estado Inicial (SSOT):** A URL é sempre o árbitro final. Se a URL não definir estado, a persistência atua.

---

## 9. Single Source of Truth sem Acoplamento Excessivo

Em vez de duplicar dicionários em múltiplos arquivos (`AppTopbar.tsx`, `sidebarData.tsx`), a arquitetura ideal prevê um **Registry Central de Navegação** futuro:
- Objeto único definindo: `id, título oficial, ícone, rota base, tabs filhas, permissão`.
- Componentes Sidebar, Breadcrumb e Tabs apenas consumirão esse Registry.
*(Não implementar na fase de adequação inicial, apenas projetar o código visando essa refatoração futura).*

---

## 10. Nomenclaturas Oficiais e Aprovações Pendentes

Nomes sugeridos que requerem aprovação antes da implementação:

| Nome Atual | Nome Proposto (V2) | Justificativa | Status Recomendado |
|---|---|---|---|
| Frota e Veículos / Gestão de Frota | **Gestão de Frota** | Unificação SSOT. "Veículos" já é uma aba interna. | Alterar |
| IA & Automações / Central IA | **Central de Robôs IA** | Unificar nomenclaturas espalhadas em Governança e Configurações. | Alterar |
| Apoio Operacional | **Apoio Operacional** | "Operação" (H1 atual) é muito genérico. "Apoio" reflete o Backoffice/TMS. | Manter |
| Cadastros Base | **Cadastros Base** | Já consagrado, mas precisa unificar o comportamento visual. | Manter |

---

## 11. Mapa Completo dos Módulos (Revisado)

- **Root:** Dashboard Executivo | Torre de Controle
- **Operação:** Gestão Comercial | Apoio Operacional | Gestão de Frota | Cadastros Base
- **Finanças:** Financeiro Enterprise | Fiscal & Faturamento
- **Apoio:** Recrutamento Inteligente | Contratos Automáticos | Biblioteca Global | SLA e Qualidade | Seguros e Risco
- **Governança:** Central de Comunicação | API e Integrações | Governança e TI | Configurações (Central IA)

---

## 12. Matriz de Inconsistências e Implementação Futura

| Prioridade | Módulo | Inconsistência Atual | Decisão Arquitetural | Arquivos Envolvidos (Estimativa) | Risco | Validação |
|:---:|---|---|---|---|:---:|---|
| **P0** | Comercial, Frota, Biblioteca | Sidebar linka para tabs (`?tab=`) inexistentes nos componentes. | Corrigir os links do `sidebarData` para mapear exatamente as `<TabsTrigger>` reais. | `sidebarData.ts`, `Frota.tsx`, `Biblioteca.tsx` | Baixo | Roteamento |
| **P0** | Cadastros Base | Sidebar passa `?tab=`, mas a página é um Grid que ignora. | Remover tabs do submenu no Sidebar OU transformar a página em Tabs reais. | `sidebarData.ts`, `Cadastros.tsx` | Médio | Fluxo Usuário |
| **P1** | Financeiro Enterprise | 20 abas na mesma linha (Sobrecarga). | Implementar conceito de Workspaces (Visão Geral, Receitas, etc). | `Financeiro.tsx`, `sidebarData.ts` | Alto | Regras e Componentes |
| **P1** | Operação | Funcionalidade "Solicitações" existe, mas é órfã no Sidebar. | Incluir "Solicitações" no menu lateral para descoberta. | `sidebarData.ts` | Baixo | Visualização |
| **P2** | Global | Títulos H1 diferem do Breadcrumb. | Atualizar `<h1/>` de todas as páginas para ler do dicionário oficial. | `Operacao.tsx`, `Financeiro.tsx`, etc | Baixo | Estética |
| **P3** | Seguros, Robôs | Duplicados na raiz e dentro de outros módulos. | Transformar as versões internas em **Acessos Contextuais** linkando para o Módulo Central com filtro. | Vários | Médio | Navegação e Filtros |

---

## 13. Plano de Migração Segura (Execução Futura)

**Fase 1: Correção P0 (Navegação Crítica)**
- Corrigir fallbacks silenciosos e submenus que levam para abas fantasmas.

**Fase 2: Sincronização Estrutural (P1 e P2)**
- Unificar Sidebar, Rota, H1 e Breadcrumb com as nomenclaturas aprovadas.

**Fase 3: Módulos Complexos e Workspaces (Financeiro e Cadastros)**
- Fatiar o Financeiro Enterprise nos Workspaces definidos. Adaptar Cadastros Base.

**Fase 4: Acessos Contextuais**
- Redirecionar os módulos duplicados (Seguros, IA) para a nova arquitetura contextual baseada em rota/estado.

**Fase 5: Persistência de Contexto (Futuro)**
- Desenvolver a camada de `sessionStorage` para restaurar o estado não sensível.

---

## 14. Critérios de Aceite da Arquitetura

- Nenhuma funcionalidade ou módulo existente é removido.
- O fluxo rápido da equipe de Apoio Operacional não sofre adições de cliques.
- A divisão do Financeiro Enterprise não quebra ligações de negócio.
- O documento provê instrução clara e não-ambígua para a equipe de desenvolvimento.

---

## 15. Fora de Escopo

- Redesign visual de componentes.
- Alteração no banco de dados, APIs ou lógica financeira.
- Criação de novas funcionalidades além das listadas para organização arquitetural.
