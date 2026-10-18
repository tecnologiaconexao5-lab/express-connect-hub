# Arquitetura Multi-Tenant — Express Connect Hub / TMS

> **Missao:** 14 | **Data:** 2026-06-26 | **Tipo:** Projeto de Arquitetura (sem codigo)

---

## 1. Modelo de Tenant Escolhido

### Decisao: `tenant_id` em tabelas compartilhadas (Shared Database, Shared Schema)

| Modelo | Vantagens | Desvantagens | Veredito |
|--------|-----------|-------------|----------|
| **tenant_id (escolhido)** | 1 migracao SQL, RLS resolve isolamento, Supabase nativo, custo unico | Precisa disciplina em toda query | ✅ |
| Schema por empresa | Isolamento total, backup individual | N schemas, RLS complexo, Supabase nao suporta bem | ❌ |
| Banco por empresa | Maximo isolamento | N bancos, custo N×, migracoes N×, impossivel escalar | ❌ |

**Justificativa:** O Supabase foi projetado para multi-tenant via RLS com `tenant_id`. Criar schemas ou bancos separados quebraria o modelo de autenticacao, realtime, storage e edge functions. Alem disso, o custo de manter N bancos no Supabase e proibitivo.

---

## 2. Tabelas que Recebem `tenant_id`

### P0 — Core (21 tabelas)
`ordens_servico`, `alocacoes_escala`, `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os`, `clientes`, `prestadores`, `veiculos`, `orcamentos`, `crm_leads`, `crm_historico`, `crm_followups`, `portal_pedidos`, `portal_ocorrencias`, `portal_faturas`, `contratos_gerados`, `fiscal_ctes`, `fiscal_nfse`, `fiscal_mdfes`, `despesas_operacionais`

### P1 — Suporte (15 tabelas)
`usuarios_cliente`, `financeiro_baixas`, `auditoria_operacional`, `historico_alocacoes_escala`, `entregas_protocolo`, `portal_notificacoes`, `contas_financeiras`, `configuracoes_sistema`, `configuracoes_fiscais`, `regras_fiscais_cte`, `regras_fiscais_nfse`, `certificados_fiscais`, `fiscal_historico_status`, `crm_interacoes_prestadores`, `treinamento_arquivos_ia`

### P2 — IA/Infra (35+ tabelas)
`ia_ferramentas`, `ia_execucoes_ferramentas`, `ia_conectores`, `ia_missoes`, `ia_metas`, `ia_trabalhos`, `memoria_entidades`, `memoria_eventos`, `automacoes_robos`, `automacoes_tarefas`, etc.

**Total: ~70 tabelas**

---

## 3. Estrategia RLS Multi-Tenant

### Nova Tabela: `tenants`
```sql
CREATE TABLE tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plano TEXT DEFAULT 'starter',
    ativa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Nova Tabela: `user_tenants` (many-to-many)
```sql
CREATE TABLE user_tenants (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    perfil TEXT DEFAULT 'operador', -- admin, financeiro, operador, comercial, cliente, motorista
    PRIMARY KEY (user_id, tenant_id)
);
```

### Politica RLS Universal (substitui o modelo atual)
```sql
-- Antes (Missao 01):
SELECT → anon
INSERT/UPDATE/DELETE → authenticated

-- Depois (Missao 14 — Multi-Tenant):
SELECT → authenticated + tenant_id = current_setting('app.tenant_id')
INSERT/UPDATE/DELETE → authenticated + tenant_id = current_setting('app.tenant_id')
```

### Fluxo de Isolamento
```
Usuario faz login → Supabase Auth retorna JWT com user_id
  → App consulta user_tenants → lista empresas do usuario
  → Usuario seleciona empresa → app seta current_setting('app.tenant_id')
  → TODA query SQL filtra por tenant_id = current_setting('app.tenant_id')
  → RLS garante: Empresa A nunca ve dados da Empresa B
```

---

## 4. Auth — Modelo de Usuario e Perfil

```
auth.users
  │
  ├── user_tenants (N:N)
  │     ├── tenant_id → tenants.id
  │     └── perfil: 'admin' | 'financeiro' | 'operador' | 'comercial' | 'cliente' | 'motorista'
  │
  └── raw_user_meta_data
        └── nome, telefone, avatar_url

tenants
  ├── nome: "Transportadora ABC Ltda"
  ├── slug: "transportadora-abc"
  ├── plano: "professional"
  └── config: JSONB { logo_url, cor_primaria, cor_secundaria, dominio_personalizado }
```

### Perfis e Permissoes (por tenant)

| Perfil | Cria OS? | Ve Fin? | Admin? | Acesso |
|--------|---------|---------|--------|--------|
| `admin` | Sim | Sim | Sim | Tudo da empresa |
| `financeiro` | Nao | Sim | Nao | Financeiro + Relatorios |
| `operador` | Sim | Nao | Nao | Operacao + Escala |
| `comercial` | Sim (orcamento) | Nao | Nao | CRM + Orcamentos |
| `cliente` | Nao | Proprio | Nao | Portal Cliente (suas OS) |
| `motorista` | Nao | Nao | Nao | App Motorista (suas escalas) |

---

## 5. Frontend — React Query Multi-Tenant

### Query Keys com Tenant
```typescript
// Antes:
["ordens_servico", page, pageSize]

