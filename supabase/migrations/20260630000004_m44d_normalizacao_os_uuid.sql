-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 44D — NORMALIZAÇÃO ordens_servico (UUID vs TEXT)
-- Resolve P3: trigger quebrava INSERT quando colunas TEXT (cliente, prestador,
-- veiculo_alocado) eram preenchidas sem as UUIDs correspondentes.
-- 
-- Regra: cliente_id / prestador_id / placa_alocada UUID são fonte da verdade.
-- Colunas TEXT (cliente, prestador, veiculo_alocado) são derivadas/fallback.
-- Um BEFORE INSERT/UPDATE trigger resolve automaticamente TEXT → UUID quando
-- as colunas UUID não são fornecidas.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Função de normalização: resolve colunas TEXT para UUID quando as UUIDs são nulas
CREATE OR REPLACE FUNCTION public.normalizar_os_fks()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_id uuid;
    v_prestador_id uuid;
    v_placa_id uuid;
BEGIN
    -- 1. Resolver cliente: se cliente_id é NULL mas cliente TEXT foi preenchido
    IF NEW.cliente_id IS NULL AND NEW.cliente IS NOT NULL AND NEW.cliente != '' THEN
        SELECT id INTO v_cliente_id
        FROM public.clientes
        WHERE razao_social = NEW.cliente
           OR nome_fantasia = NEW.cliente
        LIMIT 1;
        
        IF v_cliente_id IS NOT NULL THEN
            NEW.cliente_id := v_cliente_id;
        ELSE
            -- Não encontrou: limpa a coluna TEXT para evitar erro em triggers downstream
            NEW.cliente := NULL;
        END IF;
    END IF;

    -- Se cliente_id foi fornecido mas cliente TEXT não, preenche o fallback TEXT
    IF NEW.cliente_id IS NOT NULL AND (NEW.cliente IS NULL OR NEW.cliente = '') THEN
        SELECT razao_social INTO NEW.cliente
        FROM public.clientes
        WHERE id = NEW.cliente_id;
    END IF;

    -- 2. Resolver prestador: se prestador_id é NULL mas prestador TEXT foi preenchido
    IF NEW.prestador_id IS NULL AND NEW.prestador IS NOT NULL AND NEW.prestador != '' THEN
        SELECT id INTO v_prestador_id
        FROM public.prestadores
        WHERE nome_completo = NEW.prestador
        LIMIT 1;
        
        IF v_prestador_id IS NOT NULL THEN
            NEW.prestador_id := v_prestador_id;
        ELSE
            NEW.prestador := NULL;
        END IF;
    END IF;

    -- Se prestador_id foi fornecido mas prestador TEXT não, preenche o fallback TEXT
    IF NEW.prestador_id IS NOT NULL AND (NEW.prestador IS NULL OR NEW.prestador = '') THEN
        SELECT nome_completo INTO NEW.prestador
        FROM public.prestadores
        WHERE id = NEW.prestador_id;
    END IF;

    -- 3. Resolver veículo: se placa_alocada é NULL mas veiculo_alocado TEXT foi preenchido
    IF NEW.placa_alocada IS NULL AND NEW.veiculo_alocado IS NOT NULL AND NEW.veiculo_alocado != '' THEN
        SELECT id INTO v_placa_id
        FROM public.veiculos
        WHERE placa = UPPER(NEW.veiculo_alocado)
           OR id::text = NEW.veiculo_alocado  -- caso receba UUID em coluna TEXT
        LIMIT 1;
        
        IF v_placa_id IS NOT NULL THEN
            NEW.placa_alocada := v_placa_id;
        ELSE
            NEW.veiculo_alocado := NULL;
        END IF;
    END IF;

    -- Se placa_alocada foi fornecida mas veiculo_alocado TEXT não, preenche o fallback TEXT
    IF NEW.placa_alocada IS NOT NULL AND (NEW.veiculo_alocado IS NULL OR NEW.veiculo_alocado = '') THEN
        SELECT placa INTO NEW.veiculo_alocado
        FROM public.veiculos
        WHERE id = NEW.placa_alocada;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_normalizar_os_fks ON public.ordens_servico;
CREATE TRIGGER trg_normalizar_os_fks
    BEFORE INSERT OR UPDATE ON public.ordens_servico
    FOR EACH ROW
    EXECUTE FUNCTION public.normalizar_os_fks();

-- 4. COMENTÁRIOS
COMMENT ON FUNCTION public.normalizar_os_fks() IS 'Missão 44D: normaliza cliente_id/prestador_id/placa_alocada a partir das colunas TEXT equivalentes (cliente, prestador, veiculo_alocado). Resolve em ambos os sentidos: TEXT→UUID e UUID→TEXT.';
COMMENT ON COLUMN public.ordens_servico.cliente IS 'Nome do cliente (derivado de cliente_id via trigger normalizar_os_fks). Fonte da verdade: cliente_id UUID.';
COMMENT ON COLUMN public.ordens_servico.prestador IS 'Nome do prestador (derivado de prestador_id via trigger normalizar_os_fks). Fonte da verdade: prestador_id UUID.';
COMMENT ON COLUMN public.ordens_servico.veiculo_alocado IS 'Placa do veículo (derivado de placa_alocada via trigger normalizar_os_fks). Fonte da verdade: placa_alocada UUID.';
