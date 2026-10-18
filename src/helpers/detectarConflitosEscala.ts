import { isStatusCancelado } from "@/components/operacao/escalaStatus";

export interface AlocacaoConflito {
  id: string;
  prestadorId: string;
  prestadorNome?: string;
  os?: string;
  data: string | Date;
  horarioInicio?: string;
  horarioFim?: string;
  status?: string;
}

export interface PrestadorConflito {
  id: string;
  status: string;
}

export interface DadosConflitoEscala {
  prestadorId: string;
  os: string;
  dataEscala: string;
  horarioInicio?: string;
  horarioFim?: string;
  alocacoesExistentes: AlocacaoConflito[];
  prestadorStatus?: string;
  alocacaoIdExcluir?: string;
  placa?: string;
  motoristaId?: string;
  veiculoId?: string;
}

export interface ResultadoConflitoEscala {
  conflitos: string[];
  avisos: string[];
  bloqueante: boolean;
}

function mesmoDia(data1: string | Date, data2: string | Date): boolean {
  const d1 = new Date(data1);
  const d2 = new Date(data2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function statusAtivo(status?: string): boolean {
  if (!status) return true;
  return !isStatusCancelado(status);
}

function horariosSobrepoem(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string
): boolean {
  const conv = (h: string) => {
    const [hStr, mStr] = h.split(":");
    return parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
  };

  const aInicio = conv(inicioA);
  const aFim = conv(fimA);
  const bInicio = conv(inicioB);
  const bFim = conv(fimB);

  return aInicio < bFim && bInicio < aFim;
}

export interface AlocacaoComVeiculoMotorista extends AlocacaoConflito {
  placa?: string;
  motoristaId?: string;
  veiculoId?: string;
}

export function detectarConflitosEscala(
  dados: DadosConflitoEscala,
  alocacoesExistentes: AlocacaoConflito[],
  prestadorStatus?: string
): ResultadoConflitoEscala {
  const conflitos: string[] = [];
  const avisos: string[] = [];
  const { prestadorId, os, dataEscala, horarioInicio, horarioFim, alocacaoIdExcluir, placa, motoristaId, veiculoId } = dados;

  const alocacoesAtivas = alocacoesExistentes.filter((a) =>
    statusAtivo(a.status) && a.id !== alocacaoIdExcluir
  );

  // 1. Prestador já alocado no mesmo dia (BLOQUEANTE)
  const alocMesmoPrestadorDia = alocacoesAtivas.filter(
    (a) =>
      a.prestadorId === prestadorId &&
      mesmoDia(a.data, dataEscala)
  );

  if (alocMesmoPrestadorDia.length > 0) {
    const nomes = alocMesmoPrestadorDia
      .map((a) => a.prestadorNome || a.id)
      .join(", ");
    conflitos.push(`Prestador já alocado no mesmo dia: ${nomes}.`);
  }

  // 2. Mesma OS com mais de um prestador ativo (BLOQUEANTE)
  if (os && os.trim()) {
    const alocMesmaOS = alocacoesAtivas.filter(
      (a) =>
        a.os === os &&
        a.prestadorId !== prestadorId
    );

    if (alocMesmaOS.length > 0) {
      const nomes = alocMesmaOS
        .map((a) => a.prestadorNome || a.prestadorId)
        .join(", ");
      conflitos.push(`OS ${os} já está alocada para: ${nomes}.`);
    }
  }

  // 3. Veículo (placa) já alocado no mesmo dia (BLOQUEANTE)
  if (placa && placa.trim()) {
    const alocMesmaPlaca = alocacoesAtivas.filter(
      (a) =>
        (a as AlocacaoComVeiculoMotorista).placa === placa &&
        mesmoDia(a.data, dataEscala)
    );
    if (alocMesmaPlaca.length > 0) {
      conflitos.push(`Veículo placa ${placa} já está alocado no mesmo dia.`);
    }
  }

  // 4. Motorista já alocado no mesmo dia (BLOQUEANTE)
  if (motoristaId && motoristaId.trim()) {
    const alocMesmoMotorista = alocacoesAtivas.filter(
      (a) =>
        (a as AlocacaoComVeiculoMotorista).motoristaId === motoristaId &&
        mesmoDia(a.data, dataEscala)
    );
    if (alocMesmoMotorista.length > 0) {
      conflitos.push(`Motorista já está alocado no mesmo dia.`);
    }
  }

  // 5. Prestador bloqueado/indisponível (AVISO)
  if (prestadorStatus && prestadorStatus === "indisponivel") {
    avisos.push("Prestador está marcado como indisponível. Verifique antes de alocar.");
  }

  // 6. Sobreposição de horário (AVISO)
  if (horarioInicio && horarioFim) {
    const alocMesmoPrestador = alocacoesExistentes.filter(
      (a) =>
        a.prestadorId === prestadorId &&
        mesmoDia(a.data, dataEscala) &&
        a.horarioInicio &&
        a.horarioFim
    );

    for (const aloc of alocMesmoPrestador) {
      if (
        horariosSobrepoem(horarioInicio, horarioFim, aloc.horarioInicio!, aloc.horarioFim!)
      ) {
        avisos.push(
          `Sobreposição de horário com alocação existente (${aloc.horarioInicio} - ${aloc.horarioFim}).`
        );
        break;
      }
    }
  } else {
    avisos.push("Sem horário definido. Não foi possível verificar sobreposição.");
  }

  return {
    conflitos,
    avisos,
    bloqueante: conflitos.length > 0,
  };
}
