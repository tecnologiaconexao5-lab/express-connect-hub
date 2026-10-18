# M107 — eventProcessorWorker: Dependência de Browser

## Contexto

O `eventProcessorWorker` (iniciado em `App.tsx:83` com `setInterval(cicloProcessamento, 10000)`) processa eventos de `eventos_oficiais` que ainda não foram processados (`processed_at IS NULL`).

### O que funciona
- Worker é iniciado quando qualquer página do TMS carrega no browser
- Ciclo de 10s busca até 20 eventos pendentes, ordenados por `created_at`
- Processa `escala.alocacao.aceita` → atualiza `ordens_servico.status` para `em_andamento`
- Processa `escala.alocacao.recusada` → atualiza `ordens_servico.status` para `pendente`
- Marca eventos como processados (`processed_at`, `processed_by: "eventProcessorWorker"`)

### Problema
A execução **depende de o TMS estar aberto em um navegador**. Se nenhum usuário estiver logado no TMS web, o worker não roda e eventos ficam sem processar.

### Classificação
- **✅ Funcional para homologação** — durante testes manuais, o worker processa eventos corretamente enquanto o navegador está aberto
- **⚠️ Risco P1 para produção** — se o TMS não estiver aberto 24/7, eventos críticos (como aceite de motorista) não propagam para `ordens_servico.status`
- **📌 Pendência futura:** Mover o worker para execução server-side contínua usando a infraestrutura já existente (Edge Function ou worker PostgreSQL), sem depender do browser

### Recomendação
Não interromper homologação para criar nova arquitetura agora. O worker atende o cenário de uso durante o horário comercial. Para operação 24/7, migrar para:
1. Edge Function `process-event-worker` com `pg_cron` ou trigger SQL
2. Ou PostgreSQL trigger direto em `eventos_oficiais` (INSERT → processamento síncrono)
3. Ou script Node.js rodando em servidor (PM2/docker)
