// A31-J0 — presets de colunas da Central Financeira (Essencial resumido x Financeira Completa analítica)
// Módulo puro de apresentação: não altera cálculos, valores, fontes de dados ou queries financeiras.

export type ModoVisaoCentral = "essencial" | "completa";

export const PRESET_ESSENCIAL: Record<string, boolean> = {
  status: true, data: true, os: true, cliente: true, romaneio: true,
  prestador: true, veiculo: true,
  valorCliente: false, adicCliente: false, totalCliente: true,
  valorPrestador: false, totalPrestador: true,
  kmExcedente: false, pedagioCliente: false, combustivelPrestador: false, reembolsoPrestador: false,
  pod: true, receber: true, faturamento: true, pagamento: true, acoes: true,
};

export const PRESET_COMPLETA: Record<string, boolean> = {
  status: true, data: true, os: true, cliente: true, romaneio: true,
  prestador: true, veiculo: true,
  valorCliente: true, adicCliente: true, totalCliente: true,
  valorPrestador: true, totalPrestador: true,
  kmExcedente: true, pedagioCliente: true, combustivelPrestador: true, reembolsoPrestador: true,
  pod: true, receber: true, faturamento: true, pagamento: true, acoes: true,
};

export const CHAVE_COLUNAS_LOCAL = "central_financeira_colunas_v2";

// A31-J1 / A31-J1.4 — prévia financeira do lançamento manual.
// Usa as MESMAS fontes/regras da Escala (tabela comercial do cliente e cadastro
// financeiro do prestador via buscarTabelasService). Nenhuma regra financeira
// exclusiva do Financeiro é criada. Descontos CLIENTE e PRESTADOR separados.
export interface TabelaKmContexto {
  franquiaCliente?: number;
  valorKmExcCliente?: number;
  franquiaPrestador?: number;
  valorKmPrestador?: number;
}

export interface LancamentoManualValores {
  valor_frete?: string;
  valor_repasse?: string;
  valor_pedagio?: string;
  valor_combustivel?: string;
  valor_reembolso_outros?: string;
  valor_ajudante?: string;
  diarias_adicionais?: string;
  valor_diaria?: string;
  valor_adicional?: string;
  valor_desconto?: string;
  valor_desconto_prestador?: string;
  km_realizados?: string;
  pedagio_cobrar_excedente?: boolean;
  tabela_km?: TabelaKmContexto;
}

export interface ResumoLancamentoManual {
  valorClienteBase: number;
  pedagioCliente: number;
  ajudanteCliente: number;
  diariasCliente: number;
  outrosCliente: number;
  descontosCliente: number;
  valorClienteTotal: number;
  valorPrestadorTotal: number;
  margem: number;
  margemPct: number;
  franquiaCliente: number;
  franquiaPrestador: number;
  excedenteCliente: number;
  excedentePrestador: number;
  totalExcedenteCliente: number;
  totalExcedentePrestador: number;
}

// Duas pernas do KM: CLIENTE (tabela comercial) e PRESTADOR (cadastro financeiro).
// excedente = max(0, km_realizado - franquia) — mesma lógica da Escala.
export function calcularKmDuasPernas(
  kmRealizado: number | string,
  ctx: TabelaKmContexto = {},
): {
  franquiaCliente: number;
  franquiaPrestador: number;
  excedenteCliente: number;
  excedentePrestador: number;
  totalExcedenteCliente: number;
  totalExcedentePrestador: number;
} {
  const kmNum = typeof kmRealizado === "number" ? kmRealizado : Number(kmRealizado ?? "");
  const km = Number.isFinite(kmNum) ? kmNum : 0;
  const fc = Number(ctx.franquiaCliente ?? 0);
  const fp = Number(ctx.franquiaPrestador ?? 0);
  const excedenteCliente = fc > 0 ? Math.max(0, km - fc) : 0;
  const excedentePrestador = fp > 0 ? Math.max(0, km - fp) : 0;
  return {
    franquiaCliente: fc,
    franquiaPrestador: fp,
    excedenteCliente,
    excedentePrestador,
    totalExcedenteCliente: excedenteCliente * (Number(ctx.valorKmExcCliente ?? 0)),
    totalExcedentePrestador: excedentePrestador * (Number(ctx.valorKmPrestador ?? 0)),
  };
}

export function calcularResumoLancamento(form: LancamentoManualValores): ResumoLancamentoManual {
  const num = (v?: string) => { const n = Number(v ?? ""); return Number.isFinite(n) ? n : 0; };
  const km = calcularKmDuasPernas(form.km_realizados ?? "", form.tabela_km);
  const valorClienteBase = num(form.valor_frete);
  // Pedágio: campo único valor_pedagio; cobrança ao cliente só quando a flag
  // pedagio_cobrar_excedente estiver ligada (mesma regra da Escala).
  const pedagioCliente = form.pedagio_cobrar_excedente ? num(form.valor_pedagio) : 0;
  const ajudanteCliente = num(form.valor_ajudante);
  const diariasCliente = num(form.diarias_adicionais) * num(form.valor_diaria);
  const outrosCliente = num(form.valor_adicional);
  const descontosCliente = num(form.valor_desconto);
  const valorClienteTotal =
    valorClienteBase + km.totalExcedenteCliente + pedagioCliente + ajudanteCliente + diariasCliente + outrosCliente - descontosCliente;
  // A31-J1.9 — pernas separadas sem duplicidade:
  //   "outros cobrados" (cliente) = valor_adicional;
  //   "outros reembolsos" (prestador) = valor_reembolso_outros.
  // valor_adicional NÃO alimenta a perna prestador (evita 66,43 + 66,43 quando
  // pedágio/outros eram lançados também em "Outros adicionais").
  const adicionaisPrestador =
    num(form.valor_pedagio) + num(form.valor_combustivel) + ajudanteCliente + diariasCliente +
    num(form.valor_reembolso_outros);
  const valorPrestadorTotal =
    num(form.valor_repasse) + km.totalExcedentePrestador + adicionaisPrestador - num(form.valor_desconto_prestador);
  const margem = valorClienteTotal - valorPrestadorTotal;
  const margemPct = valorClienteTotal !== 0 ? (margem / valorClienteTotal) * 100 : 0;
  return {
    valorClienteBase, pedagioCliente, ajudanteCliente, diariasCliente, outrosCliente, descontosCliente,
    valorClienteTotal, valorPrestadorTotal, margem, margemPct,
    ...km,
  };
}

// Lê as colunas de um modo a partir do JSON salvo no navegador.
// Formato atual: { essencial: {...}, completa: {...} }.
// Formato legado v1 (mapa plano de colunas) é aceito apenas como base da visão completa.
export function lerColunasDoModo(
  modo: ModoVisaoCentral,
  raw?: string | null,
): Record<string, boolean> {
  const preset = modo === "essencial" ? PRESET_ESSENCIAL : PRESET_COMPLETA;
  if (!raw) return { ...preset };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed[modo] && typeof parsed[modo] === "object") {
        return { ...preset, ...parsed[modo] };
      }
      if (modo === "completa" && "status" in parsed && !("essencial" in parsed)) {
        return { ...preset, ...parsed };
      }
    }
  } catch {
    // preferência inválida → aplica o preset
  }
  return { ...preset };
}
