// A31-J1.6 — reprodução read-only do caminho save→trigger→read (nada persiste)
import "dotenv/config";
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

await c.query("BEGIN");

// 1. Simular o INSERT do lancarServicoManual (cenário do bug)
const ins = await c.query(
  `INSERT INTO public.alocacoes_escala
     (data_escala, tipo_veiculo, placa, status, status_pagamento, finalizada,
      km_realizados, valor_frete, valor_repasse, valor_pedagio, valor_adicional,
      valor_desconto, metadata)
   VALUES (CURRENT_DATE, 'HR', 'X', 'concluida', 'pendente', true,
           159.6, 600, 520, 66.43, 0, 0,
           jsonb_build_object('numeroOC', 'TEST-J16', 'origem', 'central_financeira_manual'))
   RETURNING id;`);
const alocId = ins.rows[0].id;
console.log("alocacao id:", alocId);

// 2. Ler a linha de volta (o que a Central lê)
const row = await c.query(`SELECT id, valor_frete, valor_repasse, valor_pedagio, valor_adicional,
  valor_combustivel, valor_ajudante, diarias_adicionais, valor_diaria,
  valor_reembolso_outros, valor_desconto, km_realizados, metadata
  FROM public.alocacoes_escala WHERE id=$1`, [alocId]);
const a = row.rows[0];
console.log("APÓS INSERT+TRIGGER — alocação:", JSON.stringify(a, null, 2));

// 3. Reconstruir a Central (centralFinanceiroService) para esta linha
const N = (v) => (v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
const pedagioPrestador = N(a.valor_pedagio);
const outrosPrestador = N(a.valor_adicional);
const adicionaisPrestador = pedagioPrestador + N(a.valor_combustivel) + N(a.valor_ajudante)
  + (N(a.diarias_adicionais) * N(a.valor_diaria)) + 0 + N(a.valor_reembolso_outros) + outrosPrestador;
const valorPrestadorTotal = N(a.valor_repasse) + adicionaisPrestador - N(a.valor_desconto);
const outrosCliente = N(a.valor_adicional);
const valorClienteTotal = N(a.valor_frete) + outrosCliente - N(a.valor_desconto);
console.log("\nCENTRAL (read):");
console.log("  Base prestador:", N(a.valor_repasse));
console.log("  Adicionais/reembolsos prestador:", adicionaisPrestador, "(pedagio", pedagioPrestador, "+ outros", outrosPrestador, ")");
console.log("  Total prestador:", valorPrestadorTotal);
console.log("  Cliente Outros adicionais:", outrosCliente, "| Total cliente:", valorClienteTotal);

// 4. O que a trigger gravou nas tabelas propagadas
const pag = await c.query(`SELECT os_id, valor_servicos, valor_liquido, pedagio, adicionais FROM public.pagamentos_prestadores WHERE os_id=$1 OR alocacao_id=$1`, [alocId]);
console.log("\npagamentos_prestadores (trigger M66):", JSON.stringify(pag.rows, null, 2));

const os = await c.query(`SELECT id, valor_cliente, custo_prestador, pedagio FROM public.ordens_servico WHERE id=$1`, [alocId]);
console.log("ordens_servico (trigger M66):", JSON.stringify(os.rows, null, 2));

// 5. valor_adicional realmente veio 66.43? (verifica se alguma trigger sobrescreveu)
console.log("\n>>> Se valor_adicional for 66.43 e valor_pedagio 66.43 -> DUPLICAÇÃO NO BANCO confirmada.");
console.log(">>> Se valor_adicional = 0 -> duplicação está no CÓDIGO (Central/modal).");

await c.query("ROLLBACK");
await c.end();
