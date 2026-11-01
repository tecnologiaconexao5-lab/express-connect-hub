// ============================================================
// TALENT INTELLIGENCE — Fase 3/4
// Ficha 360º + funil oficial de 17 etapas sem quebrar o Dashboard
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PIPELINE_COLUMNS,
  PIPELINE_STAGES,
  STAGE_TRANSITIONS,
  normalizePipelineStage,
} from "@/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes";
import { montarResumoTalent } from "@/lib/talentResumo";
import { gerarResumoOperacionalAutomatico } from "@/lib/conexaoTalentAIProfile";
import { calcularCategoriaPerformance } from "@/lib/performancePrestador";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const detalhe = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");
const dashboard = readSrc("src/modules/recrutamento/hooks/useDashboardRecrutamento.ts");
const kanbanService = readSrc(
  "src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts",
);

const ETAPAS_OFICIAIS = [
  "novo_candidato",
  "cadastro_iniciado",
  "cadastro_concluido",
  "em_triagem",
  "em_analise_perfil",
  "aguardando_documentacao",
  "em_verificacao_documental",
  "em_avaliacao_situacional",
  "em_entrevista",
  "em_homologacao",
  "aprovado",
  "reprovado",
  "cadastro_incompleto",
  "banco_de_talentos",
  "homologado_disponivel",
  "homologado_indisponivel",
  "processo_encerrado",
];

describe("A) Ficha 360º do prestador", () => {
  it("A.1 mantém as abas atuais e adiciona as 3 abas de talento", () => {
    for (const aba of ["dados", "documentacao", "veiculos", "financeiro", "qualidade", "torre", "ocorrencias", "permissoes"]) {
      expect(detalhe).toContain(`value="${aba}"`);
    }
    expect(detalhe).toContain('value="talent"');
    expect(detalhe).toContain('value="disponibilidade"');
    expect(detalhe).toContain('value="avaliacao_situacional"');
    expect(detalhe).toContain("Perfil e Preferências");
    expect(detalhe).toContain("Disponibilidade");
    expect(detalhe).toContain("Avaliação Situacional");
  });

  it("A.2 lê/edita as tabelas do Talent Intelligence", () => {
    expect(detalhe).toContain('from("prestador_perfil_talento")');
    expect(detalhe).toContain('from("prestador_disponibilidade")');
    expect(detalhe).toContain('from("recrutamento_avaliacoes")');
    expect(detalhe).toContain("modalidade_preferencial");
    expect(detalhe).toContain("distancia_max_coleta_km");
    expect(detalhe).toContain("aceita_viagens");
    expect(detalhe).toContain("restricoes_operacionais");
    expect(detalhe).toContain("hora_inicio");
    expect(detalhe).toContain("hora_fim");
  });

  it("A.3 exibe o Resumo Operacional Automático (Conexão Talent AI — Etapa 7)", () => {
    expect(detalhe).toContain("ConexaoTalentAIProfile");
    expect(detalhe).toContain("isCandidatoTalento");
    expect(detalhe).toContain("performance={{");
  });
});

describe("B) Funil oficial de 17 etapas", () => {
  it("B.1 o type e as colunas do Kanban têm exatamente as 17 etapas", () => {
    expect([...PIPELINE_STAGES]).toEqual(ETAPAS_OFICIAIS);
    expect(PIPELINE_COLUMNS).toHaveLength(17);
    expect(PIPELINE_COLUMNS.map((c) => c.id)).toEqual(ETAPAS_OFICIAIS);
  });

  it("B.2 cada etapa tem transições declaradas", () => {
    for (const etapa of ETAPAS_OFICIAIS) {
      expect(STAGE_TRANSITIONS[etapa as keyof typeof STAGE_TRANSITIONS]).toBeDefined();
    }
  });

  it("B.3 normaliza etapas legadas para as 17 canônicas", () => {
    expect(normalizePipelineStage("novo_cadastro")).toBe("novo_candidato");
    expect(normalizePipelineStage("em_analise")).toBe("em_analise_perfil");
    expect(normalizePipelineStage("documentacao_pendente")).toBe("aguardando_documentacao");
    expect(normalizePipelineStage("hml_desconhecido")).toBe("novo_candidato");
    expect(normalizePipelineStage("homologado_disponivel")).toBe("homologado_disponivel");
  });

  it("B.4 service do Kanban usa a normalização e os novos labels", () => {
    expect(kanbanService).toContain("normalizePipelineStage");
    expect(kanbanService).toContain("em_analise_perfil");
    expect(kanbanService).toContain("homologado_disponivel");
    expect(kanbanService).toContain("processo_encerrado");
  });
});

