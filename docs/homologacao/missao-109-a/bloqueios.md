# MISSÃO 109-A — Bloqueios Conhecidos

## Bloqueios Identificados

### B1 — "Carregando sessão..." em rotas lazy-loaded
- **Descrição**: Navegação via `page.goto()` (full reload) para rotas lazy-loaded como `/financeiro`, `/relatorios`, `/contratos`, `/frota`, `/operacao` causa loop infinito "Carregando sessão...".
- **Causa raiz**: AuthContext `getSession()` não resolve quando há full page reload para rota lazy-loaded. O handler `INITIAL_SESSION` e fallback localStorage foram corrigidos na Etapa 3.3 da MISSÃO 54, mas o problema persiste.
- **Arquivo**: `src/contexts/AuthContext.tsx`
- **Contorno**: Navegação via sidebar (SPA) funciona perfeitamente.
- **Impacto**: Médio. Playwright precisa usar sidebar click em vez de `page.goto()`.

### B2 — Criação de OS via UI não automatizada
- **Descrição**: O formulário de criação de OS é complexo (2760 linhas) com muitos campos dinâmicos. A automação via Playwright para preencher todos os campos obrigatórios e salvar não foi possível dentro do escopo desta missão.
- **Causa**: Complexidade do formulário, múltiplos selects, autocomplete, dependência de dados mestre.
- **Contorno**: OS foi criada via Supabase API diretamente.
- **Impacto**: Baixo para o propósito desta missão (o dado existe no banco).

### B3 — Financeiro propagado antes do aceite
- **Descrição**: Os triggers M66/M104A propagam dados financeiros para `financeiro_receber` automaticamente ao criar uma alocação, mesmo antes do aceite do prestador.
- **Causa raiz**: O trigger `trg_propagar_financeiro_alocacao` é executado em INSERT/UPDATE de `alocacoes_escala` sem verificar se o aceite já ocorreu.
- **Arquivos**: `supabase/migrations/20260704_m66_fix_propagacao_financeira.sql`, `supabase/migrations/20260731_p0_propagacao_financeira_trigger.sql`
- **Impacto**: Pode gerar registros financeiros para operações não aceitas.

### B4 — Prestador TESTE APP sem veículo vinculado
- **Descrição**: O prestador `e6646799-fbac-453e-a3ef-afdfc01a7085` (PRESTADOR TESTE APP) não possui veículo vinculado diretamente na tabela `veiculos`. O veículo é definido apenas no campo `placa` e `tipo_veiculo` da alocação.
- **Impacto**: O App Motorista pode não exibir informações do veículo se buscar essa informação da tabela `veiculos`.

### B5 — Próxima etapa (Missão 109-B) depende do App Flutter
- **Descrição**: Não é possível testar o aceite do prestador sem o App Motorista Flutter. Este repositório contém apenas o TMS web. O App é um projeto externo.
- **Impacto**: A validação completa do fluxo de aceite depende da Missão 109-B.

## Recomendações para Correção

1. **B1**: Investigar o AuthContext para resolver o session loading em rotas lazy-loaded com full page reload.
2. **B2**: Criar testes Playwright específicos para o formulário de OS, ou simplificar a UI para permitir criação rápida por API.
3. **B3**: Adicionar condicional nos triggers financeiros para verificar `aceite_prestador` antes de propagar.
4. **B4**: Vincular um veículo real ao prestador TESTE APP na tabela `veiculos`.
