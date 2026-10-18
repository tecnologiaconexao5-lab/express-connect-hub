# Arquitetura Oficial de Navegação (v1)
**Projeto:** TMS Conexão Express Enterprise
**Status:** Definição Arquitetural (Sem Implementação)

---

## 1. Visão Geral e Princípios (UX Enterprise)

Este documento estabelece a **Arquitetura Oficial de Navegação** do TMS. Ele atua como o *Single Source of Truth* (SSOT) para todas as interfaces do sistema. 

**Princípios Fundamentais:**
1. **Paridade Estrita:** Se um termo é usado no Sidebar, ele **deve** ser idêntico no Breadcrumb, no Título da Página (H1) e no nome da Aba.
2. **Previsibilidade:** O usuário deve saber se um clique o levará a uma nova página completa (via Card) ou se apenas alterará o contexto atual (via Tabs).
3. **Carga Cognitiva Reduzida (Lei de Miller):** Nenhum nível de navegação (como abas ou submenus) deve ultrapassar de 7 a 9 itens visíveis simultaneamente. Módulos complexos exigem agrupamentos lógicos secundários.
4. **Sem Beco Sem Saída:** O Breadcrumb deve sempre permitir o retorno a qualquer nível superior hierárquico, acompanhando a profundidade das abas.

---

## 2. A Hierarquia Oficial de Navegação

Abaixo está o mapa oficial da arquitetura. Todo o código futuro (rotas, sidebarData, componentes) deve refletir **exatamente** esta estrutura e nomenclatura.

### 2.1. Módulos Estratégicos (Root)
| Módulo (Sidebar) | Ícone Oficial | Rota Base | Objetivo |
|---|---|---|---|
| **Dashboard Executivo** | `LayoutDashboard` | `/dashboard` | Visão C-Level. |
| **Torre de Controle** | `Radio` | `/torre-controle` | Operação em tempo real (Ao Vivo). |

### 2.2. Módulos Operacionais e Core
| Módulo (Sidebar) | Ícone Oficial | Rota Base | Submódulos (Tabs Internas) |
|---|---|---|---|
| **Gestão Comercial** | `Briefcase` | `/comercial` | CRM, Orçamentos, Propostas, Simulador, Tabela de Valores, Marketing |
| **Cadastros Base** | `Database` | `/cadastros` | *Utiliza Landing Page com Cards* → Clientes, Prestadores, Veículos, Regiões, Filiais, Unidades, Centros de Custo, Tabelas |
| **Apoio Operacional** | `ClipboardList` | `/operacao` | Ordens de Serviço, Escala, Solicitações, Roteirizador, Ocorrências, Evidências (POD), Reversas, Controle de Pátio |
| **Gestão de Frota** | `Car` | `/frota` | Veículos, Abastecimento, Manutenção, Documentos, Custos |

### 2.3. Módulos Financeiro e Fiscal
Devido à alta complexidade, o **Financeiro Enterprise** deve utilizar agrupamento (Sub-Tabs) para evitar 20 abas na mesma linha.

| Módulo (Sidebar) | Ícone Oficial | Rota Base | Grupo (Tab) → SubTabs |
|---|---|---|---|
| **Financeiro Enterprise** | `DollarSign` | `/financeiro` | **Visão Geral**: Dashboard, DRE, Fluxo, Rentabilidade<br>**Receitas**: Contas a Receber, Inadimplência, Recibos<br>**Despesas**: Contas a Pagar, Pagamento Prestadores, Remessas (CNAB)<br>**Bancário**: Contas & Caixas, Conciliação<br>**Contábil**: Plano de Contas, Centro Resultado, Provisões, Contabilidade |
| **Fiscal & Faturamento** | `FileText` | `/fiscal` | CT-e, MDF-e, Fechamento (Faturas), XMLs |

### 2.4. Módulos de Gestão e Suporte
| Módulo (Sidebar) | Ícone Oficial | Rota Base | Submódulos (Tabs Internas) |
|---|---|---|---|
| **Recrutamento Inteligente**| `UserPlus` | `/recrutamento` | Dashboard, CRM, Talentos, Prestadores, Documentos, Onboarding |
| **Biblioteca Global** | `Library` | `/biblioteca` | Manuais Operacionais, Arquivos Prestador, Arquivos Cliente, Templates, Mensagens Rápidas, Fluxos |
| **Contratos Automáticos** | `FileSignature` | `/contratos` | Construtor, Gerados, Anexos, Políticas |
| **SLA e Qualidade** | `Award` | `/sla` | Indicadores (SLA), NPS, Desempenho (Rotas), Ranking (Prestadores) |
| **Seguros e Risco** | `Umbrella` | `/seguros` | *Módulo Único de Seguros (Remover de Frota e Finanças)* → Apólices, Regras, Sinistros, Alertas |

### 2.5. Governança e Configurações
| Módulo (Sidebar) | Ícone Oficial | Rota Base | Submódulos (Tabs Internas) |
|---|---|---|---|
| **Central de Comunicação**| `MessageSquare`| `/central-comunicacao`| Caixa de Entrada, WhatsApp, Histórico, Disparos |
| **Governança e TI** | `ShieldCheck` | `/governanca` | Auditoria, Histórico, Permissões, LGPD, Empresas (Tenants) |
| **API e Integrações** | `Network` | `/integracoes` | Webhooks, Monitor Core, SEFAZ, ANTT/CIOT, Prefeituras |
| **Configurações** | `Settings` | `/configuracoes` | Geral, Empresa, Acessos, Central de Robôs IA |

