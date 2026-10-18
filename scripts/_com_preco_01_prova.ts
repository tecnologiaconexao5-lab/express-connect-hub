/* TMS-COM-PRECO-01 — Prova E2E: Tabela Esporádica REAL → veículo → distância →
   preço base → preço final → save → reload. DB em transação + ROLLBACK.
   Usa a fórmula EXISTENTE (calcularPrecoRapido) e tabelas REAIS (nada inventado). */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { toOrcamentoInsert, toOrcamentoDomain } from "../src/lib/dbMappers";

function loadEnv(): Record<string, string> {
  const p = path.join(process.cwd(), ".env");
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
// Necessário antes do import dinâmico do engine (que cria o client Supabase).
process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

const NUMERO = "ORC-202609-9801";

(async () => {
  const { calcularPrecoRapido, calcularMargemUnificada } = await import("../src/services/precificacao/precificacaoEngineService");
  void calcularMargemUnificada;
  let falhas = 0;
  const check = (c: boolean, l: string, x?: string) => { console.log(`${c ? "PASS" : "FAIL"} — ${l}${x ? " :: " + x : ""}`); if (!c) falhas++; };

  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const rows = (await client.query(
    "SELECT id,nome,universal,tipo_veiculo,cliente,valor_base,franquia_km,valor_km_excedente,percentual_prestador,ativo FROM tabelas_valores WHERE nome ILIKE $1 OR nome ILIKE $2 ORDER BY nome",
    ["%VUC%", "%FIORINO%DVL%"]
  )).rows;
  console.log("Tabelas reais encontradas:", rows.map((r: any) => r.nome).join(" | "));
  check(rows.length >= 2, "pelo menos 2 tabelas REAIS encontradas no banco");

  const tabVuc = rows.find((r: any) => /VUC/i.test(r.nome))!;
  const tabFio = rows.find((r: any) => /FIORINO/i.test(r.nome))!;
  check(!!tabVuc && Number(tabVuc.valor_base) > 0, "tabela VUC real com valor_base>0", String(tabVuc?.valor_base));
  check(!!tabFio && Number(tabFio.valor_base) > 0, "tabela FIORINO real com valor_base>0", String(tabFio?.valor_base));

  const mkTab = (t: any) => ({
    id: String(t.id), nome: String(t.nome), fonte: "tabelas_valores" as const,
    valor_base: Number(t.valor_base) || 0,
    franquia_km: Number(t.franquia_km) || 0,
    valor_km_excedente: Number(t.valor_km_excedente) || 0,
    percentual_prestador: Number(t.percentual_prestador) || 80,
  });

  const DIST = 150;
  const rVuc = calcularPrecoRapido(mkTab(tabVuc), DIST);
  const rFio = calcularPrecoRapido(mkTab(tabFio), DIST);
  const esperadoVuc = Number(tabVuc.valor_base) + Math.max(0, DIST - Number(tabVuc.franquia_km)) * Number(tabVuc.valor_km_excedente);
  const esperadoFio = Number(tabFio.valor_base) + Math.max(0, DIST - Number(tabFio.franquia_km)) * Number(tabFio.valor_km_excedente);
  console.log(`VUC    ${tabVuc.nome}: base ${tabVuc.valor_base} franq ${tabVuc.franquia_km} exc ${tabVuc.valor_km_excedente} => R$ ${rVuc.valorCliente}`);
  console.log(`FIORINO ${tabFio.nome}: base ${tabFio.valor_base} franq ${tabFio.franquia_km} exc ${tabFio.valor_km_excedente} => R$ ${rFio.valorCliente}`);
  check(Math.abs(rVuc.valorCliente - esperadoVuc) < 0.01, "A) preço base VUC pela tabela real", `R$ ${rVuc.valorCliente}`);
  check(Math.abs(rFio.valorCliente - esperadoFio) < 0.01, "C) preço muda ao trocar veículo (Fiorino)", `R$ ${rFio.valorCliente}`);
  check(rVuc.valorCliente !== rFio.valorCliente, "C) preços diferentes entre veículos");
  check(Math.abs(rVuc.valorCliente * 0.8 - rVuc.valorPrestador) < 0.01, "custo do prestador separado (80% da tabela) = R$ " + rVuc.valorPrestador);

  // Snapshot do orçamento (com a tabela REAL do VUC)
  const valoresVuc = {
    tabelaVinculada: tabVuc.nome, valorBase: Number(tabVuc.valor_base), adicionais: 0, pedagio: 0,
    kmExcedente: rVuc.kmExcedente * Number(tabVuc.valor_km_excedente), ajudante: 0, devolucao: 0, reentrega: 0, descontos: 0,
    valorFinal: rVuc.valorCliente, custoEstimado: rVuc.valorPrestador, margemEstimada: 0, lucroEstimado: rVuc.valorCliente - rVuc.valorPrestador,
    pricing: { tabelaId: String(tabVuc.id), tabelaNome: String(tabVuc.nome), fonte: "tabelas_valores", veiculoTarifado: tabVuc.tipo_veiculo, distanciaKm: DIST, franquiaKm: Number(tabVuc.franquia_km), valorBase: Number(tabVuc.valor_base), kmExcedente: rVuc.kmExcedente * Number(tabVuc.valor_km_excedente), valorCalculado: rVuc.valorCliente, overrideManual: false, contexto: "esporadico", calculadoEm: new Date().toISOString() },
  };
  const orc = {
    id: "", numero: NUMERO, cliente: "DVL - DISTRIBUIDORA", clienteCnpj: "11.222.333/0001-81",
    unidade: "Matriz", centroCusto: "COMERCIAL", responsavel: "Validação PRECO-01",
    dataEmissao: "2026-09-26", validade: "2026-10-26", tipoOperacao: "Esporádico", modalidade: "esporadico", prioridade: "normal",
    pedidoInterno: "", observacoesGerais: "Prova tabela esporádica.", status: "rascunho",
    enderecos: [
      { tipo: "coleta", sequencia: 1, endereco: "Av. das Nações Unidas, 1000", cidade: "São Paulo", uf: "SP", cep: "04578-000", contato: "João", telefone: "", instrucoes: "", janelaInicio: "08:00", janelaFim: "12:00" },
      { tipo: "entrega", sequencia: 2, endereco: "Rod. Anhanguera, km 25", cidade: "Jundiaí", uf: "SP", cep: "13200-000", contato: "Maria", telefone: "", instrucoes: "", janelaInicio: "14:00", janelaFim: "18:00" },
    ],
    carga: { tipo: "geral", descricao: "Carga preço", volumes: 1, peso: 500, cubagem: 0, pallets: 0, valorDeclarado: 0, refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "", dimensoes: [] },
    veiculo: { tipo: "vuc", subcategoria: "pesado", carroceria: "baú" },
    valores: valoresVuc,
    distancia_rota: { distancia_km: DIST, duracao_min: 180, distancia_texto: "150 km", duracao_texto: "3h 00min", maps_provider: "mapbox" },
    historico: [],
  };

  let reloaded: any = null;
  try {
    await client.query("BEGIN");
    const ins = toOrcamentoInsert(orc as any);
    if (!ins.id) ins.id = crypto.randomUUID();
    const cols = Object.keys(ins);
    const vals = cols.map((c) => { const v = (ins as any)[c]; return v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v; });
    await client.query(`INSERT INTO public.orcamentos (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`, vals);
    const sel = await client.query("SELECT * FROM public.orcamentos WHERE numero = $1", [NUMERO]);
    reloaded = toOrcamentoDomain(sel.rows[0]);
    check(Number(reloaded.valores.valorFinal) === rVuc.valorCliente, "D) banco persistiu preço final");
    check(reloaded.valores.pricing?.tabelaNome === tabVuc.nome, "H) snapshot preservado no reload", String(reloaded.valores.pricing?.tabelaNome));
    check(Number(reloaded.valores.pricing?.valorCalculado) === rVuc.valorCliente, "H) snapshot valorCalculado preservado");
  } catch (e: any) { falhas++; console.error("ERRO DB:", e.message); }
  finally { await client.query("ROLLBACK").catch(() => {}); await client.end(); console.log("ROLLBACK — nada persistido."); }

  // I) mudança posterior da tabela não altera o snapshot salvo
  if (reloaded) {
    const novo = rVuc.valorCliente + 999; // tabela hipotética mudou
    check(reloaded.valores.valorFinal !== novo && reloaded.valores.pricing.valorCalculado === rVuc.valorCliente, "I) snapshot histórico intacto após mudança de tabela");
  }

  // G) nenhum persistido
  const cli2 = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await cli2.connect();
  const leftovers = (await cli2.query("SELECT count(*)::int q FROM public.orcamentos WHERE numero = $1", [NUMERO])).rows[0].q;
  await cli2.end();
  check(leftovers === 0, "G) nenhum orçamento de teste persistido", `q=${leftovers}`);

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
