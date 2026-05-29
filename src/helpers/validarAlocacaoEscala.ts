import { normalizarNumeroFinanceiro } from "@/services/escala/escalaMapper";

export interface DadosValidacaoAlocacao {
  prestadorId?: string;
  prestadorNome?: string;
  clienteId?: string;
  clienteNome?: string;
  dataEscala?: string;
  turno?: string;
  tipo?: string;
  os?: string;
  horarioInicio?: string;
  horarioFim?: string;
  kmInicial?: number;
  kmFinal?: number;
  financeiro?: {
    valorTipo?: string;
    valorFixo?: number;
    valorPercentual?: number;
    combustivel?: number;
    kmRodados?: number;
    valorKm?: number;
    pedagio?: number;
    pedagioFranquia?: number;
    pedagioExcedente?: number;
    pedagioCobrarExcedente?: boolean;
    diariasAdicionais?: number;
    valorDiaria?: number;
    segundaSaida?: boolean;
    valorSegundaSaida?: number;
    terceiraSaida?: boolean;
    valorTerceiraSaida?: number;
    saidasAdicionais?: number;
    valorSaidaAdicional?: number;
    ajudantes?: number;
    valorAjudante?: number;
    desconto?: number;
    reembolsosOutros?: string;
    valorReembolsoOutros?: number;
  };
  prestadorVeiculo?: {
    tipo_veiculo?: string;
    placa?: string;
    refrigerado?: boolean;
  } | null;
}

export interface ResultadoValidacaoAlocacao {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

const TIPOS_VEICULO_VALIDOS = [
  "moto", "passeio", "fiorino", "kangoo", "kombi", "van", "vuc",
  "hr", "3_4", "toco", "truck", "carreta", "bitrem", "outro"
];

export function validarAlocacaoEscala(dados: DadosValidacaoAlocacao): ResultadoValidacaoAlocacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!dados.prestadorId || !dados.prestadorId.trim()) {
    erros.push("Prestador é obrigatório.");
  }

  if (!dados.dataEscala || !dados.dataEscala.trim()) {
    erros.push("Data da alocação é obrigatória.");
  }

  if (dados.financeiro) {
    const camposFinanceiros: { key: string; value: unknown }[] = [
      { key: "Valor Fixo", value: dados.financeiro.valorFixo },
      { key: "Valor Percentual", value: dados.financeiro.valorPercentual },
      { key: "Combustível", value: dados.financeiro.combustivel },
      { key: "Pedágio", value: dados.financeiro.pedagio },
      { key: "Valor Diária", value: dados.financeiro.valorDiaria },
      { key: "Valor Segunda Saída", value: dados.financeiro.valorSegundaSaida },
      { key: "Valor Terceira Saída", value: dados.financeiro.valorTerceiraSaida },
      { key: "Valor Saída Adicional", value: dados.financeiro.valorSaidaAdicional },
      { key: "Valor Ajudante", value: dados.financeiro.valorAjudante },
      { key: "Valor Reembolso", value: dados.financeiro.valorReembolsoOutros },
      { key: "Desconto", value: dados.financeiro.desconto },
    ];

    for (const campo of camposFinanceiros) {
      const valorNormalizado = normalizarNumeroFinanceiro(campo.value, 0);
      if (valorNormalizado < 0) {
        erros.push(`${campo.key} não pode ser negativo.`);
      }
    }
  }

  if (dados.prestadorVeiculo) {
    if (!dados.prestadorVeiculo.tipo_veiculo || !dados.prestadorVeiculo.tipo_veiculo.trim()) {
      avisos.push("Prestador não possui tipo de veículo cadastrado.");
    } else if (!TIPOS_VEICULO_VALIDOS.includes(dados.prestadorVeiculo.tipo_veiculo)) {
      avisos.push(`Tipo de veículo "${dados.prestadorVeiculo.tipo_veiculo}" não reconhecido. Verifique o cadastro do prestador.`);
    }
  } else {
    avisos.push("Dados do veículo do prestador não disponíveis para validação.");
  }

  if (dados.os && dados.os.trim()) {
    avisos.push("Status da OS não pôde ser verificado automaticamente. Confirme se a OS está ativa.");
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}
