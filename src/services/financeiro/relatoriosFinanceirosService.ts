// F0-J — Relatórios Financeiros: resumo executivo (funções puras e testáveis).
// Fontes oficiais (sem dupla contagem):
//   faturado    → financeiro_receber (previsto do período)
//   recebido    → financeiro_baixas (financeiro_receber, estornada=false) = REALIZADO
//   aReceber    = faturado − recebido
//   previstoPagar → financeiro_pagar (sem repasses de prestador)
//   pagoRealizado → financeiro_baixas (financeiro_pagar, estornada=false)
//   aPagar      = previstoPagar − pagoRealizado
//   custoPrestador → pagamentos_prestadores.valor_liquido (impacto_dre)
// KPIs e tabela usam o MESMO dataset filtrado.

export interface RecReceber {
  id?: string;
  cliente?: string | null;
  valor: number;
  data_vencimento?: string | null;
  status?: string | null;
}

export interface RecPagar {
  id?: string;
  fornecedor?: string | null;
  valor: number;
  data_vencimento?: string | null;
  status?: string | null;
}

export interface RecPagamentoPrestador {
  prestador?: string | null;
  valor_liquido: number;
  impacto_dre?: boolean;
}

export interface RecBaixa {
  titulo_tabela: "financeiro_receber" | "financeiro_pagar";
  titulo_id?: string | null;
  valor_baixado: number;
  estornada: boolean;
}

export interface ResumoFinanceiro {
  faturado: number;
  recebido: number;
  aReceber: number;
  previstoPagar: number;
  pagoRealizado: number;
  aPagar: number;
  custoPrestador: number;
  fluxoLiquido: number;
  margemIndicativa: number;
}

export interface ClienteResumo {
  cliente: string;
  faturado: number;
  recebido: number;
  aReceber: number;
  vencidos: number;
}

export interface PrestadorResumo {
  prestador: string;
  valorLiquido: number;
  quantidade: number;
}

export interface InadimplenciaItem {
  id?: string;
  cliente: string;
  valor: number;
  data_vencimento: string;
  diasAtraso: number;
}

export function filtrarPorPeriodo<T>(itens: T[], chaveData: (i: T) => string | null | undefined, inicio?: string, fim?: string): T[] {
  return itens.filter((i) => {
    const d = chaveData(i);
    if (!d) return false;
    if (inicio && d < inicio) return false;
    if (fim && d > fim) return false;
    return true;
  });
}

export function calcularResumoFinanceiro(opts: {
  receber: RecReceber[];
  pagar: RecPagar[];
  pagamentos: RecPagamentoPrestador[];
  baixasReceber: RecBaixa[];
  baixasPagar: RecBaixa[];
}): ResumoFinanceiro {
  const faturado = opts.receber.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const recebido = opts.baixasReceber
    .filter((b) => !b.estornada)
    .reduce((s, b) => s + (Number(b.valor_baixado) || 0), 0);
  const previstoPagar = opts.pagar.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const pagoRealizado = opts.baixasPagar
    .filter((b) => !b.estornada)
    .reduce((s, b) => s + (Number(b.valor_baixado) || 0), 0);
  const custoPrestador = opts.pagamentos
    .filter((p) => !!p.impacto_dre)
    .reduce((s, p) => s + (Number(p.valor_liquido) || 0), 0);

  return {
    faturado,
    recebido,
    aReceber: Math.max(0, faturado - recebido),
    previstoPagar,
    pagoRealizado,
    aPagar: Math.max(0, previstoPagar - pagoRealizado),
    custoPrestador,
    fluxoLiquido: recebido - pagoRealizado,
    // margem indicativa = receita faturada − custo prestador − outras despesas previstas
    margemIndicativa: faturado - custoPrestador - (previstoPagar - custoPrestador),
  };
}

export function resumirPorCliente(
  receber: RecReceber[],
  baixasReceber: RecBaixa[],
  hoje?: string
): ClienteResumo[] {
  const map = new Map<string, ClienteResumo>();
  const baixasAtivas = baixasReceber.filter((b) => !b.estornada);
  const recebidoPorTitulo = new Map<string, number>();
  for (const b of baixasAtivas) {
    if (!b.titulo_id) continue;
    recebidoPorTitulo.set(b.titulo_id, (recebidoPorTitulo.get(b.titulo_id) || 0) + (Number(b.valor_baixado) || 0));
  }
  for (const r of receber) {
    const cliente = r.cliente || "NÃO INFORMADO";
    const linha = map.get(cliente) || { cliente, faturado: 0, recebido: 0, aReceber: 0, vencidos: 0 };
    const valor = Number(r.valor) || 0;
    const recebido = r.id ? (recebidoPorTitulo.get(r.id) || 0) : 0;
    linha.faturado += valor;
    linha.recebido += recebido;
    linha.aReceber += Math.max(0, valor - recebido);
    const status = (r.status || "").toLowerCase();
    const venc = r.data_vencimento || "";
    if (status !== "pago" && status !== "cancelado" && hoje && venc && venc < hoje && valor - recebido > 0) {
      linha.vencidos += valor - recebido;
    }
    map.set(cliente, linha);
  }
  return Array.from(map.values()).sort((a, b) => b.faturado - a.faturado);
}

export function resumirPorPrestador(pagamentos: RecPagamentoPrestador[]): PrestadorResumo[] {
  const map = new Map<string, PrestadorResumo>();
  for (const p of pagamentos) {
    if (!p.impacto_dre) continue;
    const prestador = p.prestador || "NÃO INFORMADO";
    const linha = map.get(prestador) || { prestador, valorLiquido: 0, quantidade: 0 };
    linha.valorLiquido += Number(p.valor_liquido) || 0;
    linha.quantidade += 1;
    map.set(prestador, linha);
  }
  return Array.from(map.values()).sort((a, b) => b.valorLiquido - a.valorLiquido);
}

export function calcularInadimplencia(
  receber: RecReceber[],
  baixasReceber: RecBaixa[],
  hoje: string
): InadimplenciaItem[] {
  const baixados = new Set(baixasReceber.filter((b) => !b.estornada).map((b) => b.titulo_id).filter(Boolean) as string[]);
  return receber
    .filter((r) => {
      const status = (r.status || "").toLowerCase();
      const venc = r.data_vencimento || "";
      return status !== "pago" && status !== "cancelado" && venc && venc < hoje && !(r.id && baixados.has(r.id));
    })
    .map((r) => {
      const venc = r.data_vencimento!;
      const dias = Math.max(0, Math.round((new Date(hoje).getTime() - new Date(venc).getTime()) / 86400000));
      return { id: r.id, cliente: r.cliente || "NÃO INFORMADO", valor: Number(r.valor) || 0, data_vencimento: venc, diasAtraso: dias };
    })
    .sort((a, b) => b.diasAtraso - a.diasAtraso);
}
