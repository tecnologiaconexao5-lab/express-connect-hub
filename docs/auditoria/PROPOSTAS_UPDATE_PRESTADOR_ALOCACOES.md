# Propostas para UPDATE do Prestador em `alocacoes_escala`

**Contexto:** A policy `"Prestador can update own alocacoes"` (FOR UPDATE TO authenticated USING prestadores.auth_user_id = auth.uid()) permite que qualquer prestador autenticado altere QUALQUER coluna de suas alocações, incluindo campos financeiros, administrativos e de tenant.

**Database:** Produção (`uwrvzsjtpgaifkktpepn.supabase.co`)

---

## Matriz das 8 funções que fazem UPDATE direto

### Grupo A — `escalaService.ts` (usado por `AppPrestador.tsx` via `useEscala` hook)

| # | Função | Linha | Caller (UI) | Perfil | Colunas alteradas | REST/RPC | Fluxo | RPC alternativo? | Risco sem policy |
|---|--------|-------|-------------|--------|-------------------|----------|-------|-----------------|:----------------:|
| A1 | `aceitarAlocacao()` | 496 | `AppPrestador.tsx:150` handleAceitarViagem | Prestador web (TMS) | `status`, `aceite_prestador`, `data_aceite`, `updated_by` | REST | Prestador aceita viagem manualmente | ⚠️ `f_avancar_etapa_app_motorista` (viagem_aceita) — incompatível: exige auth.uid() = prestador, mas AppPrestador usa prestadorSelecionadoId manual | **ALTO** |
| A2 | `recusarAlocacao()` | 526 | `AppPrestador.tsx:168` handleRecusarViagem | Prestador web (TMS) | `status`, `aceite_prestador`, `motivo_recusa`, `updated_by` | REST | Recusa + histórico | ❌ NENHUM | **ALTO** |
| A3 | `iniciarRota()` | 567 | `AppPrestador.tsx:188` handleIniciarViagem | Prestador web (TMS) | `status`, `horario_inicio_real`, `metadata.km_inicial` | REST | Inicia rota | ✅ `f_avancar_etapa_app_motorista` (cheguei_coleta → status=em_rota). Incompatível com UI manual | **MÉDIO** |
| A4 | `finalizarAlocacao()` | 594 | `AppPrestador.tsx:197` handleFinalizarViagem | Prestador web (TMS) | `status`, `finalizada`, `data_finalizacao`, `horario_fim_real`, `km_realizados`, `comprovante_url`, `assinatura_url`, `fotos_entrega`, `observacoes`, `ocorrencias_descricao`, `metadata` | REST | Finaliza c/ POD + fotos + assinatura | ⚠️ `f_avancar_etapa_app_motorista` (servico_finalizado) só altera `status`, `horario_fim_real`, `finalizada`. **NÃO cobre** comprovante, assinatura, fotos, observações | **CRÍTICO** |

### Grupo B — `portalPrestadorService.ts` (usado por `PortalPrestador` via `portalPrestadorStore`)

| # | Função | Linha | Caller (UI) | Perfil | Colunas alteradas | REST/RPC | Fluxo | RPC alternativo? | Risco sem policy |
|---|--------|-------|-------------|--------|-------------------|----------|-------|-----------------|:----------------:|
| B1 | `aceitarOperacao()` | 390 | `OperacoesTab.tsx:34` handleAceitar | Prestador web (Portal) | `status`, `aceite_prestador`, `data_aceite` | REST | Aceita operação no Portal Prestador | ❌ MESMO A1 | **ALTO** |
| B2 | `recusarOperacao()` | 408 | `OperacoesTab.tsx:40` handleRecusar | Prestador web (Portal) | `status`, `aceite_prestador`, `motivo_recusa` | REST | Recusa operação | ❌ MESMO A2 | **ALTO** |
| B3 | `iniciarOperacao()` | 426 | `OperacoesTab.tsx:46` handleIniciar | Prestador web (Portal) | `status`, `horario_inicio_real`, `km_previstos` | REST | Inicia operação | ✅ MESMO A3 | **MÉDIO** |
| B4 | `concluirOperacao()` | 446 | `OperacoesTab.tsx:52` handleConcluir | Prestador web (Portal) | `status`, `finalizada`, `horario_fim_real`, `km_realizados` | REST | Conclui operação | ⚠️ Parcial (não cobre km_realizados) | **MÉDIO** |

