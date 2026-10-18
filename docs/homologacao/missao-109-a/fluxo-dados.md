# MISSÃO 109-A — Fluxo de Dados OS → Escala → Alocação → Aceite

## Visão Geral

```
TMS cria OS (status: pendente)
  │
  ├─ sincronizarComEscala() se prestador+data+veiculo presentes
  │    └─ INSERT alocacoes_escala (status: aguardando_aceite, aceite_prestador: false)
  │
  ├─ Operador envia OS para Rede
  │    └─ INSERT rede_oportunidades (status: publicada)
  │
  └─ App Motorista vê oportunidade
       ├─ ACEITA: f_aceitar_oportunidade_rede() → alocacao (status: aceita, aceite: true)
       └─ RECUSA: recusarAlocacao() → alocacao (status: recusada)
```

## Tabelas Envolvidas

### ordens_servico (fonte de verdade para status da OS)
- Status: `rascunho | pendente | agendada | em_andamento | em_rota | coletado | entregue | finalizada | cancelada | ocorrencia`
- `cliente_id` (UUID FK → clientes)
- `prestador_id` (UUID FK → prestadores)
- `tenant_id` (UUID FK → tenants)

### alocacoes_escala (fonte de verdade para status da escala, alocação e aceite)
- Status: `planejada | aguardando_aceite | aceita | recusada | em_rota | concluida | cancelada | ocorrencia`
- `aceite_prestador` (boolean, default false)
- `data_aceite` (timestamptz, nullable)
- `prestador_id` (UUID FK → prestadores)
- `ordem_servico_id` (UUID FK → ordens_servico)
- `tenant_id` (UUID FK → tenants)
- `placa` (text)
- `tipo_veiculo` (text)

### historico_alocacoes_escala (eventos)
- Trigger `trg_registrar_historico_alocacao` cria eventos automaticamente:
  - `mudanca_status` quando status muda
  - `aceite_prestador` quando aceita
  - `finalizacao` quando finalizada

## Aceite

| Campo | Local | Valor inicial | Valor pós-aceite |
|-------|-------|---------------|-------------------|
| `status` | `alocacoes_escala` | `planejada` ou `aguardando_aceite` | `aceita` |
| `aceite_prestador` | `alocacoes_escala` | `false` | `true` |
| `data_aceite` | `alocacoes_escala` | `null` | `NOW()` |

## Fluxo de Sincronização

- `sincronizarComEscala()` (ordemServicoService.ts): cria/atualiza alocacao quando OS tem prestador
- `sincronizarOSEscala()` (ordemServicoService.ts): sincroniza dados da escala de volta para OS
- Mapeamento de status entre OS e Escala via `escalaMapper.ts`

## Triggers Financeiros

- `trg_propagar_financeiro_alocacao`: propaga dados financeiros da alocação para `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os`
- `trg_propagar_financeiro_os`: propaga dados financeiros da OS
- `trg_cancelar_financeiro_escala`: zera financeiro quando escala cancelada
- `trg_cancelar_financeiro_os`: zera financeiro quando OS cancelada

## Arquivos Relevantes

| Arquivo | Função |
|---------|--------|
| `src/services/ordemServicoService.ts` | CRUD OS, sincronização com escala |
| `src/services/escala/escalaService.ts` | CRUD alocação, aceite, recusa, rota, finalização |
| `src/services/escala/escalaMapper.ts` | Mapeamento de campos |
| `src/services/escala/escalaAppPrestadorAdapter.ts` | Preparação de dados para App |
| `src/types/escala.ts` | Types e interfaces |
| `src/components/operacao/escalaStatus.ts` | Status helpers |
| `src/components/operacao/osTypes.ts` | OS types |
| `src/components/operacao/OrdemServicoForm.tsx` | Formulário OS (2760 linhas) |
| `src/components/operacao/EscalaLista.tsx` | Interface de escala (3195 linhas) |
| `src/lib/sidebarData.ts` | Dados da sidebar |
| `supabase/migrations/20260522_alocacoes_escala.sql` | Schema alocacoes_escala |
| `supabase/migrations/20260705_m84_rede_enterprise_prestadores.sql` | Schema rede oportunidades + RPC aceite |
| `supabase/migrations/20260711_m108e_fix_rpc_aceitar_cria_alocacao.sql` | Fix RPC aceite criar alocacao |
