# Ativação da Produção Autônoma (F3C)

## Modos de Operação

| Modo | Env | Comportamento |
|------|-----|--------------|
| `homologacao` | `=homologacao` | Simulado — nenhuma API externa chamada |
| `assistido` | `=assistido` | Real com fallback — erros viram pendente |
| `producao` | `=producao` | **Real direto — erros são reais, sem fallback** |

## Ativação

1. Configure as chaves de API no `.env`:
   ```env
   VITE_ZOHO_MODE=producao
   VITE_ZOHO_CLIENT_ID=seu_client_id
   VITE_ZOHO_CLIENT_SECRET=seu_client_secret
   VITE_ZOHO_REFRESH_TOKEN=seu_refresh_token
   VITE_ZOHO_ACCOUNT_ID=seu_account_id

   VITE_WHATSAPP_MODE=producao
   VITE_EVOLUTION_API_URL=https://seu-server.evolution.com
   VITE_EVOLUTION_API_KEY=sua-api-key
   ```

2. Execute a migration:
   ```bash
   npx supabase db push --include-all
   ```

3. Teste sem envio real: deixe `=assistido`, veja logs no dashboard `/admin/conectores`
4. Para ativar produção real: altere `=producao`

## Anti-duplicidade

- Toda execução gera `idempotency_key = sha256(conector_id + acao + JSON.stringify(payload))`
- Se já existe CONCLUIDA com mesma chave, a nova é bloqueada e marcada como `duplicata_bloqueada`
- Bloqueio visível no dashboard (card "Duplicatas Bloqueadas")

## Fila de Execução

- Execuções são criadas em status `SOLICITADA`
- Botão "Processar" no dashboard executa até 10 itens da fila
- Status da fila visível nos indicadores do dashboard
- Fila ordenada por `created_at ASC` (FIFO)

## Dashboard

Disponível em `/admin/conectores`:
- **Linha 1**: Execuções Hoje, Taxa Sucesso, Disponibilidade, Tempo Médio
- **Linha 2**: Falhas Hoje, Pendências (Fila), Duplicatas Bloqueadas, Conectores
- **Abas**: Dashboard (cards), Logs de Execução (tabela com filtros)
- **Ações**: Atualizar, Reprocessar (em execuções FALHOU), Processar Fila

## Rollback

Para voltar a modo simulado:
```bash
# Apenas alterar .env
VITE_ZOHO_MODE=homologacao
VITE_WHATSAPP_MODE=homologacao
```

Para remover a migration:
```sql
DROP INDEX IF EXISTS idx_ia_execucoes_conectores_idempotency;
ALTER TABLE ia_execucoes_conectores DROP COLUMN IF EXISTS idempotency_key;
```