### Grupo C — TMS ADMIN (não prestador, sem risco)

| # | Função | Linha | Perfil | Colunas | Risco sem policy |
|---|--------|-------|--------|---------|:----------------:|
| C1 | `trocarMotorista()` | 631 | TMS admin | `prestador_id`, `prestador_nome` | NENHUM (usa ae_update_tms por tenant) |
| C2 | `trocarVeiculo()` | 646 | TMS admin | `placa` | NENHUM |
| C3 | `cancelarAlocacao()` | 452 | TMS admin | `status`, `status_pagamento`, `finalizada` | NENHUM |

### Colunas alteráveis pelos grupos A+B (prestador web)

| Coluna | A1 | A2 | A3 | A4 | B1 | B2 | B3 | B4 | Administrativa? | Financeira? |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:---------------:|:-----------:|
| `status` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `aceite_prestador` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `data_aceite` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `motivo_recusa` | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `horario_inicio_real` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `horario_fim_real` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `finalizada` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `data_finalizacao` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `km_realizados` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `comprovante_url` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `assinatura_url` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `fotos_entrega` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `observacoes` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ocorrencias_descricao` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `metadata` | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`prestador_id`** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **SIM** | ❌ |
| **`cliente_id`** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **SIM** | ❌ |
| **`tenant_id`** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **SIM** | ❌ |
| **`valor_frete`** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **SIM** |
| **`valor_repasse`** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **SIM** |
| `updated_by` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Conclusão:** Nenhuma função A/B altera colunas financeiras ou administrativas. Todas as alterações são operacionais (status, horários, km, POD). O risco real não é financeiro — é a falta de validação e audit trail.

---

## PROPOSTA 1 — TRANSIÇÃO SEGURA

### Abordagem
Manter a policy + criar trigger de validação de colunas + criar RPCs para os 2 gaps (recusa, finalização completa).

### Diff (migration SQL)

```sql
-- ============================================================
-- 1. CRIAR RPCs FALTANTES
-- ============================================================

