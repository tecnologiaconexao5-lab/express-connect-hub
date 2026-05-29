-- Migration: Add DB-side numbering for OS and portal invoices
-- Safe and idempotent: uses CREATE OR REPLACE FUNCTION and DROP TRIGGER IF EXISTS.

CREATE OR REPLACE FUNCTION public.gerar_numero_ordem_servico()
RETURNS text AS $$
DECLARE
  ano_mes text;
  proximo_numero integer;
BEGIN
  ano_mes := to_char(now(), 'YYYYMM');

  SELECT COALESCE(MAX(
    CASE
      WHEN numero ~ ('^OS-' || ano_mes || '-[0-9]{6}$')
      THEN NULLIF(SUBSTRING(numero FROM 11 FOR 6), '')::integer
      ELSE NULL
    END
  ), 0) + 1
  INTO proximo_numero
  FROM public.ordens_servico
  WHERE numero LIKE 'OS-' || ano_mes || '-%';

  RETURN 'OS-' || ano_mes || '-' || LPAD(proximo_numero::text, 6, '0');
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.set_numero_ordem_servico()
RETURNS trigger AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.gerar_numero_ordem_servico();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ordens_servico_gerar_numero ON public.ordens_servico;
CREATE TRIGGER trg_ordens_servico_gerar_numero
BEFORE INSERT ON public.ordens_servico
FOR EACH ROW
WHEN (NEW.numero IS NULL OR NEW.numero = '')
EXECUTE FUNCTION public.set_numero_ordem_servico();

CREATE OR REPLACE FUNCTION public.gerar_numero_fatura()
RETURNS text AS $$
DECLARE
  proximo_numero integer;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN numero ~ '^FAT-[0-9]{6}$'
      THEN NULLIF(SUBSTRING(numero FROM 5 FOR 6), '')::integer
      ELSE NULL
    END
  ), 0) + 1
  INTO proximo_numero
  FROM public.portal_faturas;

  RETURN 'FAT-' || LPAD(proximo_numero::text, 6, '0');
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.set_numero_fatura()
RETURNS trigger AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.gerar_numero_fatura();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_portal_faturas_gerar_numero ON public.portal_faturas;
CREATE TRIGGER trg_portal_faturas_gerar_numero
BEFORE INSERT ON public.portal_faturas
FOR EACH ROW
WHEN (NEW.numero IS NULL OR NEW.numero = '')
EXECUTE FUNCTION public.set_numero_fatura();
