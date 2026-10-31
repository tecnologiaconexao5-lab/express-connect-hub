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

  it("A.3 exibe o Resumo Operacional concatenado (Conexão Talent AI)", () => {
    expect(detalhe).toContain("Conexão Talent AI · Resumo Operacional");
    expect(detalhe).toContain("montarResumoTalent(");
    expect(detalhe).toContain("{resumoTalent}");
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