-- 1A. RPC para recusar alocação (cobre A2 e B2)
CREATE OR REPLACE FUNCTION public.f_recusar_alocacao_prestador(
  p_alocacao_id UUID,
  p_motivo TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prestador_id UUID;
  v_alocacao RECORD;
BEGIN
  v_prestador_id := (SELECT id FROM prestadores WHERE auth_user_id = auth.uid());
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;

  SELECT * INTO v_alocacao FROM alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;
  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;
  IF v_alocacao.status NOT IN ('pendente', 'disponivel') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'STATUS_INVALIDO', 'status_atual', v_alocacao.status);
  END IF;

  UPDATE alocacoes_escala SET
    status = 'recusada',
    aceite_prestador = false,
    motivo_recusa = p_motivo,
    updated_at = NOW()
  WHERE id = p_alocacao_id AND prestador_id = v_prestador_id;

  INSERT INTO historico_alocacoes_escala (alocacao_id, evento, descricao, status_novo, created_by)
  VALUES (p_alocacao_id, 'recusa_prestador', COALESCE(p_motivo, 'Recusado pelo prestador'), 'recusada', v_prestador_id);

  RETURN jsonb_build_object('sucesso', true, 'alocacao_id', p_alocacao_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.f_recusar_alocacao_prestador TO authenticated;

-- 1B. RPC para finalizar alocação com POD completo (cobre A4 gap)
CREATE OR REPLACE FUNCTION public.f_finalizar_alocacao_prestador(
  p_alocacao_id UUID,
  p_km_realizados NUMERIC DEFAULT NULL,
  p_comprovante_url TEXT DEFAULT NULL,
  p_assinatura_url TEXT DEFAULT NULL,
  p_fotos_entrega JSONB DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_ocorrencias_descricao TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prestador_id UUID;
  v_alocacao RECORD;
BEGIN
  v_prestador_id := (SELECT id FROM prestadores WHERE auth_user_id = auth.uid());
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;

  SELECT * INTO v_alocacao FROM alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;
  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;
  IF v_alocacao.status IN ('cancelada', 'concluida') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'STATUS_FINALIZADO');
  END IF;

  UPDATE alocacoes_escala SET
    status = 'concluida',
    finalizada = true,
    data_finalizacao = NOW(),
    horario_fim_real = NOW(),
    km_realizados = COALESCE(p_km_realizados, km_realizados),
    comprovante_url = COALESCE(p_comprovante_url, comprovante_url),
    assinatura_url = COALESCE(p_assinatura_url, assinatura_url),
    fotos_entrega = COALESCE(p_fotos_entrega, fotos_entrega),
    observacoes = COALESCE(p_observacoes, observacoes),
    ocorrencias_descricao = COALESCE(p_ocorrencias_descricao, ocorrencias_descricao),
    metadata = CASE WHEN p_metadata IS NOT NULL THEN COALESCE(metadata, '{}'::jsonb) || p_metadata ELSE metadata END,
    updated_at = NOW()
  WHERE id = p_alocacao_id AND prestador_id = v_prestador_id;

  INSERT INTO historico_alocacoes_escala (alocacao_id, evento, descricao, status_novo, created_by)
  VALUES (p_alocacao_id, 'conclusao_prestador', 'Operacao finalizada pelo prestador', 'concluida', v_prestador_id);

  RETURN jsonb_build_object('sucesso', true, 'alocacao_id', p_alocacao_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.f_finalizar_alocacao_prestador TO authenticated;

-- ============================================================
-- 2. CRIAR TRIGGER DE VALIDAÇÃO DE COLUNAS (safety net)
-- ============================================================
CREATE OR REPLACE FUNCTION public.f_trg_validar_update_prestador()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cols_restritas TEXT[] := ARRAY[
    'prestador_id', 'cliente_id', 'tenant_id', 'ordem_servico_id',
    'valor_frete', 'valor_repasse', 'placa', 'tipo_veiculo',
    'created_at', 'data_escala', 'km_previstos',
    'status_pagamento', 'data_pagamento', 'forma_pagamento'
  ];
  v_cols_alteradas TEXT[];
  v_is_prestador BOOLEAN;
BEGIN
  -- Verificar se quem altera é um prestador (não TMS)
  v_is_prestador := EXISTS (
    SELECT 1 FROM prestadores WHERE id = OLD.prestador_id AND auth_user_id = auth.uid()
  );

  IF NOT v_is_prestador THEN
    RETURN NEW; -- TMS admin pode alterar tudo
  END IF;

  -- Verificar se alguma coluna restrita foi alterada
  SELECT ARRAY_AGG(key) INTO v_cols_alteradas
  FROM (
    SELECT unnest(v_cols_restritas) AS key
  ) sub
  WHERE NEW[sub.key] IS DISTINCT FROM OLD[sub.key];

  IF v_cols_alteradas IS NOT NULL AND array_length(v_cols_alteradas, 1) > 0 THEN
    RAISE EXCEPTION 'PRESTADOR_NAO_PODE_ALTERAR_COLUNA: %', array_to_string(v_cols_alteradas, ', ');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valida_colunas_prestador ON alocacoes_escala;
CREATE TRIGGER trg_valida_colunas_prestador
  BEFORE UPDATE ON alocacoes_escala
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_validar_update_prestador();
```

### Arquivos TS a modificar
- `src/services/escala/escalaService.ts`:
  - `aceitarAlocacao()` (L496): manter REST (coberto pelo trigger)
  - `recusarAlocacao()` (L526): migrar para `supabase.rpc('f_recusar_alocacao_prestador', { p_alocacao_id: id, p_motivo: motivo })`
  - `iniciarRota()` (L567): manter REST (coberto pelo trigger)
  - `finalizarAlocacao()` (L594): migrar para `supabase.rpc('f_finalizar_alocacao_prestador', { ... })`
- `src/services/portal-prestador/portalPrestadorService.ts`:
  - `aceitarOperacao()` (L390): manter REST (coberto pelo trigger)
  - `recusarOperacao()` (L408): migrar para RPC
  - `iniciarOperacao()` (L426): manter REST
  - `concluirOperacao()` (L446): migrar para RPC

### Riscos
1. **Trigger adiciona latência** em todo UPDATE da tabela (inclusive TMS admin) — impacto negligível para volume atual (~172 alocações)
2. **Trigger pode falhar** se houver mismatch de tipos na comparação `NEW[key] IS DISTINCT FROM OLD[key]` em colunas JSONB — necessário tratar com `row_to_json`
3. **Policy ainda existe** — prestador ainda pode fazer UPDATE direto via REST, apenas com restrição de colunas pelo trigger
4. **`aceitarAlocacao` e `aceitarOperacao` (A1/B1)** continuam sem RPC — sem audit trail RPC, apenas trigger
5. **Trigger é SECURITY DEFINER** — se falhar, afeta também TMS admin (protegido pelo `v_is_prestador` check)

### Rollback
```sql
DROP TRIGGER IF EXISTS trg_valida_colunas_prestador ON alocacoes_escala;
DROP FUNCTION IF EXISTS public.f_trg_validar_update_prestador();
DROP FUNCTION IF EXISTS public.f_recusar_alocacao_prestador(UUID, TEXT);
DROP FUNCTION IF EXISTS public.f_finalizar_alocacao_prestador(UUID, NUMERIC, TEXT, TEXT, JSONB, TEXT, TEXT, JSONB);
```

### Tempo estimado
- SQL (RPCs + trigger): 2h
- TS migração (2 funções para RPC): 1h
- Testes Playwright adicionais (2 fluxos RPC): 1h
- **Total: ~4h**

### Testes
- **Playwright existentes: 27/27** sem regressão
- **Novos testes:** 2 (recusa via RPC, finalização POD via RPC)
- **Console:** verificar que `console.warn` não é disparado (fallback localStorage)
- **Network:** verificar chamada `POST /rest/v1/rpc/f_recusar_alocacao_prestador`
- **Banco:** verificar `historico_alocacoes_escala` após RPC

### Impactos
| Alvo | Impacto |
|------|---------|
| TMS admin | Nenhum (trigger só valida prestador) |
| AppPrestador.tsx | A2 e A4 mudam de REST para RPC — nenhuma mudança visível |
| PortalPrestador | B2 e B4 mudam de REST para RPC — nenhuma mudança visível |
| Flutter App Motorista | Nenhum (Flutter já usa RPCs próprios) |
| f_aceitar_oportunidade_rede | NÃO ALTERADO nesta proposta |

---

## PROPOSTA 2 — SEGURANÇA COMPLETA

### Abordagem
Remover a policy **após** criar 4 RPCs que cobrem todos os 6 fluxos (A1/A3/B1/B3 mantêm-se via RPCs, A2/B2 e A4/B4 migram para RPCs novos).

### Diff (migration SQL)

```sql
-- ============================================================
-- 1. CRIAR 4 RPCs DE PRESTADOR
-- ============================================================

-- 1A. RPC para aceitar alocação (cobre A1 e B1)
CREATE OR REPLACE FUNCTION public.f_aceitar_alocacao_prestador(
  p_alocacao_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prestador_id UUID;
  v_alocacao RECORD;
BEGIN
  v_prestador_id := (SELECT id FROM prestadores WHERE auth_user_id = auth.uid());
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;

  SELECT * INTO v_alocacao FROM alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_NAO_ENCONTRADA'); END IF;
  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;
  IF v_alocacao.status NOT IN ('pendente', 'disponivel') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'STATUS_INVALIDO', 'status_atual', v_alocacao.status);
  END IF;

  UPDATE alocacoes_escala SET
    status = 'aceita',
    aceite_prestador = true,
    data_aceite = NOW(),
    updated_at = NOW()
  WHERE id = p_alocacao_id AND prestador_id = v_prestador_id;

  RETURN jsonb_build_object('sucesso', true, 'alocacao_id', p_alocacao_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.f_aceitar_alocacao_prestador TO authenticated;

-- 1B. RPC para recusar alocação (cobre A2 e B2)
-- (mesmo código da Proposta 1)
CREATE OR REPLACE FUNCTION public.f_recusar_alocacao_prestador(...) ...;
GRANT EXECUTE ON FUNCTION public.f_recusar_alocacao_prestador TO authenticated;

-- 1C. RPC para iniciar rota (cobre A3 e B3)
CREATE OR REPLACE FUNCTION public.f_iniciar_rota_prestador(
  p_alocacao_id UUID,
  p_km_inicial NUMERIC DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prestador_id UUID;
  v_alocacao RECORD;
BEGIN
  v_prestador_id := (SELECT id FROM prestadores WHERE auth_user_id = auth.uid());
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;

  SELECT * INTO v_alocacao FROM alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_NAO_ENCONTRADA'); END IF;
  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;
  IF v_alocacao.status NOT IN ('aceita', 'pendente') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'STATUS_INVALIDO');
  END IF;

  UPDATE alocacoes_escala SET
    status = 'em_rota',
    horario_inicio_real = NOW(),
    metadata = CASE
      WHEN p_km_inicial IS NOT NULL
      THEN COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('km_inicial', p_km_inicial)
      ELSE metadata
    END,
    updated_at = NOW()
  WHERE id = p_alocacao_id AND prestador_id = v_prestador_id;

  RETURN jsonb_build_object('sucesso', true, 'alocacao_id', p_alocacao_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.f_iniciar_rota_prestador TO authenticated;

-- 1D. RPC para finalizar alocação com POD (cobre A4 e B4)
-- (mesmo código da Proposta 1)
CREATE OR REPLACE FUNCTION public.f_finalizar_alocacao_prestador(...) ...;
GRANT EXECUTE ON FUNCTION public.f_finalizar_alocacao_prestador TO authenticated;

-- ============================================================
-- 2. DROP DA POLICY
-- ============================================================
DROP POLICY IF EXISTS "Prestador can update own alocacoes" ON alocacoes_escala;

-- ============================================================
-- 3. FIX f_aceitar_oportunidade_rede (gap crítico)
-- ============================================================
CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id UUID,
  p_prestador_uuid UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_owner UUID;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Validar que p_prestador_uuid pertence ao auth.uid()
  SELECT id INTO v_prestador_owner FROM prestadores
  WHERE id = p_prestador_uuid AND auth_user_id = v_authenticated_uid;
  IF v_prestador_owner IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'PRESTADOR_NAO_PERTENCE_AO_USUARIO');
  END IF;

  -- ... resto da lógica existente (M111) ...
END;
$$;
GRANT EXECUTE ON FUNCTION public.f_aceitar_oportunidade_rede TO authenticated;
```

### Arquivos TS a modificar
- `src/services/escala/escalaService.ts`:
  - `aceitarAlocacao()`: migrar para RPC `f_aceitar_alocacao_prestador`
  - `recusarAlocacao()`: migrar para RPC `f_recusar_alocacao_prestador`
  - `iniciarRota()`: migrar para RPC `f_iniciar_rota_prestador`
  - `finalizarAlocacao()`: migrar para RPC `f_finalizar_alocacao_prestador`
- `src/services/portal-prestador/portalPrestadorService.ts`:
  - `aceitarOperacao()`: migrar para RPC
  - `recusarOperacao()`: migrar para RPC
  - `iniciarOperacao()`: migrar para RPC
  - `concluirOperacao()`: migrar para RPC
- `src/services/escala/escalaService.ts` tipo de retorno: `ResultadoOperacao<AlocacaoEscala>` vs RPC retorna `JSONB` → precisa adaptar

### Riscos
1. **Todas as 6 funções mudam de REST para RPC** — erro em qualquer uma bloqueia a operação no frontend (AppPrestador.tsx e PortalPrestador). O fallback localStorage ainda existe nas hooks `useEscala.ts` — captura o erro e salva local, mas o banco não é atualizado.
2. **RPC retorna JSONB, não o registro completo** — o hook `useEscala.ts` espera `dados` (AlocacaoEscala) após o update para atualizar o state local. Com RPC, precisa fazer um SELECT adicional ou confiar no retorno JSONB.
3. **`f_finalizar_alocacao_prestador` tem 8 parâmetros opcionais** — assinatura extensa para chamar via REST
4. **Fluxo de erro:** RPC → erro → hook captura → `setFonteDados('localStorage')` → UI funciona mas dados não persistem. Usuário não percebe que falhou.
5. **`f_aceitar_oportunidade_rede` com auth.uid() validation** — altera comportamento se algum caller atual depende do `p_auth_user_id` opcional sem validação.

### Rollback
```sql
-- Restaurar policy
CREATE POLICY "Prestador can update own alocacoes" ON alocacoes_escala FOR UPDATE
  TO authenticated
  USING (prestador_id IN (SELECT id FROM prestadores WHERE auth_user_id = auth.uid()));
-- RPCs podem permanecer (não interferem com policy)
```

### Tempo estimado
- SQL (4 RPCs + fix f_aceitar): 4h
- TS migração (6 funções de 2 arquivos): 4h
- Adaptação tipos de retorno (JSONB vs AlocacaoEscala): 1h
- Testes Playwright (6 novos + regressão 27): 2h
- **Total: ~9h**

### Testes
- **Playwright existentes: 27/27** sem regressão
- **Novos testes:** 6 (aceitar, recusar, iniciar, finalizar — AppPrestador e PortalPrestador)
- **Console:** verificar que fallback localStorage não é acionado
- **Network:** verificar chamadas RPC (não mais REST /rest/v1/alocacoes_escala)
- **Banco:** verificar linhas alteradas + `historico_alocacoes_escala`

### Impactos
| Alvo | Impacto |
|------|---------|
| TMS admin | Nenhum (usa ae_update_tms por tenant, não a policy de prestador) |
| AppPrestador.tsx | 4 funções viram RPC — retorno muda de `{sucesso, dados}` para `{sucesso}`, state local precisa adaptar |
| PortalPrestador | 4 funções viram RPC — store precisa adaptar retorno |
| Flutter App Motorista | Nenhum (já usa RPCs próprios, não usa essas funções TS) |
| f_aceitar_oportunidade_rede | **CORRIGIDO** — agora valida auth.uid() + GRANT EXECUTE adicionado |

---

## Comparação Rápida

| Item | PROPOSTA 1 (Transição) | PROPOSTA 2 (Completa) |
|------|:----------------------:|:---------------------:|
| Policy removida? | ❌ Mantida | ✅ Removida |
| Trigger de colunas? | ✅ Sim | ❌ Não |
| RPCs criadas | 2 (recusar, finalizar) | 4 (aceitar, recusar, iniciar, finalizar) |
| f_aceitar_oportunidade_rede corrigido? | ❌ Não | ✅ Sim |
| TS modificado | 4 funções (recusar + finalizar em 2 arquivos) | 8 funções (todas) |
| Risco de quebra | Baixo (2 funções mudam) | Alto (6 funções mudam) |
| Segurança final | Média (trigger + policy) | Alta (só RPCs SECDEF) |
| Tempo | ~4h | ~9h |
| Rollback | Simples (DROP trigger) | Complexo (precisa restaurar policy, reverter TS) |