---

## 3. Single Source of Truth (Sincronização Estrita)

A regra de ouro da arquitetura: **O Nome do Escopo é Imutável em Todos os Níveis.**

**Exemplo Prático (Apoio Operacional):**
1. **Sidebar Item:** `Apoio Operacional`
2. **URL:** `/operacao` (O slug pode ser curto, mas não deve aparecer na UI)
3. **Breadcrumb:** `Home > Apoio Operacional`
4. **Título da Página (H1):** `Apoio Operacional`
5. **Sidebar Sub-item clicado:** `Ordens de Serviço`
6. **URL Parâmetro:** `/operacao?tab=ordens-servico`
7. **Breadcrumb Atualizado:** `Home > Apoio Operacional > Ordens de Serviço`
8. **Nome da Aba (TabTrigger):** `Ordens de Serviço`

*Nomes proibidos devido à dissonância:* Sidebar diz "Gestão de Frota" e a página diz "Frota e Veículos". A partir de agora, ambos serão **"Gestão de Frota"**.

---

## 4. Regras de Navegação e Componentes

| Padrão / Componente | Quando Utilizar | Quando NÃO Utilizar |
|---|---|---|
| **Sidebar (Menu Lateral)** | Módulos raízes que representam pilares do sistema. | Nunca utilizar para funções específicas (ex: "Criar Cliente"). |
| **Submenus (no Sidebar)** | Apenas para módulos que usam Abas e têm até 8 opções. | Não utilizar para módulos cuja landing page seja um Grid de Cards (ex: Cadastros Base). |
| **Abas Superiores (Tabs)** | Navegação horizontal dentro de um mesmo contexto modular. | Quando houver mais de 8 itens (Excesso Cognitivo). Nesse caso, usar Sub-Tabs ou Menu Lateral Interno. |
| **Parâmetros `?tab=`** | Para sincronizar a URL com a aba ativa, permitindo link direto. | Nunca criar um parâmetro de aba que não corresponda a uma `<TabsTrigger>` real na página. |
| **Cards de Navegação** | Landing pages de módulos de alta densidade (ex: Cadastros Base, Configurações). | Quando o conteúdo principal puder ser exibido diretamente na primeira aba do módulo. |
| **Breadcrumb (Pão-de-migalha)** | Em todas as páginas. Deve ler os `searchParams` para renderizar até 3 níveis. | Não usar apenas para mostrar o módulo raiz se o usuário já navegou para uma aba profunda. |

---

## 5. Experiência do Usuário (Cognitiva)

- **Descoberta vs Sobrecarga:** Submenus no Sidebar ajudam na descoberta, mas se o usuário clica em "Gestão Comercial > Orçamentos" e se depara com 15 abas na tela, ele se sentirá perdido. A interface deve ser progressiva.
- **Previsibilidade de Ação:** 
  - Submenu do Sidebar -> Troca a URL, recarrega o módulo com a Aba ativa.
  - Clicar numa Aba na tela -> Troca o parâmetro da URL suavemente, atualiza o conteúdo local.
- **Remoção de Ambiguidade:** Funcionalidades transversais (ex: "Seguros" ou "Central de Robôs") devem existir como módulos independentes. Não devem estar espalhadas em abas dentro de Financeiro, Frota e Configurações simultaneamente.

---

## 6. Padronização de Interface

- **Títulos H1:** Devem incluir o Ícone Oficial do Módulo ao lado do texto.
  - `<Icon className="w-8 h-8 text-primary" /> <h1>Gestão de Frota</h1>`
- **Descrições:** Toda página deve ter um subtítulo (`<p className="text-muted-foreground">`) de no máximo 1 linha explicando o escopo do módulo.
- **Botões de Ação Principal (CTAs):** Devem sempre ficar no canto superior direito do cabeçalho da página, alinhados horizontalmente com o Título H1.
- **Ícones de Abas:** Todas as abas (Tabs) devem possuir um ícone de 16x16px (`w-4 h-4`) ao lado do rótulo para facilitar a identificação visual rápida.

---

## 7. Escalabilidade e Crescimento Futuro

Para adicionar um novo módulo no futuro (ex: **WMS - Armazéns**), a arquitetura exige:
1. Cadastrar o Módulo Raiz no `sidebarData.ts` (ex: "Gestão de Armazéns").
2. Adicionar o roteamento em `App.tsx` (`/armazens`).
3. Cadastrar no dicionário `ROTA_TITULOS` do `AppTopbar.tsx` (ex: `{ titulo: "Gestão de Armazéns", icone: Package }`).
4. Criar a página `Armazens.tsx` com o H1 idêntico: "Gestão de Armazéns".
5. Se possuir mais de 8 telas, não usar Tabs. Criar uma Landing Page de Cards (modelo "Cadastros Base").
6. Se possuir menos de 8 telas, usar Tabs e mapear os `searchParams (?tab=)` no array `children` do Sidebar.

Esta arquitetura garante que, mesmo que o TMS triplique de tamanho, a carga cognitiva do usuário permanecerá constante e a navegação será sempre previsível.
