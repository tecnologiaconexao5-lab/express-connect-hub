// Diagnóstico 02B.2 — tenant oficial + teste da RPC em transação com ROLLBACK.
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

function carregarDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = path.resolve(__dirname, "..", ".env");
  const linha = fs
    .readFileSync(env, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  return linha.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const payload = {
  tipo_oferta: "motoboy",
  nome: "Motoboy Teste 02B2",
  telefone: "11988887777",
  email: "motoboy.teste@conexaoexpress.com.br",
  cidade: "Sao Paulo",
  uf: "SP",
  regioes: ["Grande SP", "ABC Paulista"],
  dias_disponiveis: [1, 2, 3, 4, 5],
  horario_inicio: "08:00",
  horario_fim: "18:00",
  modalidades: ["esporadica", "fixa"],
  tipo_moto: "Outra",
  possui_bau: true,
  capacidade_bau_litros: 90,
  veiculo_categoria: "proprio",
  veiculo_tipo: "moto",
  veiculo_modelo: "CG 160",
  caracteristicas: [
    "categoria_atuacao:motoboy",
    "compartimento:bau",
    "busca_contrato:ambos",
    "marca_moto:Honda",
    "cilindrada:160",
    "modalidade_adicional:Cobertura",
  ],
  capacidade_kg: null,
  capacidade_m3: null,
  dimensoes: { comprimento_m: null, largura_m: null, altura_m: null },
  valor_diaria: 250,
  valor_km: null,
  valor_saida: null,
  valor_mensal: null,
  valor_negociavel: false,
  condicoes_comerciais: "Valor semanal: R$ 1.500",
  restricoes: "Atende finais de semana.",
  observacoes:
    "Local principal de carregamento: Grande SP | Media de faturamento mensal atual: R$ 4.000 a R$ 6.000 | Valor semanal: R$ 1.500 | Imprevisto/atraso na rota: Aviso imediatamente a base/suporte | O que mais valoriza na parceria: Suporte rapido e eficiente",
  lgpd_consent: true,
  lgpd_termo_versao: "2026-11-v1",
};

(async () => {
  const client = new pg.Client({
    connectionString: carregarDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const tenants = await client.query(`
      SELECT id, nome, status, criado_em
        FROM public.tenants
       ORDER BY criado_em ASC NULLS LAST`);
    console.log("TENANTS:");
    console.table(
      tenants.rows.map((t) => ({
        id: t.id,
        nome: t.nome,
        status: t.status,
        criado_em: t.criado_em,
      })),
    );

    const ofertas = await client.query(
      "SELECT count(*)::int AS total, max(created_at) AS ultimo FROM public.recrutamento_ofertas",
    );
    console.log("OFERTAS:", ofertas.rows[0]);

    const oficial = tenants.rows.find((t) => /conex/i.test(String(t.nome || "")));
    const tenantId = oficial?.id || tenants.rows[0]?.id;
    console.log("TENANT ALVO:", tenantId, oficial?.nome);

    if (!tenantId) return;

    await client.query("BEGIN");
    try {
      const r = await client.query(
        `SELECT public.f_registrar_oferta_publica(
           $1::uuid, $2::jsonb, $3::text, $4::text, $5::text
         ) AS resultado`,
        [tenantId, JSON.stringify(payload), null, "diag-ip-hash", "diag-ua-hash"],
      );
      console.log("RPC OK (rollback):", r.rows[0].resultado);
    } catch (err) {
      console.log("RPC FALHOU:", {
        message: err.message,
        code: err.code,
        detail: err.detail,
        hint: err.hint,
      });
    } finally {
      await client.query("ROLLBACK");
    }
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
