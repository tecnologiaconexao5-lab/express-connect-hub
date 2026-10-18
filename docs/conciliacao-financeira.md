# Conciliacao Financeira — Express Connect Hub / TMS

> **Missao:** 02 | **Data:** 2026-06-26

---

## 1. Funcao de Conciliacao

### `fn_conciliar_financeiro_os(p_os_id UUID DEFAULT NULL)`

Compara 5 tabelas para cada OS finalizada:

| Tabela | Coluna comparada |
|--------|-----------------|
| `ordens_servico` | `valor_cliente`, `custo_prestador` |
| `financeiro_receber` | `valor` |
| `financeiro_pagar` | `valor` |
| `pagamentos_prestadores` | `valor` |
| `composicao_financeira_os` | `margem_bruta` |

### Uso
```sql
-- Conciliar todas as OS finalizadas
SELECT * FROM fn_conciliar_financeiro_os();

-- Conciliar uma OS especifica
SELECT * FROM fn_conciliar_financeiro_os('uuid-da-os');
```

### Colunas de Retorno
| Coluna | Descricao |
|--------|-----------|
| `os_id` | ID da OS |
| `os_numero` | Numero da OS |
| `status_os` | Status atual |
| `valor_cliente_os` | Valor na tabela ordens_servico |
| `valor_receber` | Valor em financeiro_receber |
| `valor_pagar` | Valor em financeiro_pagar |
| `valor_prestador` | Valor em pagamentos_prestadores |
| `margem_bruta` | Margem em composicao_financeira_os |
| `divergencia_receber` | OS.valor_cliente - receber.valor |
| `divergencia_pagar` | OS.custo_prestador - pagar.valor |
| `status_conciliacao` | CONCILIADO ou DIVERGENTE |

---

## 2. Regras de Conciliacao

### Receita (Cliente)
```
OS.valor_cliente == financeiro_receber.valor
```
Divergencia indica:
- OS foi editada apos faturamento
- financeiro_receber nao foi criado/sincronizado
- Trigger nao disparou

### Custo (Prestador)
```
OS.custo_prestador == financeiro_pagar.valor
```
Divergencia indica:
- Custos extras nao propagados
- Cancelamento nao limpou financeiro_pagar
- Trigger vs TypeScript race condition

---

## 3. Comando de Verificacao Periodica

```sql
-- Ver todas as divergencias
SELECT os_numero, status_conciliacao, divergencia_receber, divergencia_pagar
FROM fn_conciliar_financeiro_os()
WHERE status_conciliacao = 'DIVERGENTE';

-- Resumo por status
SELECT status_conciliacao, COUNT(*) as total, SUM(ABS(divergencia_receber)) as soma_div_receber
FROM fn_conciliar_financeiro_os()
GROUP BY status_conciliacao;
```

---

*Documento gerado para Missao 02 — OpenCode Go Pro*