describe("C) Dashboard continua agrupando os indicadores originais", () => {
  it("C.1 inclui as novas etapas nos grupos Ativos/Aprovados/Pendentes/Bloqueados", () => {
    expect(dashboard).toContain("homologado_disponivel");
    expect(dashboard).toContain("homologado_indisponivel");
    expect(dashboard).toContain("em_analise_perfil");
    expect(dashboard).toContain("em_avaliacao_situacional");
    expect(dashboard).toContain("banco_de_talentos");
    expect(dashboard).toContain("processo_encerrado");
  });

  it("C.2 preserva as etapas legadas para registros antigos", () => {
    expect(dashboard).toContain("novo_cadastro");
    expect(dashboard).toContain("pre_triagem");
    expect(dashboard).toContain("operacao_ativa");
    expect(dashboard).toContain("prestador_apto");
    expect(dashboard).toContain("bloqueado");
  });
});

describe("D) Helper do Resumo Operacional", () => {
  it("D.1 concatena veículo, região, modalidades e janela de horário", () => {
    const resumo = montarResumoTalent({
      veiculo: "Fiorino",
      regiao: "ABC Paulista",
      modalidades: ["contrato", "esporadico"],
      disponibilidade: [1, 2, 3, 4, 5, 6].map((dia) => ({
        dia_semana: dia,
        hora_inicio: "06:00",
        hora_fim: "18:00",
        disponivel: true,
      })),
    });
    expect(resumo).toBe("Fiorino • ABC Paulista • Contrato/Esporádico • Seg-Sáb 06h-18h");
  });

  it("D.2 retorna fallback quando não há dados", () => {
    expect(montarResumoTalent({})).toBe("Perfil operacional em construção");
  });
});

describe("E) ConexaoTalentAIProfile — Resumo Operacional Automático (Etapa 7)", () => {
  const fonteProfile = readSrc("src/lib/conexaoTalentAIProfile.ts");
  const fonteComponente = readSrc("src/components/prestadores/ConexaoTalentAIProfile.tsx");

  it("E.1 a lib existe e exporta gerarResumoOperacionalAutomatico", () => {
    expect(fonteProfile).toContain("export function gerarResumoOperacionalAutomatico");
    expect(fonteProfile).toContain("ResumoOperacionalAutomatico");
  });

  it("E.2 gera insights de veículo, região, modalidades e disponibilidade", () => {
    const resultado = gerarResumoOperacionalAutomatico({
      perfil: {
        veiculo: "Fiorino",
        regiao: "São Paulo - SP",
        modalidades: ["contrato", "esporadico"],
        aceitaViagens: true,
        statusDisponibilidade: "disponivel",
      },
      disponibilidade: [
        { dia_semana: 1, hora_inicio: "08:00", hora_fim: "18:00", disponivel: true },
        { dia_semana: 2, hora_inicio: "08:00", hora_fim: "18:00", disponivel: true },
      ],
    });
    expect(resultado.insights.some((i) => i.label === "Veículo" && i.valor === "Fiorino")).toBe(true);
    expect(resultado.insights.some((i) => i.label === "Região" && i.valor.includes("São Paulo"))).toBe(true);
    expect(resultado.insights.some((i) => i.label === "Modalidades")).toBe(true);
    expect(resultado.insights.some((i) => i.label === "Disponibilidade" && i.valor.includes("Seg"))).toBe(true);
    expect(resultado.insights.some((i) => i.label === "Viagens" && i.valor.includes("Aceita"))).toBe(true);
    expect(resultado.resumoLinha).toContain("Fiorino");
  });

  it("E.3 classifica competências situacionais (forte/adequado/desenvolver/nao_avaliado)", () => {
    const resultado = gerarResumoOperacionalAutomatico({
      perfil: {},
      avaliacoes: [
        { competencia: "Comunicação", pontuacao: 9 },
        { competencia: "Pontualidade", pontuacao: 6 },
        { competencia: "Resolução de problemas", pontuacao: 3 },
        { competencia: "Trabalho em equipe", pontuacao: null },
      ],
    });
    expect(resultado.competencias).toHaveLength(4);
    expect(resultado.competencias.find((c) => c.nome === "Comunicação")?.nivel).toBe("forte");
    expect(resultado.competencias.find((c) => c.nome === "Pontualidade")?.nivel).toBe("adequado");
    expect(resultado.competencias.find((c) => c.nome === "Resolução de problemas")?.nivel).toBe("desenvolver");
    expect(resultado.competencias.find((c) => c.nome === "Trabalho em equipe")?.nivel).toBe("nao_avaliado");
  });

  it("E.4 extrai restrições operacionais do JSON e gera alerta", () => {
    const resultado = gerarResumoOperacionalAutomatico({
      perfil: {
        restricoesOperacionais: JSON.stringify({
          nao_aceita_carga_perigosa: true,
          horario_noturno: false,
          observacao: "Não trabalha aos domingos",
        }),
      },
    });
    expect(resultado.restricoes).toContain("Nao Aceita Carga Perigosa");
    expect(resultado.restricoes).toContain("Observacao: Não trabalha aos domingos");
    expect(resultado.restricoes).not.toContain("Horario Noturno");
    expect(resultado.alertas.some((a) => a.includes("restrição"))).toBe(true);
  });

  it("E.5 performance Em desenvolvimento quando sem amostra (Regra 12)", () => {
    const resultado = gerarResumoOperacionalAutomatico({
      perfil: {},
      performance: { totalEntregas: 0, pontualidade: null, isCandidato: true },
    });
    expect(resultado.performance).toBe("Em desenvolvimento");
    expect(resultado.performanceScore).toBeNull();
    expect(resultado.alertas.some((a) => a.includes("Regra 12"))).toBe(true);
    expect(resultado.recomendacao).toContain("avaliação inicial");
  });

  it("E.6 recomendação por categoria de performance", () => {
    const diamante = gerarResumoOperacionalAutomatico({
      perfil: {},
      performance: { totalEntregas: 60, pontualidade: 98, ocorrencias: 0 },
    });
    expect(diamante.performance).toBe("Diamante");
    expect(diamante.recomendacao).toContain("Alta performance");

    const prata = gerarResumoOperacionalAutomatico({
      perfil: {},
      performance: { totalEntregas: 20, pontualidade: 70, ocorrencias: 1 },
    });
    expect(prata.performance).toBe("Prata");
    expect(prata.recomendacao).toContain("consistente");
  });

  it("E.7 o componente usa a lib e o design system roxo/laranja", () => {
    expect(fonteComponente).toContain("gerarResumoOperacionalAutomatico");
    expect(fonteComponente).toContain("#2E1065");
    expect(fonteComponente).toContain("orange");
    expect(fonteComponente).toContain("PERFORMANCE_CORES");
    expect(fonteComponente).toContain("Recomendação da IA");
  });
});

