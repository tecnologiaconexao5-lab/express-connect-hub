# Dashboard de Monitoramento de Conectores

## Visão Geral

O **Monitor de Conectores** (`/admin/conectores`) é o painel Enterprise para acompanhar em tempo real a saúde dos conectores Zoho Mail e WhatsApp em modo produção assistida.

## Acesso

- **Rota:** `/admin/conectores`
- **Sidebar:** API e Integrações > Monitor de Conectores
- **Permissão:** Usuários com papel `admin` ou `super_admin`

## Funcionalidades

### 1. Indicadores (KPIs)

| Indicador | Descrição |
|-----------|-----------|
| Execuções Hoje | Total de chamadas a conectores no dia atual |
| Falhas Hoje | Chamadas que retornaram erro |
| Pendências | Chamadas em andamento ou aguardando |
| Taxa de Sucesso | % de sucesso (verde ≥95%, amarelo ≥80%, vermelho <80%) |
| Conectores | Total de conectores ativos cadastrados |

### 2. Cards de Conectores

Cada conector ativo exibe:
- **Ícone** por tipo (EMAIL → envelope, WHATSAPP → balão)
- **Nome e provedor**
- **Modo atual** (HOMOLOGACAO, PRODUCAO_ASSISTIDA, etc.)
- **Saúde:**
  - 🟢 Online — última execução concluída com sucesso (modo real)
  - 🔴 Falhando — última execução falhou
  - 🟡 Pendente — sem execuções ou em andamento
  - 🔵 Simulado — última execução foi simulada (modo homologação)
- **Última execução** — data/hora

### 3. Logs de Execução

Aba "Logs de Execução" exibe as últimas 50 execuções com:

| Coluna | Descrição |
|--------|-----------|
| Data/Hora | Timestamp da execução |
| Conector | Nome + tipo (badge) |
| Ação | Ação executada (ex: enviar_email) |
| Status | Concluída, Falhou, Pendente, Cancelada |
| Duração | Tempo de execução (ms ou s) |
| Erro/Detalhe | Mensagem de erro ou "OK" |
| Ações | Botão "Reprocessar" para itens com falha |

### 4. Filtros

- **Busca textual** — por nome do conector, ação ou erro
- **Filtro por conector** — selecionar conector específico
- **Filtro por status** — Concluída, Falhou, Pendente, Cancelada
- **Botão "Limpar"** — remove todos os filtros

### 5. Reprocessamento

Para execuções com status `FALHOU`:
1. Clique em **Reprocessar** na linha do log
2. O sistema tenta executar novamente a mesma ação com os mesmos parâmetros
3. Se sucesso: status atualizado para CONCLUIDA, log registrado
4. Se falhar: status mantido como FALHOU, erro atualizado
5. Evita duplicidade: se já CONCLUIDA, bloqueia reprocessamento

### 6. Multi-tenant

- **Admin normal:** vê dados do seu tenant (RLS do Supabase)
- **Super Admin:** badge roxo "Super Admin" exibido no topo, pode ver dados de todos os tenants

## Segurança

- Nenhum token, client secret, refresh token ou API key é exibido
- Payload sensível não é mostrado na tabela
- Logs seguem as policies RLS do Supabase
- Apenas usuários autenticados com papel admin ou super_admin acessam
