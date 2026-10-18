# CONTRATO — Portal Pedido → Ordem de Serviço (Missão 135-B)

## Tabela Oficial
`portal_pedidos` — tabela existente, sem segunda tabela de pedidos.

## Estados do Pedido
| Status | Descrição | Pode converter? |
|--------|-----------|:--------------:|
| `rascunho` | Cliente preenchendo formulário | ❌ |
| `enviado` | Pedido enviado pelo portal | ✅ |
| `em_analise` | Operação analisando | ✅ |
| `aprovado` | Aprovado pela operação | ✅ |
| `convertido` | OS gerada com sucesso | ❌ (já convertido) |
| `programado` | OS programada (legado) | ❌ |
| `coleta` | Em coleta | ❌ |
| `em_rota` | Em rota | ❌ |
| `entregue` | Entregue | ❌ |
| `rejeitado` | Rejeitado pela operação | ❌ |
| `erro_conversao` | Falha na conversão (permite retry) | ✅ (retry) |
| `cancelado` | Cancelado pelo cliente/operação | ❌ |

## Momento da Conversão
Pedido enviado → validação de campos obrigatórios → RPC `converter_pedido_para_os()` → OS criada em rascunho.

## Contrato Pedido → OS (Mapper)

| Campo Pedido | Campo OS | Transformação | Obrigatório |
|-------------|----------|---------------|:-----------:|
| `cliente_id` | `cliente` | UUID direto (FK clientes.id) | ✅ |
| `cliente_id` | `cliente_id` | UUID como TEXT (legado) | ✅ |
| `filial` | `unidade` | Direto | ❌ |
| `numero_pedido` | `numero_pedido` | Direto | ❌ |
| `id` | `pedido_portal_id` | FK bidirecional | ✅ |
| `coleta_cidade` + `coleta_uf` | `origem` | `"{cidade}/{uf}"` | ✅ |
| `entrega_cidade` + `entrega_uf` | `destino` | `"{cidade}/{uf}"` | ✅ |
| `descricao` | `carga_descricao` | Direto, fallback "Pedido Portal" | ❌ |
| `peso` | `peso` | Direto, default 0 | ❌ |
| `volumes` | `volumes` | Direto, default 1 | ❌ |
| `valor_declarado` | `valor_declarado` | Direto, default 0 | ❌ |
| `tipo_carga` | `tipo_carga` | Direto, default "seca" | ❌ |
| `observacoes` | `observacoes_gerais` | Direto | ❌ |
| `prioridade` | `prioridade` | Direto, default "normal" | ❌ |
| `coleta_data` | `data_programada` | Direto | ❌ |
| `tipo_carga`, `descricao`, etc | `carga` (JSONB) | Objeto estruturado | ✅ |
| — | `status` | Fixo "rascunho" | ✅ |
| — | `tipo_operacao` | Fixo "fracionado" | ✅ |
| — | `valor_cliente` | 0 (sem precificação na conversão) | ✅ |
| — | `custo_prestador` | 0 (sem precificação na conversão) | ✅ |

### Endereços (os_enderecos)
| Fonte | Tipo | Sequência | Destino |
|-------|------|:---------:|---------|
| `coleta_rua, coleta_numero, ...` | "coleta" | 0 | `os_enderecos` |
| `entrega_rua, entrega_numero, ...` | "entrega" | 1 | `os_enderecos` |

## Idempotência
- **Unique index**: `idx_portal_pedidos_os_vinculada_unique` — mesma OS não pode ser vinculada a dois pedidos
- **Verificação na RPC**: se `os_vinculada_id` não for nulo, retorna imediatamente com `success=true, created=false`
- **Sem trigger de banco** (a RPC já é a guardiã)
- **Clique duplo**: a segunda chamada retorna os dados já existentes (idempotente)

## Segurança
- RPC é `SECURITY DEFINER` com `SET search_path = public`
- Usa `current_tenant_id_safe()` para isolar tenant
- Valida status do pedido (apenas `enviado`, `em_analise`, `aprovado`)
- Valida campos obrigatórios (cidade de coleta e destino)
- Grant apenas para `authenticated`
- Cliente no Portal só vê próprio pedido via RLS

## Evento
Após conversão bem-sucedida, insere em `eventos_oficiais`:
```
event_type: 'portal.order.converted_to_service_order'
entity_type: 'portal_pedido'
entity_id: {os_id}
```

## Financeiro
- OS criada em `rascunho` — **não** dispara triggers financeiros (M66/M80)
- Financeiro só será gerado quando a OS for finalizada ou alocada
- Nenhum lançamento indevido é criado

## Escala/Rede/App
- OS em `rascunho` com `pedido_portal_id` vinculado
- Pode seguir para escala, alocação e app pelo fluxo existente
- `sincronizarComEscala()` reconhece o campo `ordem_servico_id`

## Erros
| Código | Causa | Ação |
|--------|-------|------|
| `PEDIDO_NAO_ENCONTRADO` | ID inválido | Verificar ID |
| `STATUS_INVALIDO` | Pedido em status não conversível | Aguardar validação |
| `CAMPOS_OBRIGATORIOS` | Sem cidade de coleta/destino | Preencher campos |
| `ERRO_CONVERSAO` | Erro interno do banco | Ver logs, tentar novamente |

## Rollback
Migration contém comandos de rollback comentados. Para reverter:
1. Remover RPC: `DROP FUNCTION converter_pedido_para_os`
2. Remover índices: `DROP INDEX idx_portal_pedidos_os_vinculada_unique`
3. Remover colunas de `ordens_servico` e `portal_pedidos`
4. Restaurar constraint de status original

## Sequência futura para Escala/Rede/App
1. Operador aprova pedido → status muda para "aprovado" ou "convertido"
2. OS em rascunho é atualizada para "pendente"
3. Operador cria alocação via EscalaLista ou `sincronizarComEscala()`
4. Alocação segue fluxo normal (app aceita → em rota → concluída)
5. Trigger M66 propaga financeiro