// Depois:
[tenantId, "ordens_servico", page, pageSize]
```

### TenantProvider (React Context)
```typescript
const { tenant, setTenant, tenants } = useTenant();
// Disponivel em toda a arvore de componentes
```

### Troca de Empresa
```typescript
function TenantSwitcher() {
  const { tenants, tenant, setTenant } = useTenant();
  return (
    <Select value={tenant.id} onValueChange={(id) => {
      setTenant(id);
      queryClient.clear(); // Limpa cache ao trocar empresa
    }}>
      {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
    </Select>
  );
}
```

### Cache — Invalidação por Tenant
```typescript
// Invalida apenas dados da empresa atual:
queryClient.invalidateQueries({ queryKey: [tenantId] });
```

---

## 6. Integracoes Multi-Tenant

| Integracao | Adaptacao |
|-----------|-----------|
| **n8n** | Webhook payload inclui `tenant_id`. Workflow filtra por empresa. |
| **Evolution API** | Instancia WhatsApp por tenant OU `tenant_id` no payload. |
| **Zoho** | `ia_credenciais_zoho` ja existe → adicionar `tenant_id`. |
| **IA (Action Engine)** | `automacoes_robos` ja existe → adicionar `tenant_id`. Robos sao por empresa. |
| **Tracking** | View `vw_notificacoes_pendentes` ja filtra por cliente → adicionar `tenant_id`. |
| **Notificacoes** | `portal_notificacoes` ja tem `cliente_id` → adicionar `tenant_id`. |

---

## 7. Migracao sem Downtime

### Fase 1: Adicionar coluna (seguro, sem impacto)
```sql
ALTER TABLE ordens_servico ADD COLUMN tenant_id UUID REFERENCES tenants(id);
-- Repetir para ~70 tabelas
-- Coluna com DEFAULT NULL — dados existentes nao quebram
```

### Fase 2: Popular tenant padrao (para dados existentes)
```sql
INSERT INTO tenants (id, nome, slug, plano) VALUES (gen_random_uuid(), 'Default', 'default', 'enterprise');
UPDATE ordens_servico SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default');
-- Repetir para ~70 tabelas
```

### Fase 3: Tornar NOT NULL (apos todos os dados terem tenant)
```sql
ALTER TABLE ordens_servico ALTER COLUMN tenant_id SET NOT NULL;
```

### Fase 4: Ativar RLS Multi-Tenant (substituir politicas)
```sql
-- Aplicar novas politicas com tenant_id = current_setting('app.tenant_id')
```

---

## 8. Comercializacao — Planos

| Recurso | Starter | Professional | Enterprise |
|---------|---------|-------------|------------|
| Usuarios | 5 | 20 | Ilimitado |
| OS/mes | 500 | 2.000 | 10.000+ |
| Armazenamento | 5 GB | 50 GB | 500 GB |
| Integracoes | 1 | 5 | Ilimitado |
| IA | Basica | Avancada | Personalizada |
| White Label | Nao | Sim | Sim |
| Dominio proprio | Nao | Sim | Sim |
| Suporte | Email | Chat | Dedicado |
| **Preco/mes** | R$ 497 | R$ 997 | Sob consulta |

---

## 9. White Label por Tenant

| Elemento | Onde Configurar | Padrao |
|----------|----------------|--------|
| Logo | `tenants.config.logo_url` | Logo Express Connect |
| Cores | `tenants.config.cor_primaria` | Laranja #F97316 |
| Dominio | `tenants.config.dominio` | tms.expressconnect.com.br |
| Email From | `tenants.config.email_from` | noreply@expressconnect.com.br |
| PDF Logo | `tenants.config.logo_url` | Logo padrao |
| WhatsApp | `tenants.config.whatsapp_numero` | — |

---

## 10. Roadmap de Implementacao

| Fase | Descricao | Dias | Risco |
|------|-----------|------|-------|
| **Fase 1: Banco** | Criar `tenants`, `user_tenants`, adicionar `tenant_id` em 70 tabelas | 3 | Baixo |
| **Fase 2: RLS** | Substituir 470+ politicas por multi-tenant + perfis | 2 | Medio |
| **Fase 3: Auth** | Supabase Auth custom claims, JWT com tenant, `user_tenants` | 3 | Medio |
| **Fase 4: Frontend** | `TenantProvider`, troca empresa, React Query keys, cache | 4 | Baixo |
| **Fase 5: Integracoes** | n8n, Evolution, Zoho, IA com `tenant_id` | 2 | Medio |
| **Fase 6: Migracao + Go Live** | Popular dados existentes, ativar RLS, deploy | 2 | Alto |

**Total: 16 dias** | **Equipe: 2 devs fullstack**

---

*Documento de Arquitetura Multi-Tenant — Missao 14 — OpenCode Go Pro*
