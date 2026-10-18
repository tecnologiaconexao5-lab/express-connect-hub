// FIN-MASTER-361.1 — Aplicação corrigida da migration
// Correção: DROP da assinatura antiga (10 params) antes do CREATE OR REPLACE (11 params)
import pg from "pg";

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error("DATABASE_URL não definida"); process.exit(1); }

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log("=== FIN-MASTER-361.1 — APLICANDO MIGRATION CORRIGIDA ===\n");

  // PASSO 0: Verificar assinatura antiga
  const oldSig = await client.query(`
    SELECT pg_get_function_arguments(oid) as args
    FROM pg_proc WHERE proname = 'f_registrar_baixa_financeira'
    AND pronamespace = 'public'::regnamespace
    ORDER BY oid
  `);
  console.log("Assinaturas existentes:");
  oldSig.rows.forEach((r,i) => console.log(`  ${i+1}: (${r.args})`));

  // PASSO 1: DROP da assinatura antiga (10 params) se existir
  console.log("\n[PASSO 1] Removendo assinatura antiga (10 params)...");
  try {
    await client.query(`
      DROP FUNCTION IF EXISTS public.f_registrar_baixa_financeira(
        text, uuid, numeric, date, text, text, text, text, uuid, text
      )
    `);
    console.log("  OK — assinatura antiga removida");
  } catch (e) {
    console.error("  ERRO:", e.message);
    process.exit(1);
  }

  // PASSO 2: Criar a nova assinatura (11 params)
  console.log("\n[PASSO 2] Criando nova assinatura (11 params)...");
  const rpcSql = `
CREATE OR REPLACE FUNCTION public.f_registrar_baixa_financeira(
    p_titulo_tabela       TEXT,
    p_titulo_id           UUID,
    p_valor_baixado       NUMERIC,
    p_data_baixa          DATE DEFAULT CURRENT_DATE,
    p_forma_pagamento     TEXT DEFAULT NULL,
    p_conta_financeira    TEXT DEFAULT NULL,
    p_conta_financeira_id UUID DEFAULT NULL,
    p_referencia_bancaria TEXT DEFAULT NULL,
    p_observacao          TEXT DEFAULT NULL,
    p_usuario_id          UUID DEFAULT NULL,
    p_usuario_nome        TEXT DEFAULT NULL
)
RETURNS TABLE(sucesso BOOLEAN, mensagem TEXT, baixa_id UUID, saldo_restante NUMERIC, status_titulo TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_valor_original   NUMERIC(18,2);
    v_status_atual     TEXT;
    v_total_baixado    NUMERIC(18,2);
    v_saldo            NUMERIC(18,2);
    v_novo_saldo       NUMERIC(18,2);
    v_novo_status      TEXT;
    v_baixa_id         UUID;
    v_linha_historico  TEXT;
BEGIN
    IF p_valor_baixado IS NULL OR p_valor_baixado <= 0 THEN
        RETURN QUERY SELECT false, 'Valor da baixa deve ser maior que zero.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF p_titulo_tabela = 'financeiro_pagar' THEN
        SELECT valor, status INTO v_valor_original, v_status_atual
          FROM public.financeiro_pagar WHERE id = p_titulo_id FOR UPDATE;
    ELSIF p_titulo_tabela = 'financeiro_receber' THEN
        SELECT valor, status INTO v_valor_original, v_status_atual
          FROM public.financeiro_receber WHERE id = p_titulo_id FOR UPDATE;
    ELSE
        RETURN QUERY SELECT false, 'Tabela de título não suportada.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Título não encontrado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_status_atual IN ('cancelado','cancelada') THEN
        RETURN QUERY SELECT false, 'Não é permitido baixar título cancelado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_status_atual IN ('pago','paga') THEN
        RETURN QUERY SELECT false, 'Título já quitado. Não é permitida nova baixa.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    SELECT COALESCE(SUM(valor_baixado), 0) INTO v_total_baixado
      FROM public.financeiro_baixas
     WHERE titulo_tabela = p_titulo_tabela AND titulo_id = p_titulo_id AND NOT estornada;

    v_saldo := v_valor_original - v_total_baixado;

    IF v_saldo <= 0 THEN
        RETURN QUERY SELECT false, 'Título já quitado. Não é permitida nova baixa.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF p_valor_baixado > v_saldo THEN
        RETURN QUERY SELECT false,
            'Valor da baixa excede o saldo restante (' || v_saldo || ').',
            NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    v_novo_saldo := v_saldo - p_valor_baixado;

    IF v_novo_saldo < 0 THEN
        RETURN QUERY SELECT false, 'Saldo não pode ficar negativo.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_novo_saldo > 0 THEN
        v_novo_status := 'parcial';
    ELSE
        v_novo_status := 'pago';
    END IF;

    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
        referencia_bancaria, observacao, usuario_id, usuario_nome
    ) VALUES (
        p_titulo_tabela, p_titulo_id, v_valor_original, p_valor_baixado, v_novo_saldo,
        p_data_baixa, p_forma_pagamento, p_conta_financeira, p_conta_financeira_id,
        p_referencia_bancaria, p_observacao, p_usuario_id, p_usuario_nome
    ) RETURNING id INTO v_baixa_id;

    v_linha_historico := 'Baixa R$ ' || p_valor_baixado || ' em ' || p_data_baixa
                         || '. Saldo restante: R$ ' || v_novo_saldo || '.';

    IF p_titulo_tabela = 'financeiro_pagar' THEN
        UPDATE public.financeiro_pagar
           SET status            = v_novo_status,
               data_pagamento    = p_data_baixa,
               data_efetiva_pgto = p_data_baixa,
               conta_pagadora    = COALESCE(p_conta_financeira, conta_pagadora),
               observacoes       = CASE
                                     WHEN observacoes IS NULL OR observacoes = '' THEN v_linha_historico
                                     ELSE observacoes || E'\\n' || v_linha_historico
                                   END
         WHERE id = p_titulo_id;
    ELSE
        UPDATE public.financeiro_receber
           SET status            = v_novo_status,
               data_pagamento    = p_data_baixa,
               conta_entrada     = COALESCE(p_conta_financeira, conta_entrada),
               observacoes       = CASE
                                     WHEN observacoes IS NULL OR observacoes = '' THEN v_linha_historico
                                     ELSE observacoes || E'\\n' || v_linha_historico
                                   END
         WHERE id = p_titulo_id;
    END IF;

    RETURN QUERY SELECT true, 'Baixa registrada com sucesso.', v_baixa_id, v_novo_saldo, v_novo_status;
END;
$$;
  `;
  try {
    await client.query(rpcSql);
    console.log("  OK — nova assinatura criada");
  } catch (e) {
    console.error("  ERRO:", e.message);
    process.exit(1);
  }

  // PASSO 3: Grants da nova assinatura
  console.log("\n[PASSO 3] Configurando grants...");
  try {
    await client.query(`REVOKE ALL ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, uuid, text, text, uuid, text) FROM PUBLIC`);
    await client.query(`REVOKE ALL ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, uuid, text, text, uuid, text) FROM anon`);
    await client.query(`GRANT EXECUTE ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, uuid, text, text, uuid, text) TO authenticated`);
    await client.query(`GRANT EXECUTE ON FUNCTION public.f_registrar_baixa_financeira(text, uuid, numeric, date, text, text, uuid, text, text, uuid, text) TO service_role`);
    console.log("  OK — grants configurados");
  } catch (e) {
    console.error("  ERRO:", e.message);
    process.exit(1);
  }

  // PASSO 4: Tabela financeiro_transferencias
  console.log("\n[PASSO 4] Criando tabela financeiro_transferencias...");
  const tableSql = `
CREATE TABLE IF NOT EXISTS public.financeiro_transferencias (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at      TIMESTAMPTZ DEFAULT now(),
    data            DATE NOT NULL DEFAULT CURRENT_DATE,
    conta_origem_id UUID NOT NULL REFERENCES public.contas_financeiras(id),
    conta_destino_id UUID NOT NULL REFERENCES public.contas_financeiras(id),
    valor           NUMERIC(18,2) NOT NULL CHECK (valor > 0),
    taxa            NUMERIC(18,2) DEFAULT 0 CHECK (taxa >= 0),
    historico       TEXT,
    usuario_id      UUID,
    usuario_nome    TEXT,
    tenant_id       UUID DEFAULT public.current_tenant_id_safe()
);

COMMENT ON TABLE public.financeiro_transferencias IS 'FIN-MASTER-361: Transferências atômicas entre contas financeiras.';

CREATE INDEX IF NOT EXISTS idx_transferencias_origem ON public.financeiro_transferencias(conta_origem_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON public.financeiro_transferencias(conta_destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_data ON public.financeiro_transferencias(data);

ALTER TABLE public.financeiro_transferencias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transferencias_select_tenant' AND tablename = 'financeiro_transferencias') THEN
        CREATE POLICY transferencias_select_tenant ON public.financeiro_transferencias
            FOR SELECT USING (tenant_id = public.current_tenant_id_safe() OR public.current_tenant_id_safe() IS NULL);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'transferencias_insert_tenant' AND tablename = 'financeiro_transferencias') THEN
        CREATE POLICY transferencias_insert_tenant ON public.financeiro_transferencias
            FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id_safe() OR public.current_tenant_id_safe() IS NULL);
    END IF;
END $$;
  `;
  try {
    await client.query(tableSql);
    console.log("  OK — tabela criada");
  } catch (e) {
    console.error("  ERRO:", e.message);
    process.exit(1);
  }

  // PASSO 5: RPC f_transferir_entre_contas
  console.log("\n[PASSO 5] Criando RPC f_transferir_entre_contas...");
  const transferSql = `
CREATE OR REPLACE FUNCTION public.f_transferir_entre_contas(
    p_conta_origem_id   UUID,
    p_conta_destino_id  UUID,
    p_valor             NUMERIC,
    p_data              DATE DEFAULT CURRENT_DATE,
    p_taxa              NUMERIC DEFAULT 0,
    p_historico         TEXT DEFAULT NULL,
    p_usuario_id        UUID DEFAULT NULL,
    p_usuario_nome      TEXT DEFAULT NULL
)
RETURNS TABLE(sucesso BOOLEAN, mensagem TEXT, transferencia_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    v_transferencia_id UUID;
    v_origem_saldo     NUMERIC(18,2);
    v_total_sair       NUMERIC(18,2);
BEGIN
    IF p_valor IS NULL OR p_valor <= 0 THEN
        RETURN QUERY SELECT false, 'Valor da transferência deve ser maior que zero.', NULL::UUID;
        RETURN;
    END IF;

    IF p_conta_origem_id = p_conta_destino_id THEN
        RETURN QUERY SELECT false, 'Conta de origem e destino devem ser diferentes.', NULL::UUID;
        RETURN;
    END IF;

    SELECT saldo INTO v_origem_saldo
      FROM public.contas_financeiras
     WHERE id = p_conta_origem_id AND ativa = true
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Conta de origem não encontrada ou inativa.', NULL::UUID;
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.contas_financeiras WHERE id = p_conta_destino_id AND ativa = true) THEN
        RETURN QUERY SELECT false, 'Conta de destino não encontrada ou inativa.', NULL::UUID;
        RETURN;
    END IF;

    v_total_sair := p_valor + COALESCE(p_taxa, 0);
    IF v_origem_saldo < v_total_sair THEN
        RETURN QUERY SELECT false,
            'Saldo insuficiente na conta de origem. Disponível: R$ ' || v_origem_saldo || '. Necessário: R$ ' || v_total_sair || '.',
            NULL::UUID;
        RETURN;
    END IF;

    INSERT INTO public.financeiro_transferencias (
        data, conta_origem_id, conta_destino_id, valor, taxa,
        historico, usuario_id, usuario_nome, tenant_id
    ) VALUES (
        p_data, p_conta_origem_id, p_conta_destino_id, p_valor, p_taxa,
        COALESCE(p_historico, 'Transferência entre contas'),
        p_usuario_id, p_usuario_nome, public.current_tenant_id_safe()
    ) RETURNING id INTO v_transferencia_id;

    UPDATE public.contas_financeiras SET saldo = saldo - v_total_sair WHERE id = p_conta_origem_id;
    UPDATE public.contas_financeiras SET saldo = saldo + p_valor WHERE id = p_conta_destino_id;

    RETURN QUERY SELECT true, 'Transferência realizada com sucesso.', v_transferencia_id;
END;
$$;
  `;
  try {
    await client.query(transferSql);
    console.log("  OK — RPC criada");
  } catch (e) {
    console.error("  ERRO:", e.message);
    process.exit(1);
  }

  // PASSO 6: Grants da RPC de transferência
  console.log("\n[PASSO 6] Configurando grants de transferência...");
  try {
    await client.query(`REVOKE ALL ON FUNCTION public.f_transferir_entre_contas(uuid, uuid, numeric, date, numeric, text, uuid, text) FROM PUBLIC`);
    await client.query(`REVOKE ALL ON FUNCTION public.f_transferir_entre_contas(uuid, uuid, numeric, date, numeric, text, uuid, text) FROM anon`);
    await client.query(`GRANT EXECUTE ON FUNCTION public.f_transferir_entre_contas(uuid, uuid, numeric, date, numeric, text, uuid, text) TO authenticated`);
    await client.query(`GRANT EXECUTE ON FUNCTION public.f_transferir_entre_contas(uuid, uuid, numeric, date, numeric, text, uuid, text) TO service_role`);
    console.log("  OK — grants configurados");
  } catch (e) {
    console.error("  ERRO:", e.message);
    process.exit(1);
  }

  console.log("\n=== MIGRATION APLICADA COM SUCESSO ===");
  await client.end();
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
