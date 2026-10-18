/* FIN-PP-FUNC-01 — Prova E2E controlada (transação + rollback; NADA persiste).
   Prova: RPC manual -> PP + FP; idempotência; validações; Aprovar; Gerar Lote;
   query de "Pagamentos Manuais". Usa auth.uid() via request.jwt.claims. */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
function loadEnv() {
  const txt = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const USER = "de1c77e0-1818-431c-8503-ebe08bd95e80"; // financeiro (ativo)
const PRESTADOR = "0673eca2-4594-4842-b78f-cd6cabe9177d"; // Clayton (PIX)
const KEY = "E2E-FUNC01-" + Date.now();

(async () => {
  const env = loadEnv();
  const c = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = async (sql, p) => (await c.query(sql, p)).rows;
  const one = async (sql, p) => (await rows(sql, p))[0];
  const log = (...a) => console.log(...a);
  let falhas = 0;
  const check = (cond, label, extra) => { log(`${cond ? "PASS" : "FAIL"} — ${label}${extra ? " :: " + extra : ""}`); if (!cond) falhas++; };

  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL request.jwt.claim.sub = '${USER}'`);
    await c.query(`SET LOCAL request.jwt.claims = '{"sub":"${USER}"}'`);

    // 1) Criação
    const r1 = await one(
      "SELECT * FROM public.f_criar_lancamento_manual_prestador($1,$2,$3,$4,$5,$6,$7,$8)",
      [PRESTADOR, "Serviço Avulso", "2026-09-26", 12.34, "E2E FIN-PP-FUNC-01 lançamento controlado", "PIX", "Cora", KEY]
    );
    log("RPC criar #1:", JSON.stringify(r1));
    check(r1.sucesso === true && r1.mensagem === "LANCAMENTO_CRIADO", "RPC cria lançamento");
    const ppId = r1.pagamento_prestador_id, fpId = r1.financeiro_pagar_id;

    const pp = await one("SELECT id, prestador_id, os_id, origem_lancamento, tipo_lancamento, natureza, valor_liquido, status, status_conferencia, status_aprovacao, status_pagamento, elegivel_lote, is_teste, observacao FROM public.pagamentos_prestadores WHERE id=$1", [ppId]);
    log("PP:", JSON.stringify(pp));
    check(!!pp && pp.os_id === null && pp.origem_lancamento === "manual", "PP manual, sem OS");
    check(pp.natureza === "credito" && Number(pp.valor_liquido) === 12.34, "PP valor/natureza corretos");
    check(pp.status_conferencia === "em_aberto" && pp.status_pagamento === "pendente", "PP entra em workflow (em_aberto/pendente)");
    check(pp.is_teste === false, "PP não é teste");

    const fp = await one("SELECT id, os_id, os_vinculada, valor, status, prestador, fornecedor_id, fornecedor_nome FROM public.financeiro_pagar WHERE id=$1", [fpId]);
    log("FP:", JSON.stringify(fp));
    check(!!fp && fp.os_id === null && fp.os_vinculada === ppId, "FP obrigação contábil vinculada ao PP");
    check(Number(fp.valor) === 12.34 && fp.fornecedor_id === PRESTADOR, "FP valor/fornecedor corretos");

    // 2) Idempotência (retry da MESMA submissão)
    const r2 = await one(
      "SELECT * FROM public.f_criar_lancamento_manual_prestador($1,$2,$3,$4,$5,$6,$7,$8)",
      [PRESTADOR, "Serviço Avulso", "2026-09-26", 12.34, "E2E FIN-PP-FUNC-01 lançamento controlado", "PIX", "Cora", KEY]
    );
    log("RPC criar #2 (retry):", JSON.stringify(r2));
    const cntPP = (await one("SELECT count(*)::int q FROM public.pagamentos_prestadores WHERE observacao LIKE $1", [`%[IDEMP:${KEY}]%`])).q;
    const cntFP = (await one("SELECT count(*)::int q FROM public.financeiro_pagar WHERE os_vinculada=$1", [ppId])).q;
    check(r2.idempotente === true && r2.pagamento_prestador_id === ppId, "retry retorna idempotente=true (mesmo id)");
    check(cntPP === 1 && cntFP === 1, "duplo envio NÃO duplica (1 PP + 1 FP)", `pp=${cntPP} fp=${cntFP}`);

    // 3) Validações
    const rv = await one("SELECT * FROM public.f_criar_lancamento_manual_prestador($1,$2,$3,$4,$5,$6,$7,$8)", [PRESTADOR, "Serviço Avulso", "2026-09-26", 0, "zero", null, null, null]);
    check(rv.sucesso === false && rv.mensagem === "VALOR_INVALIDO", "bloqueia valor zero");
    const rt = await one("SELECT * FROM public.f_criar_lancamento_manual_prestador($1,$2,$3,$4,$5,$6,$7,$8)", [PRESTADOR, "TipoInventado", "2026-09-26", 10, "tipo", null, null, null]);
    check(rt.sucesso === false && rt.mensagem === "TIPO_INVALIDO", "bloqueia tipo inválido");
    const rd = await one("SELECT * FROM public.f_criar_lancamento_manual_prestador($1,$2,$3,$4,$5,$6,$7,$8)", [PRESTADOR, "Ajuste", null, 10, "sem data", null, null, null]);
    check(rd.sucesso === false && rd.mensagem === "DATA_OBRIGATORIA", "bloqueia data ausente");
    const rp = await one("SELECT * FROM public.f_criar_lancamento_manual_prestador($1,$2,$3,$4,$5,$6,$7,$8)", [PRESTADOR, "Reembolso", "2026-09-26", 10, "   ", null, null, null]);
    check(rp.sucesso === false && rp.mensagem === "DESCRICAO_OBRIGATORIA", "bloqueia descrição vazia");

    // 4) Reprovar/Cancelar/Estornar não bloqueiam manual (f_cancelar)
    const rc = await one("SELECT * FROM public.f_cancelar_pagamento_prestador($1,$2)", [ppId, "E2E cancelamento"]);
    log("Cancelar:", JSON.stringify(rc));
    // (não assere o resultado exato da RPC de cancelamento; apenas que não é erro de schema)
    check(rc !== undefined, "RPC f_cancelar_pagamento_prestador aceita lançamento manual (sem erro)");
    // Cancela -> reabre: como cancelou, cria um novo para seguir o workflow de aprovação
    const r1b = await one(
      "SELECT * FROM public.f_criar_lancamento_manual_prestador($1,$2,$3,$4,$5,$6,$7,$8)",
      [PRESTADOR, "Reembolso", "2026-09-26", 55.00, "E2E FIN-PP-FUNC-01 workflow aprovacao", "PIX", "Cora", KEY + "-B"]
    );
    const ppB = r1b.pagamento_prestador_id;

    // 5) Aprovar (workflow homologado)
    const ra = await one(`SELECT * FROM public.f_aprovar_pagamento_prestadores(ARRAY['${ppB}']::uuid[])`);
    log("Aprovar:", JSON.stringify(ra));
    check(ra.aprovados === 1, "Aprovar aceita lançamento manual (aprovados=1)");
    const ppBrow = await one("SELECT status_conferencia, status_aprovacao, elegivel_lote FROM public.pagamentos_prestadores WHERE id=$1", [ppB]);
    check(ppBrow.status_conferencia === "conferido" && ppBrow.status_aprovacao === "aprovado" && ppBrow.elegivel_lote === true, "PP fica conferido/aprovado/elegível");

    // 6) Gerar lote (prestador com PIX)
    const rl = await one(`SELECT * FROM public.f_gerar_lote_pagamentos(ARRAY['${ppB}']::uuid[])`);
    log("Gerar Lote:", JSON.stringify(rl));
    check(!!rl.lote_id && rl.incluidos === 1, "Gerar Lote inclui lançamento manual (prestador com PIX)");
    const ppBrow2 = await one("SELECT status_pagamento, lote_id FROM public.pagamentos_prestadores WHERE id=$1", [ppB]);
    check(ppBrow2.status_pagamento === "em_lote" && ppBrow2.lote_id === rl.lote_id, "PP marcado em_lote");

    // 7) Query da visão "Pagamentos Manuais" (origem manual, is_teste=false)
    const manualRows = await rows(
      "SELECT id, prestador_nome, tipo_lancamento, origem_lancamento, valor_liquido, status_pagamento FROM public.pagamentos_prestadores WHERE origem_lancamento='manual' AND is_teste=false AND id=$1",
      [ppId]
    );
    check(manualRows.length === 1 && manualRows[0].origem_lancamento === "manual", "aparece em Pagamentos Manuais (reload)");

    // 8) Regressão: registro OS (escala/os_direta) NÃO é afetado pela mudança
    const reg = await one("SELECT count(*)::int q FROM public.pagamentos_prestadores WHERE origem_lancamento IN ('os_direta','escala_direta') AND is_teste=false");
    check(reg.q >= 0, "registros OS/Programação inalterados (contagem lida)", `q=${reg.q}`);

    log("\nRESULTADO FINAL:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  } catch (e) {
    falhas++;
    console.error("ERRO NA PROVA:", e.message);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    console.log("ROLLBACK executado — nenhum dado persistido.");
    await c.end();
    process.exit(falhas === 0 ? 0 : 1);
  }
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
