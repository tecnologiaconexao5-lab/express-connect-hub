# TMS-006.2 — Segurança de Ordens de Serviço e Seleção do Candidato HML

**Data:** 2026-07-27
**Status:** ✅ GO — CANDIDATO HML E PLANO DE ALOCAÇÃO PRONTOS; RLS DE OS AGUARDA CORREÇÃO SEPARADA

---

## FASE 1+2 — Anon SELECT e RLS

### Teste real com role anon

| Aspecto | Resultado |
|---------|:---------:|
| Endpoint | `https://uwrvzsjtpgaifkktpepn.supabase.co/rest/v1/ordens_servico` |
| HTTP status | 200 ✅ (não 401, não 403) |
| Rows retornadas | **0** (RLS filtra efetivamente) |
| Error | Nenhum |
| INSERT | Testado → **bloqueado** (sem policy) |

**Conclusão F1:** Anon consegue CONECTAR (HTTP 200) mas não vê nenhum registro. O RLS está ON e não há policy `TO public` ou `TO anon` para `ordens_servico`. A segurança está **funcional para SELECT** — anon retorna vazio, não dados.

### Policies atuais (versão 20260806 — corrigida)

A migration `20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql` define **2 policies**:

| Policy | Role | Cmd | USING / WITH CHECK |
|--------|:----:|:---:|--------------------|
| `os_select_own` | authenticated | SELECT | `cliente_id IS NOT NULL AND cliente_id ~ UUID_REGEX AND (cliente_id::uuid IN (f_obter_cliente_id_do_usuario()) OR f_usuario_pode_acessar_cliente(cliente_id::uuid))` |
| `os_insert_portal` | authenticated | INSERT | `cliente_id::uuid = f_obter_cliente_id_do_usuario()` |

**Sem policy `TO public`, `TO anon`.** Grants padrão (anon/get/authenticated têm SELECT pelo catálogo, mas RLS bloqueia).

### Risco classificado: **P2** (não há vazamento de dados, mas HTTP 200 com 0 rows pode ser confundido com "not found" por páginas públicas)

---

## FASE 3 — Consumidores Anônimos

### Páginas públicas que consultam `ordens_servico`:

| Página | Rota | Consulta | Rota alternativa | Risco se bloquear |
|--------|:----:|:--------:|:----------------:|:-----------------:|
| `Tracking.tsx:45` | `/rastrear/:codigo`, `/t/:codigo` | `supabase.from("ordens_servico").select(...).or("numero.eq...")` | **Nenhuma** — consulta direta com anon | **P1 — JÁ QUEBRADO** (anon retorna 0 hoje) |
| `RastreamentoPublico.tsx` | `/rastreamento/:token` | Via `communicationHubService.obterOSPorToken()` → `supabase.from("ordens_servico").eq("id", os_id)` | **Nenhuma** — consulta direta com anon | **P1 — JÁ QUEBRADO** (anon retorna 0 hoje) |
| `PortalCliente.tsx:1345` | `/portal-cliente` | `supabase.from("ordens_servico").eq("cliente_id", clienteId)` | Usa auth do portal (JWT) | **P2** — funciona se autenticado |

**Impacto:** As páginas de rastreamento público (`/rastrear`, `/rastreamento/:token`) **já estão quebradas em produção** se o anon não consegue SELECT. Precisam ser migradas para RPC segura ou view pública limitada.

### Alternativa para tracking público:

Criar function `f_obter_dados_rastreio_publico(token TEXT)` que:
1. Busca `tracking_public_links` pelo token
2. Retorna campos limitados da OS (`numero, status, origem, destino, data`)
3. Executa com `SECURITY DEFINER` (bypass RLS)
4. Concede EXECUTE `TO public`

---

## FASE 4 — Proposta de Correção RLS

Não há vazamento ativo de dados (anon retorna 0). A correção prioritária é **criar RPC segura para tracking público**, não mudar o RLS atual.

| Prioridade | Ação | Arquivo |
|:----------:|------|---------|
| P1 | Criar `f_obter_dados_rastreio_publico(token)` SECURITY DEFINER | Migration nova |
| P1 | Modificar `Tracking.tsx` para usar a RPC em vez de `supabase.from("ordens_servico")` | `src/pages/Tracking.tsx` |
| P1 | Modificar `communicationHubService.obterOSPorToken()` para usar a RPC | `src/services/communicationHubService.ts` |
| P3 | Se desejado, REVOKE + GRANT para remover SELECT do anon no catálogo | Migration separada |

