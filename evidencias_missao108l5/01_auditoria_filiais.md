# Auditoria de Filiais — Missão 108-L5

## Estrutura Encontrada

### PortalMultiFilial.tsx (432 linhas)
- **100% placeholder**: 5 unidades hardcoded (Matriz SP, Filial Mooca, Filial ABC, CD Interlagos, Unidade Zona Sul)
- Zero consultas a banco
- "Solicitar Nova Filial" é local-state apenas (não persiste)
- Não está no sidebar do Portal Cliente — apenas acessível via programação
- Prop `onSelectUnidade` com `handleVerFilial()` mockando dados falsos

### Tabela `filiais`
- Definida APENAS em bootstrap SQLs (`supabase_schema.sql`, `rebuild_supabase_schema.sql`, `sql/tabelas_auxiliares.sql`)
- Sem migration dedicada
- **Sem `cliente_id`** — não há relação direta cliente ↔ filial
- **Sem `tenant_id`** — sem isolamento multi-tenant
- **Sem RLS policies** — qualquer authenticated user pode acessar
- Schema inconsistente entre os 3 arquivos:
  - `supabase_schema`: nome, cnpj, ativo
  - `rebuild_supabase_schema`: +updated_at
  - `tabelas_auxiliares`: +razao_social, endereco, responsavel, contato, telefone, email, status (TEXT, não boolean)

### Tabela `unidades`
- FK `filial_id REFERENCES filiais(id)`
- Apenas em bootstrap SQLs, sem RLS

### Tabela `centros_custo`
- Sem FK para filiais ou unidades

### Como `ordens_servico` referencia filial
- `unidade` (TEXT) — armazena nome da filial/unidade
- `filial_origem` (TEXT) — origem alternativa
- `cliente` (UUID, FK to `clientes`) — vinculo com cliente
- Schema conflitante: rebuild schema tem `unidade_id` (UUID FK) mas deployed schema usa TEXT

### Conclusão
Não há relação formal cliente↔filial no banco. A filial de um cliente é **derivada** do campo `ordens_servico.unidade` agrupado por `cliente`. Esta é a abordagem adotada: `buscarFiliaisCliente()` consulta `ordens_servico` e agrupa por `unidade`, computando KPIs de `alocacoes_escala`, `financeiro_receber`, `contratos_operacao`, `portal_ocorrencias`.
