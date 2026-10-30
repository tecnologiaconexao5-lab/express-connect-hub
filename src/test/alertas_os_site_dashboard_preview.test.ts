// ============================================================
// ALERTAS DE OS DO SITE + PREVIEW EM PAINEL DE ALTA DENSIDADE
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { obterAgendamentoClienteOS } from "@/lib/cotacaoOS";

const raiz = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(raiz, p), "utf8");

const topbar = read("src/components/AppTopbar.tsx");
const hook = read("src/hooks/useOSSiteAlerts.ts");
const osLista = read("src/components/operacao/OrdensServicoLista.tsx");
const preview = read("src/components/operacao/OrdemServicoPreview.tsx");
const dashboardCard = read("src/components/dashboard/AlertaOscotacaoExpress.tsx");
const tabExecutivo = read("src/components/dashboard/TabExecutivo.tsx");
const service = read("src/services/operacao/osSiteService.ts");
const migration = read("supabase/migrations/20261030000000_cotacao_detalhes_para_os.sql");

describe("A) Chamado agendado (data/hora do cliente)", () => {
  it("lê data/hora do carga da OS", () => {
    const ag = obterAgendamentoClienteOS({
      carga: { data_desejada: "2026-10-30", hora_desejada: "14:30", agendado: true },
    });
    expect(ag.agendada).toBe(true);
    expect(ag.dataHora).toBe("30/10/2026 às 14:30");
  });

  it("faz fallback pelas observações legadas da cotação", () => {
    const ag = obterAgendamentoClienteOS({
      observacoes: "Cotação web · Data desejada: 31/10/2026 · Horário: 08:15",
    });
    expect(ag.agendada).toBe(true);
    expect(ag.dataHora).toBe("31/10/2026 às 08:15");
  });

  it("não trata OS imediata como agendada", () => {
    expect(obterAgendamentoClienteOS({ carga: { origem_cotacao: "abc" } }).agendada).toBe(false);
  });

  it("RPC grava data_desejada/hora_desejada/agendado no carga", () => {
    expect(migration).toContain("'data_desejada'");
    expect(migration).toContain("'hora_desejada'");
    expect(migration).toContain("'agendado'");
  });

  it("tabela de OS exibe o badge AGENDADO ao lado do cliente", () => {
    expect(osLista).toContain("agendadaCotacao");
    expect(osLista).toContain("Agendado");
    expect(osLista).toContain("agendamentoCotacao");
  });
});

describe("B) Header / sino — alertas persistentes de OS do site", () => {
  it("usa o hook real no topbar", () => {
    expect(topbar).toContain("useOSSiteAlerts");
    expect(topbar).toContain("marcarLida");
    expect(topbar).toContain("operacao?tab=os&os=");
  });

  it("escuta INSERT de ordens_servico e mantém polling de segurança", () => {
    expect(hook).toContain('table: "ordens_servico"');
    expect(hook).toContain("INTERVALO_POLLING_MS");
    expect(hook).toContain("listarOSSite");
  });

  it("dispara toast persistente (Infinity) nos dois formatos", () => {
    expect(hook).toContain("duration: Infinity");
    expect(hook).toContain("🚨 Nova OS de Cliente Recebida!");
    expect(hook).toContain("⚠️ CHAMADO AGENDADO -");
    expect(hook).toContain("toast.warning");
    expect(hook).toContain("toast.error");
  });

  it("o sino usa badge vermelho com a contagem não lida", () => {
    expect(topbar).toContain("bg-red-500 rounded-full");
    expect(topbar).toContain("naoLidas");
  });
});

describe("C) Dashboard — Solicitações de Clientes Site", () => {
  it("card tem o título e lista rápida das OS pendentes", () => {
    expect(dashboardCard).toContain("Solicitações de Clientes Site");
    expect(dashboardCard).toContain("listarOSSite");
    expect(dashboardCard).toContain("osSitePendente");
    expect(dashboardCard).toContain("Agendado");
    expect(dashboardCard).toContain("/operacao?tab=os");
    expect(dashboardCard).toContain("carga->>origem_cotacao");
    expect(dashboardCard).toContain("STATUS_ENCERRADOS");
  });

  it("aparece no topo do painel executivo", () => {
    const idxBanner = tabExecutivo.indexOf("<AlertaOscotacaoExpress />");
    const idxKpi = tabExecutivo.indexOf("Faturamento Total");
    expect(idxBanner).toBeGreaterThan(-1);
    expect(idxBanner).toBeLessThan(idxKpi);
  });

  it("service consulta o marcador carga->>origem_cotacao", () => {
    expect(service).toContain('"carga->>origem_cotacao"');
  });
});

describe("D) Preview da OS em painel de alta densidade", () => {
  it("modal ocupa a tela e não limita o conteúdo a max-w-4xl", () => {
    expect(osLista).toContain("w-[96vw] max-w-[1600px]");
    expect(preview).not.toContain('className="max-w-4xl mx-auto space-y-6"');
  });

  it("linha do tempo ocupa 100% e o restante vai para grid de 2 colunas", () => {
    expect(preview).toContain("xl:grid-cols-[minmax(0,1fr)_380px]");
    expect(preview).toContain('<div className="xl:col-span-2 xl:row-start-1">');
    expect(preview).toContain("<TimelineRastreio status={os.status} />");
  });

  it("cards laterais e principais usam colunas explícitas", () => {
    expect(preview).toContain("xl:col-start-1");
    expect(preview).toContain("xl:col-start-2");
    expect(preview).toContain("space-y-6 xl:col-span-2");
  });
});