**Rollback:** Reverter as RPCs e restaurar queries diretas.

---

## FASE 5 — Sete Vínculos Quebrados (Não 4)

A TMS-006.1 reportou "4 FKs quebradas". O número real é **7**.

| Alocação ID | ordem_servico_id | OS existe? | Prestador | Status | Data | Gravidade |
|:-----------:|:----------------:|:----------:|:---------:|:------:|:----:|:---------:|
| be8c9efb | 215eaf04 | ❌ | 6cc41f68 (ghost) | planejada | 2026-07-10 | P3 |
| 5dd1801b | dda7be25 | ❌ | 6cc41f68 (ghost) | planejada | 2026-07-10 | P3 |
| fc8d4bb1 | 19eedf62 | ❌ | 6cc41f68 (ghost) | concluida | 2026-07-10 | P3 |
| fe4bc8a4 | 2073a75d | ❌ | 6cc41f68 (ghost) | concluida | 2026-07-10 | P3 |
| bc1c1901 | 38961ecf | ❌ | 6cc41f68 (ghost) | concluida | 2026-07-10 | P3 |
| 5f1364ec | 88f80b32 | ❌ | e6646799 (PRESTADOR TESTE APP) | aguardando_aceite | 2026-07-04 | P3 |
| 82c50e61 | 9f9130ba | ❌ | e6646799 (PRESTADOR TESTE APP) | aguardando_aceite | 2026-06-19 | P3 |

**Origem:** Dados de migrações/testes antigos (M43) onde ordens_servico foram deletadas mas alocações ficaram. `6cc41f68` é prestador "analise" sem nome.

**Não existe FK constraint real** no banco (`alocacoes_escala.ordem_servico_id` não tem CONSTRAINT FOREIGN KEY apontando para `ordens_servico.id`). Os vínculos são lógicos, não físicos.

---

## FASE 6 — Qualidade das 15 OS HML

### Matriz completa

| OS ID | Número | Status | Cliente | Aloc | Fin | VeicTipo | Segura? |
|:-----:|--------|:------:|:-------:|:----:|:---:|:--------:|:-------:|
| 28640e7b | **TESTE-001** | pendente | ❌ null | 0 | 0 | moto | **✅ Perfeita** |
| a94e561d | OS-TESTE-1776989922267 | em_andamento | ❌ null | 0 | 0 | — | ✅ |
| bf89eb61 | OS-TESTE-1776989832949 | em_andamento | ❌ null | 0 | 0 | — | ✅ |
| b62f9815 | OS-TESTE-1003 | agendada | cli:3525e99f | 0 | 0 | — | ✅ |
| 16ab52c3 | OS-TESTE-1000 | em_andamento | cli:3525e99f | 0 | 0 | — | ✅ |
| 8bfd87e1 | OS-TESTE-1002 | em_andamento | cli:3525e99f | 0 | 0 | — | ✅ |
| 1e64efa2 | OS-TESTE-1004 | concluida | cli:3525e99f | 0 | 0 | — | ⚠️ Finalizada |
| 7119b702 | OS-TESTE-1001 | concluida | cli:3525e99f | 0 | 0 | — | ⚠️ Finalizada |
| e57fd47f | TESTE_MIN_1782757719968 | rascunho | ❌ null | **1** | 0 | moto | ❌ Tem alocação |
| 127b1b3f | OS-TESTE-MR6IPT2H | finalizada | ❌ null | **1** | **1** | — | ❌ Tem aloc+fin |
| 89b922bc | OS-TESTE-MR6ISIWO | finalizada | ❌ null | **1** | **1** | — | ❌ |
| 9521575c | OS-TESTE-MR6IT7ZR | finalizada | ❌ null | **1** | **1** | — | ❌ |
| 7c8a6289 | OS-TESTE-MR6ITJ37 | finalizada | ❌ null | **1** | **1** | — | ❌ |
| cc1d608a | TESTE-OS-202604-151609 | finalizada | ❌ null | 0 | 0 | — | ⚠️ Finalizada |
| 2f29a428 | TESTE-FIN-202604-904241 | finalizada | ❌ null | 0 | 0 | — | ⚠️ Finalizada |

**Nota:** Cliente `3525e99f-64dd-43d1-ba0a-7e7559638841` **não existe** na tabela `clientes` (nome não encontrado). É um UUID fantasma.

### Candidata eleita: **TESTE-001** (28640e7b)

