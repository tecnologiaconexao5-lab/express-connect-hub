/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTO-E2E-CENARIO-02 — Regras de Bloqueio Operacional
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * OBJETIVO
 *   Validar as regras de negócio de bloqueio na Programação Operacional.
 *   O TMS não pode permitir a alocação de motoristas "em viagem" (conflito)
 *   nem de motoristas com restrição documental (documento vencido).
 *
 * CAMADA SOB TESTE (TypeScript / service)
 *   - src/services/escala/escalaService.ts .......... criarAlocacao()
 *   - src/services/escala/escalaService.ts .......... verificarConflitoPrestador()
 *   - src/services/escala/eligibilidadeOperacionalService.ts
 *                                                    verificarElegibilidadeOperacionalPrestador()
 *                                                    prestadorDocumentalmenteElegivel()
 *                                                    documentoVencido()
 *
 * PRÉ-CONDIÇÃO CONHECIDA
 *   As datas de validade de CNH/ANTT NÃO existem como colunas nas tabelas
 *   operacionais. Por isso a validação roda na camada de serviço TS e os
 *   retornos do Supabase são MOCADOS/STUBADOS neste teste (nenhum dado real
 *   de Produção é lido ou gravado).
 *
 * ESTRATÉGIA DE MOCK
 *   O serviço é importado DENTRO da página (module graph do Vite dev server)
 *   e o tráfego REST do Supabase (`/rest/v1/**`) é interceptado por
 *   `page.route`. Um "banco" em memória (Node) responde às consultas e
 *   registra tentativas de INSERT — assim é possível PROVAR que uma
 *   alocação bloqueada NÃO foi gravada em `alocacoes_escala`.
 *
 * CENÁRIOS
 *   A (Controle Negativo) — motorista "em viagem" → conflito → ERRO, sem INSERT
 *   B (Controle Negativo) — motorista com documento vencido → ERRO, sem INSERT
 *   C (Controle Positivo) — motorista 100% apto → sucesso → INSERT persistido
 *
 * EXECUÇÃO
 *   npx playwright test -c playwright.com02.config.ts --reporter=list
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ───────────────────────────────────────────────────────────────────────────
// Constantes / fakes
// ───────────────────────────────────────────────────────────────────────────

const BASE = "http://localhost:8800";
const PRESTADOR_ID = "11111111-1111-4111-8111-111111111111";
const DATA_ESCALA = "2026-08-16";
const OS_ID = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;

interface MockDb {
  prestadores: Row[];
  documentos_prestadores: Row[];
  veiculos: Row[];
  ordens_servico: Row[];
  alocacoes_escala: Row[];
  /** Registra cada payload recebido em POST /rest/v1/alocacoes_escala. */
  inseridos: Row[];
}

function novoDb(): MockDb {
  return {
    prestadores: [],
    documentos_prestadores: [],
    veiculos: [],
    ordens_servico: [],
    alocacoes_escala: [],
    inseridos: [],
  };
}

interface ResultadoOperacao {
  sucesso: boolean;
  erro?: string;
  mensagem?: string;
  dados?: unknown;
}

// ───────────────────────────────────────────────────────────────────────────
// Mini-emulador PostgREST usado pelo route handler
// ───────────────────────────────────────────────────────────────────────────

const PARAMS_IGNORADOS = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);

function filtroBate(row: Row, searchParams: URLSearchParams): boolean {
  for (const [col, raw] of searchParams.entries()) {
    if (PARAMS_IGNORADOS.has(col)) continue;
    const valor = String(row[col] ?? "");

    if (raw.startsWith("eq.")) {
      if (valor !== raw.slice(3)) return false;
    } else if (raw.startsWith("neq.")) {
      if (valor === raw.slice(4)) return false;
    } else if (raw.startsWith("in.")) {
      const lista = raw
        .slice(3)
        .replace(/^\(/, "")
        .replace(/\)$/, "")
        .split(",")
        .map((s) => s.trim());
      if (!lista.includes(valor)) return false;
    } else if (raw.startsWith("is.")) {
      const alvo = raw.slice(3);
      if (alvo === "null" && row[col] !== null) return false;
    }
  }
  return true;
}

function selecionarTabela(db: MockDb, tabela: string): Row[] {
  return ((db as unknown as Record<string, Row[]>)[tabela] ?? []) as Row[];
}

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "content-range",
};

