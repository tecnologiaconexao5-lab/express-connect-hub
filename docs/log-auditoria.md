# Log de Auditoria — Express Connect Hub / TMS

> **Missao:** 01 | **Data:** 2026-06-26

---

## 1. Tabelas de Auditoria Existentes

| Tabela | Registra | Gatilho |
|--------|----------|---------|
| `ia_logs` | Acoes da IA (todas) | Via `centralIaService.registrarLog()` |
| `ia_execucoes_ferramentas` | Execucoes de ferramentas IA | Via `solicitarAcao()` |
| `ia_execucoes_conectores` | Execucoes de conectores externos | Via `conectoresService` |
| `ia_governanca_log` | Decisoes de governanca | Via `governancaService.avaliarAcao()` |
| `ia_aprovacoes_fila` | Aprovacoes pendentes | Via `governancaService.criarAprovacao()` |
| `financeiro_receber_audit` | Alteracoes em recebiveis | Trigger `AFTER UPDATE` |
| `historico_alocacoes_escala` | Mudancas de status na escala | Trigger `AFTER INSERT OR UPDATE` |
| `security_violation_log` | Violacoes de seguranca | **NOVO (Missao 01)** |

---

## 2. Tabela `security_violation_log` (Missao 01)

```sql
CREATE TABLE security_violation_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    violation_type TEXT NOT NULL,    -- 'rls_blocked', 'governance_blocked', 'auth_failure'
    table_name TEXT,                 -- tabela alvo da violacao
    action TEXT,                     -- INSERT, UPDATE, DELETE, SELECT
    role_name TEXT,                  -- anon, authenticated, service_role
    details JSONB                    -- contexto adicional
);
```

### Tipos de Violacao Registrados

| Tipo | Descricao | Quando |
|------|-----------|--------|
| `rls_blocked` | RLS bloqueou acesso | Politica nega permissao |
| `governance_blocked` | Governanca bloqueou acao | `avaliarAcao()` retorna `permitido: false` |
| `governance_approval_required` | Governanca exige aprovacao | `avaliarAcao()` retorna `precisa_aprovacao: true` |
| `dual_barrier_blocked` | Dupla barreira IA bloqueou | `executarAcaoReal()` re-verificacao falhou |

---

## 3. Fluxo de Auditoria — Acao Critica

```
Usuario/IA solicita acao
  │
  ├─ [Log] ia_execucoes_ferramentas: status = SOLICITADA
  │
  ├─ [Log] ia_governanca_log: decisao = permitido/bloqueado/aprovacao
  │
  ├─ [Se bloqueado] security_violation_log: violation_type = governance_blocked
  │
  ├─ [Se aprovado] ia_execucoes_ferramentas: status = APROVADA
  │
  ├─ [Dupla barreira] governancaService.avaliarAcao()
  │   └─ [Se bloqueado] security_violation_log: violation_type = dual_barrier_blocked
  │
  ├─ [Execucao] ia_execucoes_conectores / executarAcaoReal()
  │   └─ [Log] ia_logs: acao, entrada, saida, status
  │
  └─ [Se financeiro] financeiro_receber_audit: valor_anterior → valor_novo
```

---

## 4. Comandos de Consulta

### Ver todas as violacoes de seguranca
```sql
SELECT * FROM security_violation_log
ORDER BY occurred_at DESC
LIMIT 100;
```

### Ver violacoes por tipo
```sql
SELECT violation_type, COUNT(*) 
FROM security_violation_log 
GROUP BY violation_type;
```

### Auditar alteracoes financeiras
```sql
SELECT fr.descricao, fra.valor_anterior, fra.valor_novo, fra.changed_at
FROM financeiro_receber_audit fra
JOIN financeiro_receber fr ON fr.id = fra.receber_id
ORDER BY fra.changed_at DESC;
```

### Auditar execucoes da IA
```sql
SELECT ferramenta_id, status, resultado, created_at
FROM ia_execucoes_ferramentas
WHERE robo_id = '...'
ORDER BY created_at DESC;
```

---

## 5. Gaps de Auditoria (Pendentes)

- [ ] Sem auditoria para `financeiro_pagar`
- [ ] Sem auditoria para `pagamentos_prestadores`
- [ ] `changed_by` ausente (nao sabemos QUEM alterou)
- [ ] Tabelas de auditoria nao sao append-only (podem ser editadas)
- [ ] Sem registro de IP/user-agent

---

*Documento gerado para Missao 01 — OpenCode Go Pro*
