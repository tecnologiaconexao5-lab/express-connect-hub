# MISSÃO 109-A1 — RELATÓRIO DE ERRO

## Erro Encontrado

**Fluxo**: Criação de OS exclusivamente pela interface do TMS
**Erro**: `400 Bad Request` ao salvar OS — `invalid input syntax for type date: ""`

## Detalhes do Erro

```
POST https://uwrvzsjtpgaifkktpepn.supabase.co/rest/v1/ordens_servico
Response: {"code":"22007","details":null,"hint":null,"message":"invalid input syntax for type date: \"\""}
```

A coluna `data` da tabela `ordens_servico` recebeu uma string vazia `""` em vez de uma data válida ou `null`.

## Causa Raiz

A função `toOSInsert()` em `src/lib/dbMappers.ts:1134` mapeia campos do formulário para o banco usando o helper `s = (v: any) => v || ""`. Para campos do tipo `date`, uma string vazia não é um valor válido no PostgreSQL.

O campo `data` (Data de Emissão) é preenchido automaticamente com a data atual no estado inicial (`dataHoje`), mas por algum motivo no fluxo de salvamento o valor chega como string vazia ao mapper.

## Arquivo e Função

| Item | Local |
|------|-------|
| Componente | `src/components/operacao/OrdemServicoForm.tsx:717` — `handleSalvar()` |
| Mapper | `src/lib/dbMappers.ts:1134-1136` — `toOSInsert()` |
| Helper problemático | `src/lib/dbMappers.ts:1139` — `const s = (v: any) => v || ""` |
| Tabela | `ordens_servico.data` (tipo `date`) |
| Erro Supabase | `22007` — invalid input syntax for type date |

## Erros Adicionais

1. **404 `set_tenant_context`**: A migration `20260710_m108a_fix_set_tenant_context_rpc.sql` não foi aplicada no Supabase, causando 404 ao chamar `rpc/set_tenant_context`. Impacta o TenantProvider no frontend que não consegue definir o contexto do tenant corretamente.

2. **RLS em clientes**: Os registros de clientes têm `tenant_id = null`. A política RLS `clientes_select_tenant` usa `tenant_id = current_tenant_id_safe()`, que retorna `'00000000-0000-0000-0000-000000000001'`. Isso faz `null = '00000000-...'` resultar em `FALSE`, escondendo clientes no SearchableSelect. Após aplicar a migration `set_tenant_context`, isso pode ser corrigido.

## Proposta de Correção

### Correção 1 — Data vazia no mapper (P0)

Em `src/lib/dbMappers.ts`, alterar os campos do tipo `date` para enviar `null` em vez de `""`:

```typescript
// Atual
if (has(form.data)) d.data = s(form.data);

// Correção proposta
if (has(form.data)) {
  d.data = form.data || null;
}
```

Ou criar um helper específico para datas:
```typescript
const dt = (v: any) => (v && v.trim() ? v : null);
```

E alterar:
```typescript
if (has(form.data)) d.data = dt(form.data);
```

### Correção 2 — Migration pendente `set_tenant_context` (P1)

Aplicar a migration `20260710_m108a_fix_set_tenant_context_rpc.sql` no Supabase:
```bash
supabase db push
```
Ou executar o SQL diretamente no Supabase Studio > SQL Editor.

### Correção 3 — tenant_id em clientes (P2)

Atualizar `tenant_id` nos registros de clientes existentes:
```sql
UPDATE clientes SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;
```

## Evidências

- Screenshot do form com cliente selecionado: `docs/homologacao/missao-109-a1/04-cliente-selecionado.png`
- Logs Playwright com erro 400 capturado
- Resposta Supabase: `{"code":"22007","message":"invalid input syntax for type date: \"\""}`

## Impeditivo

🚫 **Missão bloqueada**: Não é possível criar OS pela interface sem corrigir o mapper de data. Sugere-se Missão 109-A2 para aplicar a correção 1 e reexecutar o fluxo completo.
