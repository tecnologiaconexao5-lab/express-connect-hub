# ETAPA 8 — Tracking

## Camada de Tracking (M62)

### Serviço
| Arquivo | Descrição |
|---------|-----------|
| `src/services/rastreamento/trackingService.ts` | `gerarLinkRastreio()`, `obterPosicaoAtual()`, `inscreverPosicaoEmTempoReal()`, `registrarPosicao()` |

### Componentes
| Componente | Função |
|-----------|--------|
| `PortalTrackingMap.tsx` (reescrito M62) | Mapa Mapbox real com marcador animado, `flyTo()`, InfoGrid (motorista, status, velocidade) |
| `CompartilharRastreioModal.tsx` | Gera link `/rastreamento/{token}`, envia por email |
| `OrdemServicoForm.tsx` | Botão "Link Rastreio" que chama `handleGerarLinkRastreio()` |
| `RastreamentoPublico.tsx` | Página pública de rastreio (sem caller — `criarLinkPublico()` nunca chamado) |

### Tabelas
| Tabela | Status |
|--------|--------|
| `portal_tracking_realtime` | ✅ Criada — populada via `trackingService.registrarPosicao()` |
| `eventos_oficiais` | Contém eventos de tracking |
| `entregas_protocolo` | GPS da entrega (latitude/longitude) — estático |

### Fluxo
```
App Motorista (GPS) → [não implementado] → portal_tracking_realtime
  → Realtime subscription (supabase.channel) → PortalTrackingMap
```

### Gargalos Conhecidos (M62)
1. **GPS não chega ao `portal_tracking_realtime`** — App Motorista (Flutter) não publica posição nesta tabela. Mapa exibe placeholder.
2. **`criarLinkPublico()` sem caller** — ninguém chama a função. `RastreamentoPublico.tsx` inalcançável.
3. **Precisão GPS hardcoded** — "~10m" fictício.
4. **Sem timestamp por evidência** — apenas `data_hora_entrega` global.
