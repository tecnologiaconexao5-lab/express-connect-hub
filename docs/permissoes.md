# Permissoes — Express Connect Hub / TMS

> **Missao:** 01 | **Data:** 2026-06-26

---

## 1. Modelo de Permissoes (Proposto)

### Perfis de Usuario

| Perfil | Descricao | Acesso |
|--------|-----------|--------|
| `admin` | Administrador da empresa | Tudo da empresa (tenant) |
| `financeiro` | Departamento financeiro | Financeiro + relatorios |
| `operacional` | Operador de escala/OS | Operacao + escala + motoristas |
| `comercial` | Vendas/CRM | CRM + orcamentos + clientes |
| `fiscal` | Departamento fiscal | CT-e, NFS-e, MDF-e |
| `cliente` | Cliente (portal) | Apenas dados do proprio cliente |
| `prestador` | Prestador de servico | Apenas dados do proprio prestador |
| `motorista` | Motorista (app) | Apenas dados do proprio motorista |
| `ia` | Robo/IA | Restrito por matriz `ia_autoridade_acoes` |

### Permissoes por Acao

| Acao | admin | financeiro | operacional | comercial | cliente | prestador | ia |
|------|-------|------------|-------------|-----------|---------|-----------|----|
| Ver OS | Todas | Todas | Todas | Do cliente | Proprias | Proprias | Configurado |
| Criar OS | Sim | Nao | Sim | Sim | Nao | Nao | Com aprovacao |
| Editar OS | Sim | Nao | Sim | Nao | Nao | Nao | Com aprovacao |
| Cancelar OS | Sim | Nao | Sim | Nao | Nao | Nao | **NUNCA** |
| Finalizar OS | Sim | Nao | Sim | Nao | Nao | Nao | Com aprovacao |
| Ver financeiro | Sim | Sim | Nao | Nao | Proprio | Proprio | Configurado |
| Registrar pagamento | Sim | Sim | Nao | Nao | Nao | Nao | Com aprovacao |
| Cancelar pagamento | Sim | Sim | Nao | Nao | Nao | Nao | **NUNCA** |
| Criar escala | Sim | Nao | Sim | Nao | Nao | Nao | Com aprovacao |
| Cancelar escala | Sim | Nao | Sim | Nao | Nao | Nao | Com aprovacao |
| Ver clientes | Sim | Sim | Sim | Sim | Proprio | Nao | Configurado |
| Excluir cliente | Sim | Nao | Nao | Nao | Nao | Nao | **NUNCA** |
| Excluir prestador | Sim | Nao | Nao | Nao | Nao | Nao | **NUNCA** |
| Alterar permissoes | Sim | Nao | Nao | Nao | Nao | Nao | **NUNCA** |

---

## 2. Implementacao Atual

### Estado: Preparado para perfis (RLS corrigido)

- RLS separa SELECT (anon) de INSERT/UPDATE/DELETE (authenticated)
- `usuarios_cliente` ja tem politica `cliente_read_own` com `auth.uid()`
- Views do portal cliente filtram por `auth.uid()`
- `operacoes_financeiro` tem politica por role (`raw_user_meta_data->>'role'`)

### Pendente

- Criar tabela `user_roles` ou usar `raw_user_meta_data`
- Implementar Supabase Auth
- Criar middleware de autorizacao no frontend
- Mapear permissoes do `permissoes.ts` para RLS policies

---

## 3. Arquitetura de Permissoes (3 Camadas)

```
Camada 1: RLS (PostgreSQL)
  └─ SELECT = anon | INSERT/UPDATE/DELETE = authenticated
  └─ Row-level: auth.uid() = cliente_id | prestador_id

Camada 2: Governanca IA
  └─ ia_autoridade_acoes: matriz por robo x acao
  └─ Dupla barreira: solicitarAcao + executarAcaoReal

Camada 3: Frontend (futuro)
  └─ useAuth() hook com role-based rendering
  └─ Botoes desabilitados por permissao
```

---

*Documento gerado para Missao 01 — OpenCode Go Pro*
