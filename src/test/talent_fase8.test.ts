// ============================================================
// FASE 8 — Comunicação, reativação, responsividade e sync final
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const comunicacao = readSrc("src/services/recrutamento/talentComunicacaoService.ts");
const detalhe = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");
const talentList = readSrc("src/components/recrutamento/banco-talentos/TalentList.tsx");
const kanbanBoard = readSrc(
  "src/modules/recrutamento/components/enterprise-kanban/EnterpriseKanbanBoard.tsx",
);
const kanbanColumn = readSrc(
  "src/modules/recrutamento/components/enterprise-kanban/KanbanColumn.tsx",
);
const osForm = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const bankService = readSrc("src/services/recrutamento/talentBankService.ts");
const kanbanService = readSrc(
  "src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts",
);
const rpcApp = readSrc("supabase/migrations/20261031000001_talent_perfil.sql");

describe("A) Comunicação integrada e CRM", () => {
  it("envia WhatsApp, notifica App e registra em crm_interacoes_prestadores", () => {
    expect(comunicacao).toContain("crm_interacoes_prestadores");
    expect(comunicacao).toContain("portal_notificacoes");
    expect(comunicacao).toContain("wa.me");
    expect(comunicacao).toContain("enviarWhatsAppTalent");
    expect(comunicacao).toContain("notificarAppTalent");
    expect(comunicacao).toContain("crmService.criar");
  });

  it("reativa candidatos inativos com template de disponibilidade", () => {
    expect(comunicacao).toContain("TEMPLATE_REATIVACAO");
    expect(comunicacao).toContain("montarTemplateReativacao");
    expect(comunicacao).toContain("em_triagem");
    expect(comunicacao).toContain("homologado_indisponivel");
    expect(comunicacao).toContain("homologado_disponivel");
    expect(comunicacao).toContain("está disponível para novas operações");
  });

  it("Ficha do prestador e Banco de Talentos expõem as ações rápidas", () => {
    expect(detalhe).toContain("Enviar WhatsApp");
    expect(detalhe).toContain("Notificação App");
    expect(detalhe).toContain("Reativar Candidato");
    expect(talentList).toContain("WhatsApp");
    expect(talentList).toContain("Reativar");
    expect(talentList).toContain("notificarAppTalent");
  });
});

describe("B) Responsividade dos componentes Fases 3–7", () => {
  it("Ficha 360º tem abas flexíveis e grids responsivos", () => {
    expect(detalhe).toContain("flex h-auto w-full flex-wrap justify-start");
    expect(detalhe).toContain("grid-cols-1 gap-4 sm:grid-cols-2");
  });

  it("Kanban de 17 etapas tem scroll horizontal fluido no mobile", () => {
    expect(kanbanBoard).toContain("snap-x snap-mandatory overflow-x-auto overscroll-x-contain");
    expect(kanbanBoard).toContain("min-w-[280px]");
    expect(kanbanColumn).toContain("snap-start");
    expect(kanbanColumn).toContain("min-w-[280px]");
  });

  it("cards de match empilham justificativas/ações no mobile", () => {
    expect(osForm).toContain("flex flex-col gap-3 rounded-xl border p-3 sm:flex-row");
    expect(osForm).toContain("flex w-full flex-wrap items-center gap-1.5 sm:w-auto");
  });
});

describe("C) Regressão de integrações e duplicidade", () => {
  it("Banco de Talentos deduplica por prestador e inclui candidato App", () => {
    expect(bankService).toContain("new Map(prestadores.map((p) => [p.id, p]))");
    expect(bankService).toContain("carregarPrestadoresBase(300, true)");
    expect(bankService).toContain("stagePorPrestador");
  });

  it("RPC do App é idempotente por auth_user_id", () => {
    expect(rpcApp).toContain("CREATE OR REPLACE FUNCTION public.app_s6_criar_prestador");
    expect(rpcApp).toContain("WHERE auth_user_id = v_auth_uid");
    expect(rpcApp).toContain("SELECT id INTO v_existing_id");
    expect(rpcApp).toContain("PERFORM public.app_s6_salvar_perfil_talento(");
  });

  it("Bridge App → Kanban mantém dedup por prestador", () => {
    expect(kanbanService).toContain("origem_cadastro");
    expect(kanbanService).toContain("prestadorIdsExistentes");
    expect(kanbanService).toContain("new Set(");
    expect(kanbanService).toContain("toDB({");
  });
});
