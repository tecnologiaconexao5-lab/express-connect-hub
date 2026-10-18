# MISSÃO 135-B — DECLARAÇÃO OBRIGATÓRIA DE ESCOPO

## PROJETO
TMS / Portal do Cliente — React, TypeScript e Supabase.

## MÓDULO
Conversão de Pedido do Portal em Ordem de Serviço.

## ARQUIVOS PREVISTOS PARA ALTERAÇÃO

### Services
- `src/services/portalCliente/pedidosService.ts` — adicionar lógica de conversão segura
- `src/services/ordemServicoService.ts` — reutilizar `criarOrdemServico()` oficial

### Banco (Migration)
- `supabase/migrations/20260722_m135b_portal_pedido_para_os.sql` — adicionar colunas, RPC, índice, grants

### Portal Cliente
- `src/pages/PortalCliente.tsx` — atualizar status do pedido e OS vinculada

### TMS
- `src/components/operacao/OrdensServicoLista.tsx` — exibir origem Portal e pedido vinculado (quando aplicável)

### Tipos
- `src/components/operacao/osTypes.ts` — adicionar campo `pedido_portal_id` se necessário
- `src/types/portal.ts` — atualizar tipos do pedido se necessário

### Testes
- `docs/homologacao/missao135b/` — documentação + screenshots
- Testes SQL (scripts)
- Testes TypeScript
- Testes Playwright

## ARQUIVOS QUE NÃO SERÃO ALTERADOS
- App Motorista Flutter
- GPS, tracking, portal_tracking_realtime
- Link público de rastreio
- Torre de Controle
- Financeiro (salvo vínculo pedido→OS)
- Escala, Alocação, Rede de Oportunidades
- Coleta reversa, devoluções
- POD
- Contratos recorrentes já funcionais
- Identidade visual do Portal
- Central IA / Funcionários Digitais

## IMPACTO NO TMS
Pedido do Portal passará a gerar OS oficial pelo fluxo `pedidosService.criarPedido()` → RPC → `criarOrdemServico()`. TMS poderá visualizar pedidos com origem Portal e link para OS.

## IMPACTO NO PORTAL DO CLIENTE
Cliente verá status do pedido e número da OS gerada após conversão.

## IMPACTO NO APP PRESTADOR
Nenhuma alteração no Flutter. A OS gerada poderá seguir para Escala, Alocação, Rede e App pelo contrato já existente em missões futuras.

## RISCO DE REGRESSÃO

| Risco | Gravidade | Mitigação |
|-------|:---------:|-----------|
| Pedidos antigos sem vínculo | Baixa | RPC usa COALESCE, não quebra |
| Criação manual de OS duplicada | Média | UNIQUE + ON CONFLICT na RPC |
| Contratos recorrentes | Baixa | Sem alteração em contratos |
| Duplicidade de OS p/ mesmo pedido | **Alta** | UNIQUE(ordem_servico_id) em portal_pedidos + verificação na RPC |
| Financeiro indevido | Média | OS em rascunho não dispara trigger financeiro (M80 só em finalizada) |
| RLS | Média | RPC valida tenant_id e auth.uid() |
| Multi-tenant | Média | RPC usa current_tenant_id_safe() |
| Notificações | Baixa | Sem alteração no sistema de notificações |
| Portal Cliente | Média | Sem quebra visual, apenas novo status |

