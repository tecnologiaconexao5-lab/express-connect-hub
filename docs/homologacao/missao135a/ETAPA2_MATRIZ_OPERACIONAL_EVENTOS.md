# ETAPA 2 — Matriz Operacional de Eventos

## Fontes de Eventos

### SQL Triggers (produtivos — aplicados no Supabase)
| Migration | Eventos | Origem |
|-----------|---------|--------|
| M99 (20260705) | `eventos_oficiais` (tabela) | SQL trigger em `alocacoes_escala`, `ordens_servico`, `entregas_protocolo` |

### TypeScript (comentados/desativados)
| Arquivo | Chamada | Status |
|---------|---------|--------|
| `ordemServicoService.ts:4` | `// import { publicarEvento }` | ❌ Comentado |
| `podService.ts:3` | `// import { publicarEvento }` | ❌ Comentado |
| `escalaService.ts:15` | `// import { publicarEvento }` | ❌ Comentado |

## Event Types Definidos

### OS (Ordem de Serviço)
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `os.ordem_servico.criada` | OS criada | Dashboard, Notificação, Timeline, Fiscal |
| `os.ordem_servico.finalizada` | OS finalizada | Dashboard, Notificação, Timeline, Fiscal |
| `os.ordem_servico.cancelada` | OS cancelada | Dashboard, Timeline, Fiscal |
| `os.ordem_servico.status_changed` | Status alterado | — |
| `os.ordem_servico.rede_enviada` | Enviada para rede | — |
| `os.ordem_servico.rede_cancelada` | Cancelada na rede | — |

### Escala / Alocação
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `escala.alocacao.criada` | Alocação criada | Dashboard, Timeline |
| `escala.alocacao.aceita` | Motorista aceitou | Dashboard, Notificação, Timeline |
| `escala.alocacao.recusada` | Motorista recusou | — |
| `escala.alocacao.concluida` | Operação concluída | Dashboard, Notificação, Timeline |
| `escala.alocacao.cancelada` | Alocação cancelada | Dashboard, Timeline |
| `escala.alocacao.motorista_trocado` | Motorista substituído | — |
| `escala.alocacao.veiculo_trocado` | Veículo substituído | — |

### Entrega / POD
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `entrega.comprovante.pod_enviado` | POD enviado | — |
| `entrega.comprovante.foto_anexada` | Foto anexada | — |

### Financeiro
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `financeiro.receber.criado` | Conta a receber criada | — |
| `financeiro.receber.pago` | Conta recebida | — |
| `financeiro.pagar.criado` | Conta a pagar criada | — |
| `financeiro.pagar.pago` | Conta paga | — |

### Rede
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `rede.oportunidade.publicada` | Oportunidade na rede | — |
| `rede.oportunidade.aceita` | Oportunidade aceita | — |
| `rede.oportunidade.expirada` | Oportunidade expirou | — |

### Portal Cliente
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `portal.pedido.criado` | Pedido no portal | — |
| `portal.ocorrencia.aberta` | Ocorrência aberta | — |
| `portal.avaliacao.enviada` | Avaliação enviada | — |

### Fiscal
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `fiscal.cte.emitido` | CT-e emitido | Fiscal Timeline |
| `fiscal.nfse.emitida` | NFS-e emitida | Fiscal Timeline |

### Auth
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `auth.usuario.login` | Login | — |
| `auth.usuario.logout` | Logout | — |

### IA / Comunicação
| Event Type | Descrição | Adaptadores |
|-----------|-----------|-------------|
| `ia.robo.executou` | Robô IA executou | — |
| `comunicacao.mensagem.enviada` | Mensagem enviada | — |

## Consumidores de Eventos

### EventProcessorWorker
- **Arquivo**: `src/services/eventBus/eventProcessorWorker.ts`
- **Funcionamento**: Loop a cada 10s, busca eventos não processados, executa `processarEvento()`
- **Workers ativos**: Nenhum no frontend (workers estão em `src/services/*/`)
- **Tabela**: `eventos_oficiais`

### Adaptadores

| Adaptador | Uso | Consumido por |
|-----------|-----|---------------|
| `dashboardAdapter` | Converte evento para `DashboardEventoAdapter` | TabEventos |
| `fiscalAdapter` | Converte evento fiscal para timeline | CteTimeline |
| `timelineAdapter` | Converte evento para timeline | PortalCliente, Drawer |
| `notificacaoAdapter` | Converte evento para notificação | TabAlertas |

### Frontend
| Componente | Eventos consumidos |
|-----------|-------------------|
| `TabEventos.tsx` | Dashboard de eventos (via adapter) |
| `CteTimeline.tsx` | Timeline fiscal |
| `PortalDrawerPOD` | Timeline da entrega |
| `TabAlertas.tsx` | Notificações de eventos |

## Gargalos Identificados

1. **publicarEvento() comentado em 3 services** — eventos só são publicados por triggers SQL, não há publicação programática via TS
2. **EventProcessorWorker roda no frontend** — sem worker backend dedicado, processamento é client-side
3. **Adaptadores subutilizados** — apenas dashboardAdapter e timelineAdapter têm consumo real; notificacaoAdapter e fiscalAdapter têm consumo parcial
4. **Sem webhook de saída** — eventos processados não disparam ações externas

## Matriz de Severidade (DashboardAdapter)

| Evento | Severidade |
|--------|:----------:|
| `os.ordem_servico.criada` | baixa |
| `os.ordem_servico.finalizada` | baixa |
| `os.ordem_servico.cancelada` | media |
| `escala.alocacao.criada` | baixa |
| `escala.alocacao.aceita` | baixa |
| `escala.alocacao.concluida` | baixa |
| `escala.alocacao.cancelada` | alta |

## Conclusão
Event Bus (M99) implementado e operacional via SQL triggers. Componentes de frontend consomem eventos via adaptadores. Gargalo principal: publicação programática desativada (comentada) no TS.
