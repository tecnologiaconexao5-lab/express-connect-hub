# ETAPA 11 — Torre de Controle (NOC)

## Componente
**Arquivo**: `src/pages/TorreControle.tsx`

## Funcionalidades
| Funcionalidade | Descrição |
|---------------|-----------|
| Mapa Mapbox | Exibe OS em tempo real com coordenadas |
| Timeline de eventos | Feed de eventos operacionais filtrado por severidade |
| Alertas | Cards de alertas críticos (OS atrasadas, comprovantes pendentes) |
| Ações prioritárias | Lista de ações sugeridas baseadas em risco |
| Filtros | Por status, prestador, cliente, data |
| Estatísticas | Total OS, em rota, concluídas, atrasadas |

## Integrações
- `useEventosRealtime` — Realtime subscription em `eventos_oficiais`
- `calcularRiscoOperacional` — Calcula risco por OS
- `acoesPrioritarias` — Gera ações baseadas em estado operacional
- `TrackingPosition` — Posição de tracking (se disponível)

## Workers na Torre
| Worker | Intervalo | Função |
|--------|:---------:|--------|
| `eventProcessorWorker` | 10s | Processa eventos não processados da fila |

## Tabelas Consultadas
- `ordens_servico` (com JOINs para clientes, prestadores)
- `eventos_oficiais` (Realtime subscription)
- `alocacoes_escala` (para status de alocação)
- `entregas_protocolo` (comprovantes pendentes)

## Gargalos
1. Torre de Controle consome dados do TMS admin — não há visão unificada NOC com Portal Cliente
2. Mapbox mapa compartilhado com outros componentes — sem isolamento de tenant no frontend
3. Alertas baseados em polling/frontend, sem worker backend dedicado
