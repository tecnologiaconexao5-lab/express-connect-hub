/* TMS-COM-CARGA-04 — Prova: fator parametrizado → cálculo → recomendação →
   save orçamento → reload → snapshot preservado. DB em transação + ROLLBACK.
   Verifica também que configuracoes_sistema NÃO possui regra inventada. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import {
  calcularDerivadosCarga,
  resolverFatorCubagemRegras,
  recomendarVeiculo,
  FATOR_CONTEXTO_PADRAO,
  type RegraFatorCubagem,
} from "../src/components/comercial/cargaCalculo";
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

const NUMERO = "ORC-202609-9704";
const dims = [
  { quantidade: 5, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 },
  { quantidade: 3, comprimentoCm: 60, larguraCm: 40, alturaCm: 40 },
  { quantidade: 2, comprimentoCm: 200, larguraCm: 50, alturaCm: 50 },
]; // 4,168 m³
const regras: RegraFatorCubagem[] = [{ contexto: FATOR_CONTEXTO_PADRAO, fatorKgM3: 250, ativo: true }]; // fixture 250
const cargaBase = { tipo: "geral", descricao: "Fator cubagem 250 (fixture)", volumes: 10, peso: 500, cubagem: 0, pallets: 0, valorDeclarado: 0, refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "", dimensoes: dims };

(async () => {
  const env = loadEnv();
  let falhas = 0;
  const check = (c: boolean, l: string, x?: string) => { console.log(`${c ? "PASS" : "FAIL"} — ${l}${x ? " :: " + x : ""}`); if (!c) falhas++; };

  // Config oficial: ausência de regra inventada
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const cfg = (await client.query("SELECT count(*)::int q FROM public.configuracoes_sistema WHERE chave = 'fator_cubagem_regras'")).rows[0].q;
  check(cfg === 0, "produção NÃO possui fator inventado (fator_cubagem_regras ausente)", `q=${cfg}`);

  // Cálculo (regras fixture)
  const d = calcularDerivadosCarga(cargaBase as any, undefined, undefined, regras, "esporadico");
  check(d.cubagem === 4.168, "cubagem = 4,168 m³");
  check(resolverFatorCubagemRegras(regras, "esporadico") === 250, "fator resolvido pela regra (250)");
  check(d.pesoCubado === 1042, "peso cubado = 1.042 kg", String(d.pesoCubado));
  check(d.pesoConsiderado === 1042, "peso considerado = 1.042 kg (cubado > real 500)", String(d.pesoConsiderado));

  // Recomendação usa pesoConsiderado
  const rec = recomendarVeiculo({ pesoConsideradoKg: d.pesoConsiderado, cubagemM3: d.cubagem, dimensoes: dims });
  console.log("Recomendado:", rec.tipo, "|", rec.motivos.join(" · "));
  check(rec.disponivel && rec.tipo === "van", "recomendado = Van (1.300 kg / 8 m³ ≥ 1.042 kg / 4,168 m³)", String(rec.tipo));

  // Save orçamento + reload (transação + rollback)
  const cargaPersist = { ...cargaBase, cubagem: d.cubagem, volumes: d.volumesGrupos, pesoCubado: d.pesoCubado, fatorCubagem: d.fator, pesoConsiderado: d.pesoConsiderado, pesoCubadoDisponivel: d.fatorDisponivel, fatorCubagemContexto: d.fatorContexto || undefined };
  const orc = {
    id: "", numero: NUMERO, cliente: "CLIENTE CONTROLADO CARGA-04", clienteCnpj: "11.222.333/0001-81",
    unidade: "Matriz", centroCusto: "COMERCIAL", responsavel: "Validação CARGA-04",
    dataEmissao: "2026-09-26", validade: "2026-10-26", tipoOperacao: "Fracionado", modalidade: "esporadico", prioridade: "normal",
    pedidoInterno: "", observacoesGerais: "Prova fator cubagem.", status: "rascunho",
    enderecos: [
      { tipo: "coleta", sequencia: 1, endereco: "Av. das Nações Unidas, 1000", cidade: "São Paulo", uf: "SP", cep: "04578-000", contato: "João", telefone: "", instrucoes: "", janelaInicio: "08:00", janelaFim: "12:00" },
      { tipo: "entrega", sequencia: 2, endereco: "Rod. Anhanguera, km 25", cidade: "Jundiaí", uf: "SP", cep: "13200-000", contato: "Maria", telefone: "", instrucoes: "", janelaInicio: "14:00", janelaFim: "18:00" },
    ],
    carga: cargaPersist, veiculo: { tipo: "van", subcategoria: "leve", carroceria: "baú", recomendado: rec.tipo || undefined, recomendacaoDisponivel: true, recomendacaoMotivos: rec.motivos },
    valores: { tabelaVinculada: "", valorBase: 2200, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, devolucao: 0, reentrega: 0, descontos: 0, valorFinal: 2200, custoEstimado: 0, margemEstimada: 0, lucroEstimado: 0 },
    distancia_rota: { distancia_km: 350, duracao_min: 360, distancia_texto: "350 km", duracao_texto: "6h 00min", maps_provider: "mapbox" },
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
    check(Number(reloaded.carga.cubagem) === 4.168, "banco persistiu cubagem 4,168");
    check(Number(reloaded.carga.fatorCubagem) === 250, "banco persistiu fator aplicado 250");
    check(Number(reloaded.carga.pesoCubado) === 1042 && Number(reloaded.carga.pesoConsiderado) === 1042, "banco persistiu peso cubado/considerado");
  } catch (e: any) { falhas++; console.error("ERRO DB:", e.message); }
  finally { await client.query("ROLLBACK").catch(() => {}); await client.end(); console.log("ROLLBACK — nada persistido."); }

  if (reloaded) {
    check(reloaded.carga.fatorCubagemContexto === "snapshot" || reloaded.carga.fatorCubagemContexto === "esporadico", "snapshot com contexto registrado", String(reloaded.carga.fatorCubagemContexto));
    // J) config muda depois, snapshot NÃO muda
    const novasRegras: RegraFatorCubagem[] = [{ contexto: FATOR_CONTEXTO_PADRAO, fatorKgM3: 400, ativo: true }];
    const dSnap = calcularDerivadosCarga(reloaded.carga, Number(reloaded.carga.fatorCubagem), undefined, novasRegras, "esporadico");
    check(dSnap.fator === 250, "snapshot histórico preservado mesmo com config posterior 400", String(dSnap.fator));
  }

  // H) nenhum persistido
  const cli2 = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await cli2.connect();
  const leftovers = (await cli2.query("SELECT count(*)::int q FROM public.orcamentos WHERE numero = $1", [NUMERO])).rows[0].q;
  await cli2.end();
  check(leftovers === 0, "nenhum orçamento de teste persistido", `q=${leftovers}`);

  console.log("\nRESULTADO:", falhas === 0 ? "TODOS OS CHECKS PASSARAM" : `${falhas} CHECK(S) FALHARAM`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