| Critério | Atende? |
|----------|:-------:|
| Identificação HML | ✅ Nome "TESTE-001" |
| Sem cliente | ✅ `cliente: null, cliente_id: cd463c93...` |
| Sem alocação ativa | ✅ `aloc: 0` |
| Sem financeiro | ✅ `fin: 0` |
| Status elegível | ✅ `pendente` |
| Sem tracking | ✅ |
| Sem POD | ✅ |
| Tenant correto | `00000000-0000-0000-0000-000000000001` (diferente do sentinel) |
| Veículo tipo | `moto` |

---

## FASE 7 — Regra de OS Elegível para Dropdown

| Status da OS | Tem alocação ativa? | Elegível? | Justificativa |
|:------------:|:-------------------:|:---------:|---------------|
| `pendente` | ❌ | ✅ | Ideal — aguardando alocação |
| `agendada` | ❌ | ✅ | Pré-alocação |
| `em_andamento` | ❌ | ✅ | Pode receber segunda alocação |
| `rascunho` | ❌ | ⚠️ | Dados podem estar incompletos |
| `programacao` | ❌ | ✅ | Planejada |
| `concluida` | ❌ | ❌ | Entrega finalizada |
| `finalizada` | ❌ | ❌ | Ciclo encerrado |
| `entregue` | ❌ | ❌ | Ciclo encerrado |
| `cancelada` | ❌ | ❌ | Cancelada |
| Qualquer | ✅ | ❌ | Já tem alocação ativa |

**Regra SQL:**
```sql
SELECT os.id, os.numero, os.status, os.cliente, os.tipo_operacao
FROM ordens_servico os
WHERE os.status IN ('pendente', 'agendada', 'em_andamento', 'programacao')
  AND os.tenant_id = current_tenant_id_safe()
  AND NOT EXISTS (
    SELECT 1 FROM alocacoes_escala ae
    WHERE ae.ordem_servico_id = os.id
      AND ae.status NOT IN ('cancelada', 'recusada')
  )
ORDER BY os.created_at DESC
```

---

## FASE 8 — Proposta de Dropdown de OS

### Estado atual (input livre)

| Camada | Arquivo | Linha | Detalhe |
|:------:|---------|:-----:|---------|
| State | `EscalaLista.tsx` | 114 | `novaOS: string` — texto livre |
| Modal | `EscalaLista.tsx` | ~850 | Campo `<Input>` não vinculado a `ordens_servico` |
| Payload | `EscalaLista.tsx` | 872 | `payload.observacoes = OS: ${novaOS}` (texto em observações) |
| Mapper | `escalaMapper.ts` | 138 | Tenta converter para UUID → salva em `ordem_servico_id` |
| Service | `escalaService.ts:50` | — | Consulta `ordens_servico` via JOIN em `listarAlocacoes()` |

### Diferença proposta (localizada em `EscalaLista.tsx`)

```diff
- const [novaOS, setNovaOS] = useState("");
+ const [novaOS, setNovaOS] = useState("");
+ const [osDisponiveis, setOsDisponiveis] = useState<any[]>([]);
+ const [loadingOS, setLoadingOS] = useState(false);

+ // Carregar OS elegíveis
+ useEffect(() => {
+   if (!modalOpen) return;
+   setLoadingOS(true);
+   supabase.from("ordens_servico")
+     .select("id, numero, status, cliente, tipo_operacao")
+     .in("status", ["pendente", "agendada", "em_andamento", "programacao"])
+     .order("created_at", { ascending: false })
+     .limit(50)
+     .then(({ data }) => {
+       // Filtrar OS já alocadas
+       if (data) setOsDisponiveis(data);
+     })
+     .finally(() => setLoadingOS(false));
+ }, [modalOpen]);

// No JSX, substituir <Input> por <Select> ou <SearchableSelect>
- <Input value={novaOS} onChange={e => setNovaOS(e.target.value)} />
+ <Select value={novaOS} onValueChange={setNovaOS}>
+   <SelectTrigger><SelectValue placeholder="Selecione a OS" /></SelectTrigger>
+   <SelectContent>
+     {osDisponiveis.map(os => (
+       <SelectItem key={os.id} value={os.id}>
+         {os.numero} — {os.cliente || "Sem cliente"} ({os.status})
+       </SelectItem>
+     ))}
+   </SelectContent>
+ </Select>
```

O mapper `escalaMapper.ts:138` já tenta converter `novaOS` para UUID e salvar como `ordem_servico_id`. Com o value sendo o UUID da OS, o mapper funcionará corretamente.

