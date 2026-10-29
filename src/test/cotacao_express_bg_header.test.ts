// ============================================================
// COTAÇÃO EXPRESS — polimento final: fluxo sequencial (sem
// modalidades), header corporativo e marcas d'água por etapa.
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "..", "..");
const pageSrc = readFileSync(join(raiz, "src/pages/CotacaoExpress.tsx"), "utf8");
const detalhesSrc = readFileSync(join(raiz, "src/pages/CotacaoExpressDetalhes.tsx"), "utf8");
const serviceSrc = readFileSync(
  join(raiz, "src/services/cotacoes/cotacaoPublicaService.ts"),
  "utf8",
);
const indexHtml = readFileSync(join(raiz, "index.html"), "utf8");
const manifest = readFileSync(join(raiz, "public/manifest.json"), "utf8");
const migrationSrc = readFileSync(
  join(raiz, "supabase/migrations/20261030000000_cotacao_detalhes_para_os.sql"),
  "utf8",
);

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
  it("C.1 mapeia as imagens institucionais por etapa", () => {
    expect(pageSrc).toContain('if (etapa === 1) return "/bg-callcenter.png";');
    expect(pageSrc).toContain('if (etapa === 2) return "/Frota 2.png";');
    expect(pageSrc).toContain('if (etapa === 3 || etapa === 4) return "/bg-tecnologia.png";');
    expect(pageSrc).toContain('if (etapa === 5 || etapa === 6 || etapa === 7) return "/bg-entregador1.jpg";');
    expect(pageSrc).toContain('return "/Equipe.png";');
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

describe("D) Tela final da cotação (Fase 2)", () => {
  it("D.1 logotipo oficial substitui o título textual genérico", () => {
    expect(detalhesSrc).toContain('src="/logos/logo-conexao-colorido.png"');
    expect(detalhesSrc).toContain("MENSAGEM_CONCLUSAO");
    expect(detalhesSrc).not.toContain("⚡ CONEXÃO EXPRESS");
  });

  it("D.2 mensagem exata da conclusão da OS", () => {
    expect(detalhesSrc).toContain(
      "Perfeito! Tudo pronto para a emissão da sua Ordem de Serviço. Recebemos os endereços completos da rota. Nossa equipe já está montando a OS e você recebe a confirmação pelo WhatsApp.",
    );
  });

  it("D.3 imagem de Parceria Logística como fundo em tela cheia", () => {
    expect(detalhesSrc).toContain('style={{ backgroundImage: "url(\'/Parceria logistica.png\')" }}');
    expect(detalhesSrc).toContain("absolute inset-0 bg-cover bg-center bg-no-repeat");
    expect(detalhesSrc).not.toContain('src="/Parceria logistica.png"');
  });

  it("D.4 preenchimento dos endereços tem marca d'água de rota", () => {
    expect(detalhesSrc).toContain('style={{ backgroundImage: "url(\'/bg-entregador1.jpg\')" }}');
    expect(detalhesSrc).toContain(
      "absolute inset-0 z-[-1] bg-cover bg-center bg-no-repeat bg-fixed opacity-[0.05]",
    );
    expect(detalhesSrc).toContain("relative min-h-screen overflow-x-hidden");
  });

  it("D.5 ao enviar os endereços cria orçamento no Comercial e OS na Operação", () => {
    expect(detalhesSrc).toContain("converterCotacaoEmOrcamentoEOS(id)");
    expect(serviceSrc).toContain("export async function converterCotacaoEmOrcamentoEOS");
    expect(serviceSrc).toContain('supabase.rpc("f_cotacao_detalhes_para_os"');
    expect(migrationSrc).toContain("CREATE OR REPLACE FUNCTION public.f_cotacao_detalhes_para_os");
    expect(migrationSrc).toContain("SECURITY DEFINER");
    expect(migrationSrc).toContain("GRANT EXECUTE ON FUNCTION public.f_cotacao_detalhes_para_os(uuid) TO anon, authenticated");
    expect(migrationSrc).toContain("INSERT INTO public.orcamentos");
    expect(migrationSrc).toContain("INSERT INTO public.ordens_servico");
    expect(migrationSrc).toContain("pg_advisory_xact_lock");
  });
});

describe("E) Favicon e ícone do sistema com o logo oficial", () => {
  it("E.1 index.html usa o X da Conexão Express como favicon", () => {
    expect(indexHtml).toContain('href="/favicon-512.png"');
    expect(indexHtml).toContain('href="/favicon-192.png"');
    expect(indexHtml).toContain('rel="apple-touch-icon"');
    expect(indexHtml).not.toMatch(/heart/i);
  });

  it("E.2 manifest PWA aponta para os ícones oficiais", () => {
    expect(manifest).toContain('"/favicon-192.png"');
    expect(manifest).toContain('"/favicon-512.png"');
    expect(manifest).not.toContain("logo-oficial-conexao.png");
  });
});
