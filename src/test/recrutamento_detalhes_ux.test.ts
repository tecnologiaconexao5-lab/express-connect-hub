/**
 * RECRUTAMENTO-DETALHES-UX — legibilidade/interatividade da aba Comprometimento
 * e design premium + defaults do App na aba Questionário.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const SHEET = readSrc("src/modules/recrutamento/components/enterprise-kanban/DetalhesCandidatoPipelineSheet.tsx");
const SERVICE = readSrc("src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts");
const TYPES = readSrc("src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts");
const CSS = readSrc("src/index.css");

describe("1) Aba Comprometimento — legibilidade e checklist interativa", () => {
  it("aumenta a tipografia da aba e da checklist", () => {
    expect(SHEET).toContain('text-sm font-medium leading-snug');
    expect(SHEET).toContain('p-4 rounded-lg bg-muted/20 text-sm text-muted-foreground leading-relaxed');
    expect(SHEET).toContain('title="Score de Comprometimento" large');
    expect(SHEET).toContain('title="Checklist de Comprometimento" large');
  });

  it("renderiza cada item como checkbox clicável acessível", () => {
    expect(SHEET).toContain('role="checkbox"');
    expect(SHEET).toContain('aria-checked={ok}');
    expect(SHEET).toContain('onClick={() => handleToggleChecklistComprometimento(item.key, ok)}');
  });

  it("persiste o ajuste manual em questionario_respostas (JSONB existente)", () => {
    expect(SHEET).toContain("CHECKLIST_OVERRIDES_KEY = '__checklist_comprometimento'");
    expect(SHEET).toContain("lerOverridesChecklist");
    expect(SHEET).toContain("[CHECKLIST_OVERRIDES_KEY]: JSON.stringify(overrides)");
    expect(SHEET).toContain("enterpriseKanbanService.atualizar(candidate.id, { questionarioRespostas: respostasNovas })");
  });
});

describe("2) Aba Questionário — design premium e defaults do banco", () => {
  it("usa inputs/textarea premium (padding, borda suave e foco primário)", () => {
    expect(SHEET).toContain('rounded-lg border border-slate-300/70 bg-background px-3.5 text-sm');
    expect(SHEET).toContain('min-h-[88px] w-full resize-y rounded-lg');
    expect(SHEET).toContain('focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20');
    expect(SHEET).toContain('<Textarea');
  });

  it("mescla questionario_respostas + respostas_situacionais + preferencias_operacionais", () => {
    expect(SHEET).toContain("mergeObject(candidate.questionarioRespostas)");
    expect(SHEET).toContain("mergeObject(candidate.respostasSituacionais)");
    expect(SHEET).toContain("candidate.preferenciasOperacionais");
    expect(SHEET).toContain("respostasIniciaisQuestionario(candidate)");
    expect(SHEET).toContain("Preferências Operacionais (App)");
  });

  it("o service mapeia as colunas do App para o candidato", () => {
    expect(SERVICE).toContain("preferenciasOperacionais: row.preferencias_operacionais ?? null");
    expect(SERVICE).toContain("respostasSituacionais: row.respostas_situacionais ?? null");
    expect(SERVICE).toContain("['preferenciasOperacionais', 'preferencias_operacionais']");
    expect(SERVICE).toContain("['respostasSituacionais', 'respostas_situacionais']");
    expect(TYPES).toContain("preferenciasOperacionais?: Record<string, unknown> | null");
    expect(TYPES).toContain("respostasSituacionais?: Record<string, string> | null");
  });

  it("salvar mantém as respostas editáveis por cima e preserva a checklist", () => {
    expect(SHEET).toContain("const respostasCompletas: Record<string, string> = { ...respostas }");
    expect(SHEET).toContain("respostasCompletas[CHECKLIST_OVERRIDES_KEY] = checklistAtual");
    expect(SHEET).toContain("await onSave(respostasCompletas)");
  });
});

describe("3) Abas do painel do candidato — legibilidade e rolagem horizontal", () => {
  it("aumenta a fonte dos gatilhos e o espaçamento de clique", () => {
    expect(SHEET).toContain("px-3 py-2 text-sm font-medium");
    expect(SHEET).not.toContain('<TabsTrigger value="perfil" className="text-[10px]');
    expect(SHEET).not.toContain('<TabsTrigger value="documentos" className="text-[10px]');
  });

  it("permite rolagem horizontal suave com scrollbar escondida", () => {
    expect(SHEET).toContain("overflow-x-auto");
    expect(SHEET).toContain("!flex-nowrap");
    expect(SHEET).toContain("scrollbar-none");
    expect(SHEET).toContain("whitespace-nowrap");
    expect(SHEET).toContain("shrink-0");
    expect(CSS).toContain(".scrollbar-none");
    expect(CSS).toContain("-ms-overflow-style: none");
    expect(CSS).toContain(".scrollbar-none::-webkit-scrollbar");
  });
});
