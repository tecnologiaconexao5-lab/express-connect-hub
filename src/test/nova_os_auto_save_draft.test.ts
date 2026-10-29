// ============================================================
// AUTO-SAVE & RETENÇÃO DE ESTADO — rascunho em localStorage,
// reidratação da Nova OS, limpeza no save/descarte e route blocker.
// ============================================================
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  lerRascunhoForm,
  gravarRascunhoForm,
  limparRascunhoForm,
  descartarRascunhoForm,
  liberarRascunhoForm,
} from "@/lib/formDraft";

const raiz = join(__dirname, "..", "..");
const readSrc = (rel: string): string => readFileSync(join(raiz, rel), "utf8");

const osFormSrc = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const hookSrc = readSrc("src/hooks/useRouterBlocker.ts");
const exitGuardSrc = readSrc("src/hooks/useFormExitGuard.ts");
const appSrc = readSrc("src/App.tsx");
const orcamentoSrc = readSrc("src/components/comercial/OrcamentoForm.tsx");
const clienteSrc = readSrc("src/components/clientes/ClienteDetalhe.tsx");

const CHAVE = "teste_draft_vitest";

describe("A) Helpers de rascunho (localStorage + TTL)", () => {
  beforeEach(() => {
    liberarRascunhoForm(CHAVE);
    localStorage.removeItem(CHAVE);
  });

  it("A.1 grava e lê o rascunho com envelope { savedAt, value }", () => {
    gravarRascunhoForm(CHAVE, { campo: "valor", n: 42 });
    const relido = lerRascunhoForm<{ campo: string; n: number }>(CHAVE);
    expect(relido).toEqual({ campo: "valor", n: 42 });
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || "{}");
    expect(typeof bruto.savedAt).toBe("string");
  });

  it("A.2 rascunho expirado (TTL) é descartado na leitura", () => {
    localStorage.setItem(
      CHAVE,
      JSON.stringify({ savedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), value: { velho: true } }),
    );
    expect(lerRascunhoForm(CHAVE)).toBeNull();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("A.3 descarte bloqueia regravação; limpar libera de novo", () => {
    gravarRascunhoForm(CHAVE, { v: 1 });
    descartarRascunhoForm(CHAVE);
    expect(localStorage.getItem(CHAVE)).toBeNull();

    gravarRascunhoForm(CHAVE, { v: 2 }); // bloqueado
    expect(localStorage.getItem(CHAVE)).toBeNull();

    liberarRascunhoForm(CHAVE);
    gravarRascunhoForm(CHAVE, { v: 3 });
    expect(lerRascunhoForm(CHAVE)).toEqual({ v: 3 });

    limparRascunhoForm(CHAVE);
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});

describe("B) OS — auto-save e reidratação da Nova OS", () => {
  it("B.1 usa localStorage com chave tms_os_draft_v1 e TTL", () => {
    expect(osFormSrc).toContain('const OS_DRAFT_PREFIX = "tms_os_draft_v1";');
    expect(osFormSrc).toContain("localStorage.getItem(key)");
    expect(osFormSrc).toContain("localStorage.setItem(key, JSON.stringify(draft))");
    expect(osFormSrc).toContain("OS_DRAFT_TTL_MS");
  });

  it("B.2 restaura rascunho também no modo NOVO (troca de aba)", () => {
    expect(osFormSrc).toContain('modo === "ver" ? null : lerRascunhoLocal(draftKey)');
    expect(osFormSrc).toContain("liberarRascunhoLocal(draftKey);");
    expect(osFormSrc).toContain("if (!formDirty && !rascunhoInicial) return;");
  });

  it("B.3 limpa o rascunho ao salvar e no descarte confirmado", () => {
    expect(osFormSrc).toContain("draftRef.current = null;");
    expect(osFormSrc).toContain("limparRascunhoLocal(draftKey);");
    expect(osFormSrc).toContain("descartarRascunhoLocal(draftKey);");
    expect(osFormSrc).toContain("onDiscard: () => {");
  });
});

describe("C) Route blocker (useBlocker) no guard", () => {
  it("C.1 hook usa useBlocker e segura a transição até confirmar", () => {
    expect(hookSrc).toContain('import { useBlocker } from "react-router-dom";');
    expect(hookSrc).toContain("const blocker = useBlocker(");
    expect(hookSrc).toContain('if (blocker.state !== "blocked")');
    expect(hookSrc).toContain("blocker.proceed();");
    expect(hookSrc).toContain("blocker.reset();");
    expect(exitGuardSrc).toContain("onDiscardRef");
    expect(osFormSrc).toContain("useRouterBlocker({");
    expect(orcamentoSrc).toContain("useRouterBlocker({");
    expect(clienteSrc).toContain("useRouterBlocker({");
  });

  it("C.2 App migrado para data router (createBrowserRouter)", () => {
    expect(appSrc).toContain("createBrowserRouter(");
    expect(appSrc).toContain("createRoutesFromElements(");
    expect(appSrc).toContain("<RouterProvider router={router} />");
    expect(appSrc).not.toContain("<BrowserRouter>");
  });
});

describe("D) Cadastros principais — rascunho local", () => {
  it("D.1 Orçamento salva/restaura rascunho e limpa ao salvar", () => {
    expect(orcamentoSrc).toContain("tms_orcamento_draft_v1:");
    expect(orcamentoSrc).toContain("useAutoSaveFormDraft(draftKey, data, modo !== \"ver\");");
    expect(orcamentoSrc).toContain("limparRascunhoForm(draftKey);");
  });

  it("D.2 Cliente (novo) salva/restaura rascunho e limpa ao salvar", () => {
    expect(clienteSrc).toContain("tms_cliente_draft_v1:");
    expect(clienteSrc).toContain("useAutoSaveFormDraft(draftKey, c, isNew);");
    expect(clienteSrc).toContain("if (isNew) limparRascunhoForm(draftKey);");
  });
});
