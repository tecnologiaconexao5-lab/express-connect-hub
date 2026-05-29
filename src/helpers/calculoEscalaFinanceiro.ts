import { normalizarNumeroFinanceiro } from "@/services/escala/escalaMapper";

export interface DadosCalculoEscala {
  kmInicial: number;
  kmFinal: number;
  tempoSaidaRua: string;
  tabelaValores?: { valor_base?: number; km_franquia?: number; valor_km?: number; tipo_veiculo?: string } | null;
  regraEspecialAtiva: boolean;
  novoClienteId: string;
  financeiro: {
    valorTipo: string;
    valorFixo: number;
    valorPercentual: number;
    combustivel: number;
    pedagio: number;
    diariasAdicionais: number;
    valorDiaria: number;
    segundaSaida: boolean;
    valorSegundaSaida: number;
    terceiraSaida: boolean;
    valorTerceiraSaida: number;
    saidasAdicionais: number;
    valorSaidaAdicional: number;
    ajudantes: number;
    valorAjudante: number;
    valorReembolsoOutros: number;
    desconto: number;
  };
}

export interface ResultadoCalculoEscala {
  valorBase: number;
  totalAdicionais: number;
  totalDescontos: number;
  total: number;
  diariaCalculada: number;
  kmExcedente: number;
  valorKmExcedente: number;
  kmRodados: number;
  percentualAdicional: number;
  obsAdicional: string;
  tabelaNaoConfigurada: boolean;
}

const nf = (v: unknown): number => normalizarNumeroFinanceiro(v, 0);

export function calcularTotalAlocacao(dados: DadosCalculoEscala): ResultadoCalculoEscala {
  const diariaBase = dados.tabelaValores?.valor_base || 400;
  const kmFranquia = dados.tabelaValores?.km_franquia || 200;
  const valorKm = dados.tabelaValores?.valor_km || 2.50;
  const kmRodados = Math.max(nf(dados.kmFinal) - nf(dados.kmInicial), 0);
  const kmExcedente = Math.max(kmRodados - kmFranquia, 0);

  const tabelaNaoConfigurada = !!dados.novoClienteId && !dados.regraEspecialAtiva;
  const valorKmExcedente = tabelaNaoConfigurada ? 0 : (kmExcedente * valorKm);

  const horaSaida = dados.tempoSaidaRua ? parseInt(dados.tempoSaidaRua.split(":")[0]) : 8;
  let diariaCalculada = diariaBase;
  let percentualAdicional = 0;
  let obsAdicional = "";

  if (dados.regraEspecialAtiva && dados.novoClienteId) {
    if (horaSaida <= 11) {
      percentualAdicional = 0;
      obsAdicional = "SAÍDA ATÉ 11:00 = DIÁRIA BASE";
    } else if (horaSaida <= 14) {
      percentualAdicional = 50;
      diariaCalculada = diariaBase * 1.50;
      obsAdicional = `50% = R$ ${diariaCalculada.toFixed(2)}`;
    } else if (horaSaida <= 16) {
      percentualAdicional = 70;
      diariaCalculada = diariaBase * 1.70;
      obsAdicional = `70% = R$ ${diariaCalculada.toFixed(2)}`;
    } else {
      percentualAdicional = 85;
      diariaCalculada = diariaBase * 1.85;
      obsAdicional = `85% = R$ ${diariaCalculada.toFixed(2)}`;
    }
  }

  const valorDiariaFinal = dados.financeiro.valorTipo === 'fixo' && nf(dados.financeiro.valorFixo) > 0
    ? nf(dados.financeiro.valorFixo)
    : (dados.financeiro.valorTipo === 'percentual' && nf(dados.financeiro.valorPercentual) > 0
        ? (nf(dados.financeiro.valorPercentual) / 100) * diariaCalculada
        : diariaCalculada);

  const totalAdicionais =
    nf(dados.financeiro.combustivel) +
    valorKmExcedente +
    nf(dados.financeiro.pedagio) +
    (nf(dados.financeiro.diariasAdicionais) * (nf(dados.financeiro.valorDiaria) || valorDiariaFinal)) +
    (dados.financeiro.segundaSaida ? nf(dados.financeiro.valorSegundaSaida) : 0) +
    (dados.financeiro.terceiraSaida ? nf(dados.financeiro.valorTerceiraSaida) : 0) +
    (nf(dados.financeiro.saidasAdicionais) * nf(dados.financeiro.valorSaidaAdicional)) +
    (nf(dados.financeiro.ajudantes) * nf(dados.financeiro.valorAjudante)) +
    nf(dados.financeiro.valorReembolsoOutros);

  const totalDescontos = nf(dados.financeiro.desconto);

  return {
    valorBase: valorDiariaFinal,
    totalAdicionais,
    totalDescontos,
    total: valorDiariaFinal + totalAdicionais - totalDescontos,
    diariaCalculada,
    kmExcedente,
    valorKmExcedente,
    kmRodados,
    percentualAdicional,
    obsAdicional,
    tabelaNaoConfigurada,
  };
}
