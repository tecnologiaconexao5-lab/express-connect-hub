# Riscos Remanescentes — Express Connect Hub / TMS

> **Data:** 2026-06-26 | **Pós-correções automáticas aplicadas**

---

## Riscos P0 — AINDA ABERTOS (35)

### Segurança (7)
| ID | Risco | Impacto | Correção Pendente |
|----|-------|---------|-------------------|
| R01 | 47 políticas `USING (true)` — anon key = admin | Vazamento total de dados | Fechar políticas, exigir authenticated para escrita |
| R02 | Tabelas sem RLS: `escala_operacional`, `motorista_app_sessoes`, `motorista_checkins` | Acesso irrestrito | Habilitar RLS + criar políticas |
| R03 | `SUPABASE_SERVICE_ROLE_KEY` vazio | 6 Edge Functions quebradas | Configurar no `.env` |
| R04 | API keys em localStorage | XSS pode vazar chaves | Mover para `import.meta.env` |
| R05 | `GRANT ALL TO anon` em 10+ tabelas de automação | Escrita anon irrestrita | Revogar + políticas authenticated |
| R06 | Bucket `biblioteca-global` com upload público | Qualquer um pode fazer upload | Restringir para authenticated |
| R07 | Sem autenticação Supabase — app sempre role `anon` | Sem isolamento por usuário | Implementar `signInWithPassword` |

### Banco de Dados (6)
| ID | Risco | Impacto | Correção Pendente |
|----|-------|---------|-------------------|
| R08 | `financeiro_receber` sem `UNIQUE (os_id)` | Duplicata de faturamento | Adicionar constraint |
| R09 | `pagamentos_prestadores` sem `UNIQUE (os_id)` | Pagamento duplicado ao prestador | Adicionar constraint |
| R10 | `ordens_servico` sem CHECK `valor_cliente >= 0` | Valores negativos na OS | Adicionar constraint |
| R11 | `ordens_servico` sem CHECK `custo_prestador >= 0` | Custos negativos | Adicionar constraint |
| R12 | 6 FKs ausentes em tabelas financeiras | Registros órfãos | Adicionar FKs com SET NULL |
| R13 | Trigger SQL + TypeScript escrevendo nas mesmas tabelas | Race condition | Unificar em um só caminho |

### Operacional (11)
| ID | Risco | Impacto | Correção Pendente |
|----|-------|---------|-------------------|
| R14 | Sem validação de transição de status na escala | Escala pula estados | Máquina de estados |
| R15 | `cancelarAlocacao()` não propaga para OS | OS fica ativa com escala cancelada | Chamar `sincronizarOSEscala()` |
| R16 | `cancelarAlocacao()` não zera financeiro | Registros financeiros fantasmas | Chamar `sincronizarFinanceiroOSAlocacao()` |
| R17 | Sem função `cancelarOS()` com cascade | Cancelamento manual em 4 tabelas | Criar função unificada |
| R18 | Sem swap de motorista | Troca manual sem validação | Implementar `trocarMotorista()` |
| R19 | Sem swap de veículo | Troca manual sem validação | Implementar `trocarVeiculo()` |
| R20 | Sem multi-stop na escala | Rotas complexas inviáveis | Tabela de paradas |
| R21 | Sem logística reversa | Devoluções sem rastreamento | OS de retorno + ajuste financeiro |
| R22 | Sem gestão de frota | Quebras sem contingência | Veículo reserva + manutenção |
| R23 | `propostaService` não verifica inadimplência | OS para cliente devedor | Adicionar verificação |
| R24 | `finalizarOrdemServico()` sem caller | Função de 264 linhas morta | Conectar ao UI |

### Financeiro (6)
| ID | Risco | Impacto | Correção Pendente |
|----|-------|---------|-------------------|
| R25 | Margem ignora 6 custos reais | Dashboard mostra lucro falso | Integrar `engineFinanceira` |
| R26 | `engineFinanceira` não salva no banco | Cálculo real descartado | Salvar em `composicao_financeira_os` |
| R27 | Sem fatura comercial / boleto | Cliente não é cobrado formalmente | Implementar emissão |
| R28 | Sem conciliação OS ↔ financeiro | Divergências nunca detectadas | Função de reconciliação |
| R29 | Sem DRE gerencial | Sem visão contábil consolidada | Implementar relatório DRE |
| R30 | Sem lote de pagamento prestador | Fechamento manual semanal (2-3h) | Tabela + UI de lote |

### IA Governança (3)
| ID | Risco | Impacto | Correção Pendente |
|----|-------|---------|-------------------|
| R31 | `executarAcaoReal()` sem re-verificação | Bypass da governança | Adicionar `avaliarAcao()` no switch |
| R32 | Sem rate limit por segundo/minuto | Robô pode disparar 100 ações/segundo | Sliding window |
| R33 | `ia_autoridade_acoes` vazia para maioria das ferramentas | Default bypass | Popular matriz |

### Frontend (2 - restantes após correções aplicadas)
| ID | Risco | Impacto | Correção Pendente |
|----|-------|---------|-------------------|
| R34 | `Frota.tsx`, `SLA.tsx`, `Governanca.tsx` maquete | Usuário vê dados falsos | Implementar ou remover do menu |
| R35 | `Tracking.tsx` mock com `setTimeout` | Tracking público falso | Conectar ao Supabase |

---

## Riscos Mitigados (Correções Aplicadas)

| ID | Risco | Correção |
|----|-------|----------|
| ✅ | `TabFinanceiro.tsx:65` — query campo `margem` inexistente | Alterado para `margem_bruta` |
| ✅ | `governancaService.ts:306` — default bypass | Alterado para `precisa_aprovacao: true` |
| ✅ | `composicao_financeira_os` sem UNIQUE | Migration criada |
| ✅ | `alocacoes_escala` sem CHECK >= 0 | Migration criada |
| ✅ | `financeiro_receber` sem CHECK >= 0 | Migration criada |
| ✅ | `financeiro_pagar` sem CHECK >= 0 | Migration criada |
| ✅ | `pagamentos_prestadores` sem CHECK >= 0 | Migration criada |
| ✅ | 7 FKs críticos ausentes | Migration criada |
| ✅ | `financeiro_receber` sem trigger auditoria | Migration criada |
| ✅ | `os_id` TEXT vs UUID | Migration criada |
| ✅ | `GRANT ALL TO anon` em tabelas sensíveis | Migration criada |
| ✅ | 9 SECURITY DEFINER sem `search_path` | Migration criada |
| ✅ | `escala_operacional` sem RLS | Migration criada |
| ✅ | 11 índices de performance | Migration criada |
| ✅ | CHECK status em `financeiro_receber`/`pagar`/`portal_faturas` | Migration criada |

---

## Classificação Final

| Categoria | P0 | P1 | P2 |
|-----------|----|----|-----|
| Segurança | 7 | 4 | 0 |
| Banco de Dados | 6 | 8 | 0 |
| Operacional | 11 | 6 | 3 |
| Financeiro | 6 | 8 | 4 |
| IA Governança | 3 | 4 | 3 |
| Frontend UX | 2 | 4 | 6 |
| **Total** | **35** | **34** | **16** |

**Total de riscos abertos:** 85  
**Total de riscos mitigados:** 15  
**Progresso:** 15% dos riscos resolvidos

---

*Documento gerado por auditoria enterprise definitiva — OpenCode Go Pro*