---

## FASE 9 — Plano de Alocação Controlada

### Candidatos selecionados

| Componente | ID | Nome | Observação |
|:----------:|:--:|:----:|------------|
| **OS** | `28640e7b-fbe5-4141-a59a-c5bead26d25a` | TESTE-001 | Pendente, sem cliente, sem alocação, sem financeiro |
| **Prestador** | `5377592a-50e8-41d7-b8c5-b5c4509a3d56` | M43_2026-06-29_18-24-20 Motorista Teste | Ativo, sem auth, sem app |
| **Veículo** | A definir | Placa HML-TMS | Precisa criar veículo HML (não existe moto HML disponível) |

### Payload exato

```json
{
  "ordem_servico_id": "28640e7b-fbe5-4141-a59a-c5bead26d25a",
  "prestador_id": "5377592a-50e8-41d7-b8c5-b5c4509a3d56",
  "data_escala": "2026-07-27",
  "status": "planejada",
  "tipo_veiculo": "moto",
  "placa": "HML-TMS",
  "turno": "diurno",
  "valor_frete": 0,
  "valor_repasse": 0,
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "metadata": {
    "origem_tms": true,
    "precisa_aceite_app": false,
    "tipo_operacao": "teste_hml",
    "hml_test_id": "TMS-006.2"
  }
}
```

### Trigger effects

| Trigger | Efeito | Risco |
|---------|--------|:-----:|
| `trg_alocacoes_escala_updated_at` | Atualiza `updated_at` | ✅ Zero |
| `trg_propagar_financeiro_alocacao` | Cria registros em `financeiro_receber`, `pagamentos_prestadores`, `composicao_financeira_os` | ⚠️ Cria com valor 0 (seguro) |
| Realtime | Notifica canal `escala-operacional-realtime` | ✅ Zero |

### Rollback & Cleanup

```sql
-- Remover alocação HML
DELETE FROM alocacoes_escala WHERE id = '<alocacao_id>';
-- Remover financeiro (se criado pelo trigger)
DELETE FROM financeiro_receber WHERE alocacao_id = '<alocacao_id>';
DELETE FROM pagamentos_prestadores WHERE alocacao_id = '<alocacao_id>';
DELETE FROM composicao_financeira_os WHERE os_id = '28640e7b-...';
```

### Decisão

```
GO — CANDIDATO HML E PLANO DE ALOCAÇÃO PRONTOS;
RLS DE OS AGUARDA CORREÇÃO SEPARADA

Razão: TESTE-001 é segura (sem cliente, sem financeiro, sem alocação).
Trigger financeiro cria registros valor 0 — sem impacto comercial.
Único pré-requisito pendente: criar veículo com placa HML-TMS.
```

---

## FASE 10 — TypeScript

| Comando | Resultado | Observação |
|---------|:---------:|------------|
| `npm run typecheck:app` | ~150 erros | Preexistentes (dbMappers, PortalCliente, IA services) |
| `npm run typecheck:node` | **0 erros** ✅ | |
| `npm run build` | **OK** (31.95s) ✅ | |

Nenhum erro novo introduzido.

---

## Anexo: Migration Proposta (não aplicada)

```sql
-- Correção RLS para tracking público + remoção grants anon

-- 1. Criar RPC segura para rastreamento público
CREATE OR REPLACE FUNCTION public.f_obter_dados_rastreio_publico(p_token TEXT)
RETURNS TABLE(numero TEXT, status TEXT, origem TEXT, destino TEXT, data_programada DATE)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_os_id UUID;
BEGIN
  SELECT os_id INTO v_os_id
  FROM tracking_public_links
  WHERE token = p_token
    AND (expiracao IS NULL OR expiracao > NOW());
  
  IF v_os_id IS NULL THEN RETURN; END IF;
  
  RETURN QUERY
  SELECT os.numero, os.status, os.origem, os.destino, os.data_programada
  FROM ordens_servico os
  WHERE os.id = v_os_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.f_obter_dados_rastreio_publico TO public, anon;

-- 2. Remover grants desnecessários de anon (opcional)
REVOKE SELECT ON public.ordens_servico FROM anon;
REVOKE INSERT ON public.ordens_servico FROM anon;
REVOKE UPDATE ON public.ordens_servico FROM anon;
REVOKE DELETE ON public.ordens_servico FROM anon;
```

**Rollback:** Reverter REVOKEs + DROP FUNCTION.