async function tratarRequisicaoSupabase(route: Route, db: MockDb): Promise<void> {
  const req = route.request();
  const metodo = req.method();
  const url = new URL(req.url());

  if (metodo === "OPTIONS") {
    await route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
    return;
  }

  const tabela = url.pathname.split("/rest/v1/")[1]?.split("/")[0] ?? "";
  const linhas = selecionarTabela(db, tabela).filter((r) => filtroBate(r, url.searchParams));

  // ── INSERT (POST) — usado pelo cenário C ────────────────────────────────
  if (metodo === "POST") {
    const bodyRaw = req.postDataJSON() as Row | Row[];
    const body = Array.isArray(bodyRaw) ? (bodyRaw[0] as Row) : bodyRaw;
    const criado: Row = { id: `aloc-nova-${Date.now()}`, status: "planejada", ...body };

    if (tabela === "alocacoes_escala") db.inseridos.push(criado);

    await route.fulfill({
      status: 201,
      headers: { ...CORS_HEADERS, "content-type": "application/json", "content-range": "0-0/1" },
      body: JSON.stringify(criado),
    });
    return;
  }

  // ── COUNT (HEAD) — usado por verificarConflitoPrestador/Placa ───────────
  if (metodo === "HEAD") {
    await route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, "content-range": `0-0/${linhas.length}` },
      body: "",
    });
    return;
  }

  // ── SELECT (GET) — sempre devolve array; supabase-js trata maybeSingle ──
  await route.fulfill({
    status: 200,
    headers: { ...CORS_HEADERS, "content-type": "application/json", "content-range": `0-${Math.max(linhas.length - 1, 0)}/${linhas.length}` },
    body: JSON.stringify(linhas),
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Ponte para o service dentro da página (module graph do Vite)
// ───────────────────────────────────────────────────────────────────────────

/** Importa o service na página com retry (cobre o primeiro optimize do Vite). */
async function aquecerService(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    for (let i = 0; i < 8; i++) {
      try {
        await import("/src/services/escala/escalaService.ts");
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    return false;
  });
}

async function chamarCriarAlocacao(page: Page, dados: Row): Promise<ResultadoOperacao> {
  return page.evaluate(async (payload) => {
    const mod = (await import("/src/services/escala/escalaService.ts")) as {
      criarAlocacao: (d: unknown) => Promise<ResultadoOperacao>;
    };
    return mod.criarAlocacao(payload);
  }, dados);
}

async function chamarConflitoPrestador(page: Page, prestadorId: string, dataEscala: string) {
  return page.evaluate(
    async ({ prestadorId: p, dataEscala: d }) => {
      const mod = (await import("/src/services/escala/escalaService.ts")) as {
        verificarConflitoPrestador: (p: string, d: string) => Promise<{ sucesso: boolean; dados?: boolean; erro?: string }>;
      };
      return mod.verificarConflitoPrestador(p, d);
    },
    { prestadorId, dataEscala }
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Testes
// ───────────────────────────────────────────────────────────────────────────

test.describe("AUTO-E2E-CENARIO-02 — Regras de Bloqueio Operacional", () => {
  let db: MockDb;

  test.beforeEach(async ({ page }) => {
    db = novoDb();

    await page.route("**/rest/v1/**", (route) => tratarRequisicaoSupabase(route, db));
    // Rede de segurança: se algo escapar, não deixar request real sair.
    await page.route("**/auth/v1/**", (route) =>
      route.fulfill({ status: 200, headers: CORS_HEADERS, body: JSON.stringify({}) })
    );

    // Origem local (Vite dev server) sem carregar o app — habilita import dinâmico.
    await page.goto(`${BASE}/placeholder.svg`);

    const ok = await aquecerService(page);
    expect(ok, "Falha ao carregar escalaService.ts pelo dev server (Vite)").toBe(true);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CENÁRIO A — Controle Negativo: motorista "em viagem" (conflito de agenda)
  // ═════════════════════════════════════════════════════════════════════════
  test("Cenário A — motorista em viagem (conflito) DEVE ser bloqueado e NÃO gravar alocação", async ({ page }) => {
    // Arrange: já existe alocação ativa (em_rota = "em viagem") do mesmo prestador na data.
    db.alocacoes_escala = [
      { id: "aloc-em-viagem", prestador_id: PRESTADOR_ID, data_escala: DATA_ESCALA, status: "em_rota" },
    ];

    // Sanidade do stub: o conflito é detectado pelo próprio serviço.
    const conflito = await chamarConflitoPrestador(page, PRESTADOR_ID, DATA_ESCALA);
    expect(conflito.sucesso).toBe(true);
    expect(conflito.dados).toBe(true);

    // Act
    const r = await chamarCriarAlocacao(page, {
      data_escala: DATA_ESCALA,
      tipo_veiculo: "moto",
      prestador_id: PRESTADOR_ID,
      ordem_servico_id: OS_ID,
    });

    // Assert
    console.log("[CENARIO A] resultado:", JSON.stringify(r));
    console.log("[CENARIO A] INSERTs em alocacoes_escala:", db.inseridos.length);

    expect(r.sucesso, "Alocação deveria ser RECUSADA por conflito de agenda").toBe(false);
    expect(String(r.erro).toLowerCase()).toContain("conflito");
    expect(db.inseridos.length, "Nenhuma alocação podia ter sido gravada").toBe(0);
    // A alocação preexistente permanece intacta.
    expect(db.alocacoes_escala).toHaveLength(1);
    expect(db.alocacoes_escala[0].status).toBe("em_rota");
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CENÁRIO B — Controle Negativo: motorista com documento vencido
  // ═════════════════════════════════════════════════════════════════════════
  test("Cenário B — motorista com documento (CNH) vencido DEVE ser bloqueado e NÃO gravar alocação", async ({ page }) => {
    // Arrange: sem conflito de agenda, mas documentação com CNH vencida.
    db.alocacoes_escala = [];
    db.prestadores = [{ id: PRESTADOR_ID, status: "ativo", liberado_app: true, cnh_validade: null }];
    db.documentos_prestadores = [
      { prestador_id: PRESTADOR_ID, tipo: "CNH Frente", status: "valido", validade: "2020-01-01" },
      { prestador_id: PRESTADOR_ID, tipo: "Comprovante de Residência", status: "valido", validade: null },
    ];
    db.ordens_servico = [{ id: OS_ID, veiculo_tipo: "moto", carga_ajudante: false }];

    // Act
    const r = await chamarCriarAlocacao(page, {
      data_escala: DATA_ESCALA,
      tipo_veiculo: "moto",
      prestador_id: PRESTADOR_ID,
      ordem_servico_id: OS_ID,
    });

    // Assert
    console.log("[CENARIO B] resultado:", JSON.stringify(r));
    console.log("[CENARIO B] INSERTs em alocacoes_escala:", db.inseridos.length);

    expect(r.sucesso, "Alocação deveria ser RECUSADA por documento vencido").toBe(false);
    expect(String(r.erro).toLowerCase()).toMatch(/cnh|documento|elegí/);
    expect(db.inseridos.length, "Nenhuma alocação podia ter sido gravada").toBe(0);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CENÁRIO C — Controle Positivo: motorista 100% apto
  // ═════════════════════════════════════════════════════════════════════════
  test("Cenário C — motorista apto DEVE passar pelas regras e PERSISTIR em alocacoes_escala", async ({ page }) => {
    // Arrange: prestador ativo/liberado, sem conflito, sem documento bloqueante
    // (nenhum documento = fail-open documental) e OS compatível.
    db.alocacoes_escala = [];
    db.prestadores = [{ id: PRESTADOR_ID, status: "ativo", liberado_app: true, cnh_validade: null }];
    db.documentos_prestadores = [];
    db.ordens_servico = [{ id: OS_ID, veiculo_tipo: "moto", carga_ajudante: false }];

    // Act
    const r = await chamarCriarAlocacao(page, {
      data_escala: DATA_ESCALA,
      tipo_veiculo: "moto",
      prestador_id: PRESTADOR_ID,
      ordem_servico_id: OS_ID,
    });

    // Assert
    console.log("[CENARIO C] resultado:", JSON.stringify(r));
    console.log("[CENARIO C] INSERTs em alocacoes_escala:", db.inseridos.length);

    expect(r.sucesso, "Alocação de motorista apto deveria PASSAR").toBe(true);
    expect(db.inseridos, "A alocação deveria ter sido gravada").toHaveLength(1);
    expect(db.inseridos[0].prestador_id).toBe(PRESTADOR_ID);
    expect(db.inseridos[0].data_escala).toBe(DATA_ESCALA);
    expect(db.inseridos[0].tipo_veiculo).toBe("moto");
    expect(db.inseridos[0].ordem_servico_id).toBe(OS_ID);
  });
});