describe("F) Regra 12 reforçada — candidato sem operações = Em desenvolvimento", () => {
  it("F.1 performancePrestador mantém a regra original", () => {
    const fonte = readSrc("src/lib/performancePrestador.ts");
    expect(fonte).toContain("Em desenvolvimento");
    expect(fonte).toContain("isCandidato");
    expect(fonte).toContain("semAmostra");
  });

  it("F.2 todos os call sites passam dados reais ou isCandidato", () => {
    const prestadorCard = readSrc("src/modules/recrutamento/components/prestadores/PrestadorCard.tsx");
    expect(prestadorCard).toContain("calcularCategoriaPerformance");
    expect(prestadorCard).toContain("isCandidato:");

    const paginaPrestadores = readSrc("src/modules/recrutamento/pages/PaginaPrestadores.tsx");
    expect(paginaPrestadores).toContain("calcularCategoriaPerformance");
    expect(paginaPrestadores).toContain("isCandidato:");

    const talentBank = readSrc("src/services/recrutamento/talentBankService.ts");
    expect(talentBank).toContain("calcularCategoriaPerformance");

    const matchService = readSrc("src/services/operacao/matchPrestadoresService.ts");
    expect(matchService).toContain("calcularCategoriaPerformance");
  });

  it("F.3 PrestadorDetalhe detecta etapas iniciais do funil para isCandidato", () => {
    expect(detalhe).toContain("isCandidatoTalento");
    expect(detalhe).toContain("novo_candidato");
    expect(detalhe).toContain("cadastro_concluido");
    expect(detalhe).toContain("em_triagem");
    expect(detalhe).toContain("em_analise_perfil");
  });

  it("F.4 categorias são exatamente as 5 da Regra 12", () => {
    const categorias = ["Diamante", "Ouro", "Prata", "Bronze", "Em desenvolvimento"];
    const resultado = calcularCategoriaPerformance({ totalEntregas: 0, pontualidade: null });
    expect(categorias).toContain(resultado.categoria);
    expect(resultado.amostraInsuficiente).toBe(true);
  });
});
