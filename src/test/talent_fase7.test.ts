// ============================================================
// FASE 7 — Disponibilidade instantânea, convites, treinamentos,
// performance e alertas inteligentes (LGPD)
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { podeVerAvaliacaoSituacional } from "@/lib/permissoes";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const migration = readSrc("supabase/migrations/20261031000002_talent_fase7.sql");
const detalhe = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");
const alerts = readSrc("src/hooks/useTalentAIAlerts.ts");
const store = readSrc("src/stores/talentBankStore.ts");
const talentList = readSrc("src/components/recrutamento/banco-talentos/TalentList.tsx");

describe("A) Migration Fase 7", () => {
  it("adiciona status instantâneo e as tabelas de convites/treinamentos", () => {
    expect(migration).toContain("status_disponibilidade");
    expect(migration).toContain("'disponivel', 'indisponivel', 'em_operacao'");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.recrutamento_convites_os");
    expect(migration).toContain("tempo_resposta_minutos");
    expect(migration).toContain("motivo_recusa");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.prestador_treinamentos");
    expect(migration).toContain("data_conclusao");
    expect(migration).toContain("validade");
  });

  it("prepara documentos para os alertas de validade", () => {
    expect(migration).toContain("ALTER TABLE public.documentos_prestadores");
    expect(migration).toContain("data_vencimento date");
    expect(migration).toContain("validade date");
  });
});

describe("B) Store e UI de disponibilidade", () => {
  it("store expõe o status instantâneo", () => {
    expect(store).toContain("statusDisponibilidade");
    expect(store).toContain("atualizarStatusDisponibilidade");
    expect(store).toContain("em_operacao");
  });

  it("banco de talentos exibe o selo de status", () => {
    expect(talentList).toContain("Em Operação");
    expect(talentList).toContain("Indisponível");
  });
});

describe("C) Treinamentos e LGPD", () => {
  it("PrestadorDetalhe lista treinamentos concluídos", () => {
    expect(detalhe).toContain("prestador_treinamentos");
    expect(detalhe).toContain("Treinamentos concluídos");
  });

  it("Avaliação Situacional é restrita a recrutador/admin", () => {
    expect(detalhe).toContain("podeVerAvaliacao");
    expect(podeVerAvaliacaoSituacional("super_admin")).toBe(true);
    expect(podeVerAvaliacaoSituacional("admin")).toBe(true);
    expect(podeVerAvaliacaoSituacional("operador")).toBe(true);
    expect(podeVerAvaliacaoSituacional("comercial")).toBe(false);
    expect(podeVerAvaliacaoSituacional("financeiro")).toBe(false);
    expect(podeVerAvaliacaoSituacional("cliente")).toBe(false);
    expect(podeVerAvaliacaoSituacional("prestador")).toBe(false);
  });
});

describe("D) Alertas Inteligentes", () => {
  it("varre documentos e inatividade do funil", () => {
    expect(alerts).toContain("documentos_prestadores");
    expect(alerts).toContain("data_vencimento");
    expect(alerts).toContain("recrutamento_candidatos");
    expect(alerts).toContain("funil_inativo");
    expect(alerts).toContain("useTalentAIAlerts");
  });
});
