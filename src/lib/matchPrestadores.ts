import { supabase } from "@/lib/supabase";

export interface MatchResult {
  prestadorId: string;
  motoristaNome: string;
  motoristaVeiculo: string;
  motoristaRegiao: string;
  motoristaTelefone: string;
  scoreMatch: number;
  motivos: string[];
  status: "sugerido" | "contatado" | "interessado" | "aprovado" | "recusado";
}

export async function matchPrestadoresParaOperacao(operacao: any, prestadores: any[]): Promise<MatchResult[]> {
  const matches: MatchResult[] = [];

  for (const prestador of prestadores) {
    let score = 0;
    const motivos: string[] = [];

    const tipoVeiculoOp = operacao.veiculo?.toLowerCase() || "";
    const regiaoOp = operacao.regiao?.toLowerCase() || "";
    const tipoCargaOp = operacao.secoRefrigerado?.toLowerCase() || "seco";
    const capacidadeOp = operacao.pesoCarga || "";

    // Adaptação dos campos do prestador (pode vir de "BancoMotoristas" ou da tabela original)
    const veiculoPrestador = prestador.tipoVeiculo || prestador.veiculo || "";
    const nomePrestador = prestador.nome || "Não informado";
    const regiaoPrestador = prestador.regiao || prestador.regiaoPrincipal || "";
    const telPrestador = prestador.telefone || "Não informado";
    const scorePrestador = typeof prestador.score === 'number' ? prestador.score : (prestador.scoreInterno * 20 || 0);
    const dispPrestador = prestador.disponibilidade || "";
    const tipoCargaPrestador = prestador.tipoOperacao || (prestador.aceitaRefrigerada ? "refrigerado" : "seco");
    
    // Critério 1: Tipo de Veículo (Peso Máx: 35)
    if (veiculoPrestador && tipoVeiculoOp && veiculoPrestador.toLowerCase().includes(tipoVeiculoOp)) {
      score += 35;
      motivos.push("Veículo compatível");
    } else if (tipoVeiculoOp) {
      // Se a operação exige um veículo específico e não bate, corta.
      continue;
    }

    // Critério 2: Região (Peso Máx: 25)
    if (regiaoPrestador && regiaoOp && regiaoPrestador.toLowerCase().includes(regiaoOp)) {
      score += 25;
      motivos.push("Região compatível");
    } else if (prestador.regioesAtuacao && prestador.regioesAtuacao.some((r: string) => r.toLowerCase().includes(regiaoOp))) {
      score += 15;
      motivos.push("Atua na região");
    }

    // Critério 3: Tipo de Carga (Peso Máx: 10)
    if (tipoCargaOp === "refrigerado") {
      if (tipoCargaPrestador === "refrigerado" || tipoCargaPrestador === "ambos" || prestador.temperaturaMinima) {
        score += 10;
        motivos.push("Aceita refrigerado");
      } else {
        continue; // Corta se precisa de refrigerado e não aceita
      }
    } else {
      score += 10; // Seco aceita quase tudo
    }

    // Critério 4: Score / Qualidade (Peso Máx: 10)
    if (scorePrestador >= 80) {
      score += 10;
      motivos.push("Alta avaliação");
    } else if (scorePrestador >= 50) {
      score += 5;
    }

    // Critério 5: Disponibilidade (Peso Máx: 10)
    if (dispPrestador === "disponivel") {
      score += 10;
      motivos.push("Disponível imediatamente");
    } else if (dispPrestador === "reserva") {
      score += 5;
    } else if (dispPrestador === "indisponivel" || dispPrestador === "inativo" || dispPrestador === "ferias") {
      continue; // Corta se não está disponível
    }

    // Critério 6: Documentos OK (Peso Máx: 10)
    // Assumimos que cpf e cnh preenchidos indicam Docs básicos OK
    if (prestador.cpf && prestador.cnh) {
      score += 10;
      motivos.push("Docs regulares");
    }

    if (score >= 40) { // Limiar mínimo para considerar match
      matches.push({
        prestadorId: prestador.id,
        motoristaNome: nomePrestador,
        motoristaVeiculo: veiculoPrestador,
        motoristaRegiao: regiaoPrestador,
        motoristaTelefone: telPrestador,
        scoreMatch: score,
        motivos,
        status: "sugerido"
      });
    }
  }

  // Ordena por score decrescente
  matches.sort((a, b) => b.scoreMatch - a.scoreMatch);

  // Salvar no Supabase (ou localStorage se falhar/não existir tabela)
  try {
    const payload = matches.map(m => ({
      operacao_id: operacao.id,
      prestador_id: m.prestadorId,
      score_match: m.scoreMatch,
      motivos: m.motivos.join(", "),
      status: m.status
    }));

    const { error } = await supabase.from("match_operacoes_prestadores").insert(payload);
    
    if (error) {
      console.warn("Tabela match_operacoes_prestadores pode não existir. Salvando em localStorage.");
      salvarMatchLocalmente(operacao.id, matches);
    } else {
      salvarMatchLocalmente(operacao.id, matches); // Salva localmente também para a UI imediata
    }
  } catch (err) {
    console.warn("Erro ao salvar matches no Supabase. Salvando localmente.");
    salvarMatchLocalmente(operacao.id, matches);
  }

  return matches;
}

function salvarMatchLocalmente(operacaoId: string, matches: MatchResult[]) {
  const key = `match_operacao_${operacaoId}`;
  localStorage.setItem(key, JSON.stringify(matches));
}
