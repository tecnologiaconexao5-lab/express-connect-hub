// ============================================================================
// Adapter SOMENTE-LEITURA do client Supabase sobre o PostgreSQL real.
//
// Motivo: o client anon (usado pelo app) não lê `faturas`/`clientes`/
// `enderecos_clientes` por causa do RLS (0 linhas). Para validar a geração
// REAL da FATURA com dados REAIS — sem sessão de produção e sem escrita —
// este adapter traduz a cadeia `.from().select().eq()...` em SELECTs
// parametrizados contra DATABASE_URL.
//
// Regras:
//  • APENAS SELECT (nenhum INSERT/UPDATE/DELETE é sequer construído);
//  • identificadores (tabela/coluna) validados contra /^[a-z_][a-z0-9_]*$/;
//  • valores sempre parametrizados ($1, $2, ...);
//  • conexão compartilhada (pool de 2) e fechada no fim do processo.
// ============================================================================
import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

const IDENT = /^[a-z_][a-z0-9_]*$/;

function lerDatabaseUrl(): string {
  const direto = process.env.DATABASE_URL?.trim();
  if (direto) return direto;
  try {
    const env = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    const m = env.match(/^DATABASE_URL=(.+)$/m);
    if (m && m[1].trim()) return m[1].trim();
  } catch {
    // sem .env legível — cai no erro abaixo
  }
  throw new Error("DATABASE_URL ausente (process.env ou .env)");
}

let poolPromise: Promise<pg.Pool> | null = null;

function obterPool(): Promise<pg.Pool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const connectionString = lerDatabaseUrl();
      const p = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 20000 });
      // teste rápido de conexão
      await p.query("SELECT 1");
      return p;
    })();
    poolPromise.catch(() => {
      poolPromise = null; // permite nova tentativa no próximo uso
    });
  }
  return poolPromise;
}

export async function fecharPool(): Promise<void> {
  if (poolPromise) {
    try {
      const p = await poolPromise;
      await p.end();
    } catch {
      // ignora
    }
    poolPromise = null;
  }
}

type Filtro = { op: string; col: string; val: unknown };

interface Estado {
  tabela: string;
  filtros: Filtro[];
  ordenacoes: { col: string; asc: boolean }[];
  limite: number | null;
}

async function executar(e: Estado): Promise<{ data: Record<string, unknown>[]; error: { message: string } | null }> {
  if (!IDENT.test(e.tabela)) return { data: [], error: { message: `tabela invalida: ${e.tabela}` } };
  const params: unknown[] = [];
  const where: string[] = [];
  for (const f of e.filtros) {
    if (!IDENT.test(f.col)) return { data: [], error: { message: `coluna invalida: ${f.col}` } };
    switch (f.op) {
      case "eq":
        if (f.val === null) {
          where.push(`"${f.col}" IS NULL`);
        } else {
          params.push(f.val);
          where.push(`"${f.col}" = $${params.length}`);
        }
        break;
      case "neq":
        params.push(f.val);
        where.push(`"${f.col}" <> $${params.length}`);
        break;
      case "in": {
        params.push(Array.isArray(f.val) ? f.val : [f.val]);
        where.push(`"${f.col}" = ANY($${params.length})`);
        break;
      }
      case "isnull":
        where.push(f.val ? `"${f.col}" IS NULL` : `"${f.col}" IS NOT NULL`);
        break;
      case "ilike":
        params.push(f.val);
        where.push(`"${f.col}" ILIKE $${params.length}`);
        break;
      default:
        return { data: [], error: { message: `operador nao suportado: ${f.op}` } };
    }
  }
  let sql = `SELECT * FROM "${e.tabela}"${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`;
  if (e.ordenacoes.length) {
    sql += ` ORDER BY ${e.ordenacoes.map((o) => `"${o.col}" ${o.asc ? "ASC" : "DESC"}`).join(", ")}`;
  }
  if (e.limite != null) {
    params.push(e.limite);
    sql += ` LIMIT $${params.length}`;
  }
  try {
    const pool = await obterPool();
    const r = await pool.query(sql, params);
    return { data: r.rows as Record<string, unknown>[], error: null };
  } catch (err) {
    return { data: [], error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

type Resolvedor<T> = (v: T) => unknown;

function criarBuilder(tabela: string) {
  const e: Estado = { tabela, filtros: [], ordenacoes: [], limite: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: any = {
    select: () => api,
    eq: (col: string, val: unknown) => {
      e.filtros.push({ op: "eq", col, val });
      return api;
    },
    neq: (col: string, val: unknown) => {
      e.filtros.push({ op: "neq", col, val });
      return api;
    },
    in: (col: string, val: unknown) => {
      e.filtros.push({ op: "in", col, val });
      return api;
    },
    is: (col: string, val: unknown) => {
      e.filtros.push({ op: "isnull", col, val });
      return api;
    },
    ilike: (col: string, val: unknown) => {
      e.filtros.push({ op: "ilike", col, val });
      return api;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      e.ordenacoes.push({ col, asc: opts?.ascending !== false });
      return api;
    },
    limit: (n: number) => {
      e.limite = n;
      return api;
    },
    maybeSingle: () =>
      executar(e).then((r) => ({ data: r.data[0] ?? null, error: r.error })),
    single: () =>
      executar(e).then((r) =>
        r.data.length
          ? { data: r.data[0], error: null }
          : { data: null, error: { message: "No rows found" } }
      ),
    then: (onFulfilled?: Resolvedor<unknown>, onRejected?: (reason: unknown) => unknown) =>
      executar(e).then(onFulfilled, onRejected),
  };
  return api;
}

/**
 * Devolve um objeto com a mesma superfície do `supabase` usado pelo app,
 * porém lendo o PostgreSQL real (somente SELECT).
 */
export function criarSupabasePgAdapter() {
  return {
    from: (tabela: string) => criarBuilder(tabela),
    rpc: async () => ({ data: null, error: { message: "rpc desabilitado no adapter de leitura" } }),
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    channel: () => ({ on: () => ({ subscribe: () => "" }), unsubscribe: () => Promise.resolve() }),
    removeChannel: () => Promise.resolve(),
  };
}
