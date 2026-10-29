// ============================================================
// COTAÇÃO EXPRESS — polimento final: fluxo sequencial (sem
// modalidades), header corporativo e marcas d'água por etapa.
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "..", "..");
const pageSrc = readFileSync(join(raiz, "src/pages/CotacaoExpress.tsx"), "utf8");

describe("A) Fluxo sequencial (sem 'Tipo de Solicitação' e sem WhatsApp no header)", () => {
  it("A.1 não há seletor de modalidade nem CTA de WhatsApp no topo", () => {
    expect(pageSrc).not.toContain("Tipo de Solicitação");
    expect(pageSrc).not.toContain("Retirada na Base");
    expect(pageSrc).not.toContain("Envio Aéreo");
    expect(pageSrc).not.toContain("Falar no WhatsApp");
  });

  it("A.2 etapa 1 é a identificação de quem solicita", () => {
    expect(pageSrc).toContain("ETAPA 1 — quem pediu");
    expect(pageSrc).toContain("Como posso te chamar?");
    expect(pageSrc).toContain("Leva 30 segundos. Sem cadastro, sem senha.");
  });
});

describe("B) Header corporativo (roxo escuro + laranja)", () => {
  it("B.1 fundo roxo escuro da marca com destaque laranja e textos claros", () => {
    expect(pageSrc).toContain('border-b-2 border-orange-500 bg-[#2E1065]');
    expect(pageSrc).not.toContain("bg-slate-900 px-4 py-3 flex items-center justify-between");
    expect(pageSrc).toContain("bg-orange-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white");
    expect(pageSrc).toContain("text-sm font-extrabold tracking-tight text-white");
  });

  it("B.2 logo com fallback textual permanece", () => {
    expect(pageSrc).toContain('src="/logos/logo-conexao-oficial.png"');
    expect(pageSrc).toContain("onError={() => setLogoOk(false)}");
  });
});

describe("C) Marcas d'água responsivas por etapa", () => {
  it("C.1 mapeia as 4 imagens institucionais por etapa", () => {
    expect(pageSrc).toContain('if (etapa === 1) return "/bg-callcenter.png";');
    expect(pageSrc).toContain('if (etapa === 2) return "/bg-tecnologia.png";');
    expect(pageSrc).toContain('if (etapa === 3) return "/bg-entregador1.jpg";');
    expect(pageSrc).toContain('return "/bg-motoboy.png";');
  });

  it("C.2 camada absoluta atrás do conteúdo, sem interferir na leitura/cliques", () => {
    expect(pageSrc).toContain("pointer-events-none absolute inset-0 z-[-1]");
    expect(pageSrc).toContain("bg-cover bg-center bg-no-repeat bg-fixed");
    expect(pageSrc).toContain("opacity-[0.04]");
    expect(pageSrc).toContain("style={{ backgroundImage: `url('${bgPorEtapa(etapa)}')` }}");
    expect(pageSrc).toContain('aria-hidden="true"');
    expect(pageSrc).toContain("z-[-2] bg-gradient-to-br from-orange-50 via-white to-slate-100");
  });

  it("C.3 layout centralizado (max-w-2xl) preservado e conteúdo acima do fundo", () => {
    expect(pageSrc).toContain("mx-auto w-full max-w-2xl space-y-4");
    expect(pageSrc).toContain('className="relative z-0 flex-1 px-4 pt-5 pb-40');
  });
});
