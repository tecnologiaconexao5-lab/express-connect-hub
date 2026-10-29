// ============================================================
// MISSÃO COTACAO-LEADS — aba "Leads / Cotações Site" no Comercial
// Triagem das cotacoes_publicas + conversão 1-click em Orçamento.
// Testes baseados em fonte (readSrc) — padrão do repo.
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "..", "..");
const readSrc = (rel: string): string => readFileSync(join(raiz, rel), "utf8");

const serviceSrc = readSrc("src/services/cotacoes/cotacaoPublicaService.ts");
const leadsSrc = readSrc("src/components/comercial/cotacoes/LeadsCotacoesLista.tsx");
const comercialSrc = readSrc("src/pages/Comercial.tsx");
const sidebarSrc = readSrc("src/lib/sidebarData.ts");
const hookSrc = readSrc("src/hooks/useCotacoesPublicasRealtime.ts");
const orcamentosSrc = readSrc("src/components/comercial/OrcamentosLista.tsx");
const orcamentoFormSrc = readSrc("src/components/comercial/OrcamentoForm.tsx");
const orcamentoToOSSrc = readSrc("src/services/comercial/orcamentoToOSService.ts");
const alertaOsSrc = readSrc("src/components/dashboard/AlertaOscotacaoExpress.tsx");
const tabExecutivoSrc = readSrc("src/components/dashboard/TabExecutivo.tsx");
const tabComercialSrc = readSrc("src/components/dashboard/TabComercial.tsx");
const ordensListaSrc = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const dbMappersSrc = readSrc("src/lib/dbMappers.ts");

describe("A) Service — buscarLeadsCotacoes + helpers de exibição", () => {
  it("A.1 exporta buscarLeadsCotacoes com filtro .in('status') + order por created_at", () => {
    expect(serviceSrc).toContain("export async function buscarLeadsCotacoes");
    expect(serviceSrc).toContain('.in("status", STATUS_LEADS_TRIAGEM)');
    expect(serviceSrc).toContain('.order("created_at", { ascending: false })');
  });

  it("A.2 STATUS_LEADS_TRIAGEM cobre os 4 status reais (legado + V2)", () => {
    const bloco = serviceSrc.slice(
      serviceSrc.indexOf("export const STATUS_LEADS_TRIAGEM"),
      serviceSrc.indexOf("export async function buscarLeadsCotacoes"),
    );
    expect(bloco).toContain("STATUS_PENDENTE");
    expect(bloco).toContain("STATUS_AGUARDANDO_APROVACAO");
    expect(bloco).toContain("STATUS_AGUARDANDO_DETALHES");
    expect(bloco).toContain("STATUS_PRONTO_PARA_OS");
  });

  it("A.3 valorExibidoCotacao prioriza valor_aprovado e cai para metadata.precificacao.valor", () => {
    expect(serviceSrc).toContain("export function valorExibidoCotacao");
    const fn = serviceSrc.slice(
      serviceSrc.indexOf("export function valorExibidoCotacao"),
      serviceSrc.indexOf("export function resumoRotaCotacao"),
    );
    expect(fn).toContain("cotacao.valor_aprovado");
    expect(fn).toContain("metadata?.precificacao?.valor");
  });

  it("A.4 resumoRotaCotacao monta 'Origem → Destino' e veiculoSugeridoCotacao lê o motor", () => {
    expect(serviceSrc).toContain("export function resumoRotaCotacao");
    expect(serviceSrc).toContain("export function veiculoSugeridoCotacao");
    expect(serviceSrc).toContain("metadata?.precificacao?.rotulo_veiculo");
  });

  it("A.5 STATUS_LEAD_LABEL mapeia 'Aguardando Detalhes' → 'Aprovada pelo Cliente'", () => {
    expect(serviceSrc).toContain("[STATUS_AGUARDANDO_DETALHES]: \"Aprovada pelo Cliente\"");
    expect(serviceSrc).toContain("export const STATUS_LEAD_LABEL");
    expect(serviceSrc).toContain("export const STATUS_LEAD_COR");
  });
});

describe("B) Componente LeadsCotacoesLista", () => {
  it("B.1 colunas exatas: Cliente, WhatsApp, Origem/Destino, Veículo Sugerido, Valor, Status", () => {
    expect(leadsSrc).toContain("<TableHead>Cliente</TableHead>");
    expect(leadsSrc).toContain("<TableHead>WhatsApp</TableHead>");
    expect(leadsSrc).toContain("<TableHead>Origem / Destino</TableHead>");
    expect(leadsSrc).toContain("<TableHead>Veículo Sugerido</TableHead>");
    expect(leadsSrc).toContain("<TableHead className=\"text-right\">Valor</TableHead>");
    expect(leadsSrc).toContain("<TableHead>Status</TableHead>");
  });

  it("B.2 botão 'Converter em Orçamento/OS' navega com ?action=novo&cotacao=", () => {
    expect(leadsSrc).toContain("Converter em Orçamento/OS");
    expect(leadsSrc).toContain("navigate(`/comercial?tab=orcamentos&action=novo&cotacao=${cotacao.id}`)");
  });

  it("B.3 lead com orcamento_id mostra 'Ver Orçamento' em vez de converter", () => {
    expect(leadsSrc).toContain("Ver Orçamento");
    expect(leadsSrc).toContain("navigate(`/comercial?tab=orcamentos&orcamento=${orcamentoId}`)");
    expect(leadsSrc).toContain("const temOrcamento = Boolean(c.orcamento_id)");
  });

  it("B.4 assina Realtime de cotacoes_publicas e recarrega a lista", () => {
    expect(leadsSrc).toContain('table: "cotacoes_publicas"');
    expect(leadsSrc).toContain("void supabase.removeChannel(canal)");
  });

  it("B.5 usa buscarLeadsCotacoes + helpers do service (fonte única)", () => {
    expect(leadsSrc).toContain("buscarLeadsCotacoes");
    expect(leadsSrc).toContain("valorExibidoCotacao");
    expect(leadsSrc).toContain("resumoRotaCotacao");
    expect(leadsSrc).toContain("veiculoSugeridoCotacao");
    expect(leadsSrc).toContain("STATUS_LEAD_LABEL");
    expect(leadsSrc).toContain("STATUS_LEAD_COR");
  });

  it("B.6 busca + filtro de status com os 4 status de triagem", () => {
    expect(leadsSrc).toContain("filtroStatus");
    expect(leadsSrc).toContain("STATUS_LEADS_TRIAGEM.map");
  });
});

describe("C) Aba no Comercial + sidebar", () => {
  it("C.1 Comercial.tsx tem TabsTrigger e TabsContent value='leads'", () => {
    expect(comercialSrc).toContain("<TabsTrigger value=\"leads\"");
    expect(comercialSrc).toContain("Leads / Cotações Site");
    expect(comercialSrc).toContain("<TabsContent value=\"leads\">");
    expect(comercialSrc).toContain("LeadsCotacoesLista");
  });

  it("C.2 sidebar Gestão Comercial tem o subitem leads", () => {
    expect(sidebarSrc).toContain('title: "Leads / Cotações Site"');
    expect(sidebarSrc).toContain('path: "/comercial?tab=leads"');
  });
});

describe("D) Conversão 1-click — mesmo caminho da Torre (regressão)", () => {
  it("D.1 OrcamentosLista continua lendo ?action=novo&cotacao= e ?orcamento=", () => {
    expect(orcamentosSrc).toContain('"cotacao"');
    expect(orcamentosSrc).toContain('"orcamento"');
    expect(orcamentosSrc).toContain("montarOrcamentoDaCotacao");
  });

  it("D.2 vínculo orcamento_id ainda é gravado no save via vincularCotacaoAoOrcamento", () => {
    expect(orcamentosSrc).toContain("vincularCotacaoAoOrcamento");
  });

  it("D.3 montarOrcamentoDaCotacao segue exportado com cliente/endereços/valores", () => {
    expect(serviceSrc).toContain("export function montarOrcamentoDaCotacao");
    expect(serviceSrc).toContain("ID da cotação:");
    expect(serviceSrc).toContain("Cotação web (Fase 1)");
  });
});

describe("E) Alerta realtime na Torre (contrato F.2 preservado)", () => {
  it("E.1 os 3 títulos exatos dos toasts permanecem intactos", () => {
    expect(hookSrc).toContain("\"🚨 Nova Cotação Web (Pré-cadastro)!\"");
    expect(hookSrc).toContain("\"💰 Cotação aprovada pelo cliente!\"");
    expect(hookSrc).toContain("\"✅ Detalhes preenchidos pelo cliente!\"");
  });

  it("E.2 INSERT inclui o valor estimado no description quando há precificação", () => {
    expect(hookSrc).toContain("const valorTxt = preco !== null");
    expect(hookSrc).toContain("${valorTxt}");
  });

  it("E.3 navegação continua levando ao pré-preenchimento do orçamento", () => {
    expect(hookSrc).toContain("onAbrirCotacao");
  });
});

describe("F) Cliente avulso da cotação + badge OS + alocação de prestador", () => {
  it("F.1 garantirClienteAvulsoCotacao deduplica e cria em pre-cadastro sem .select()", () => {
    expect(serviceSrc).toContain("export async function garantirClienteAvulsoCotacao");
    expect(serviceSrc).toContain('.from("clientes")');
    expect(serviceSrc).toContain(".ilike(coluna, nome)");
    expect(serviceSrc).toContain('status: "pre-cadastro"');
    expect(serviceSrc).toContain("payload.id = novoId");
    expect(serviceSrc).toContain('rpc("current_tenant_id_safe")');
    expect(serviceSrc).not.toContain(".insert([payload]).select");
  });

  it("F.2 gerarOSDoOrcamento grava o UUID do cliente (nunca o nome)", () => {
    expect(orcamentoToOSSrc).toContain("garantirClienteAvulsoCotacao");
    expect(orcamentoToOSSrc).toContain("cliente: clienteUuid");
    expect(orcamentoToOSSrc).toContain("cliente_id: clienteUuid");
    expect(orcamentoToOSSrc).not.toContain('cliente: orc.cliente || ""');
    expect(orcamentoToOSSrc).toContain("sem cliente definido");
  });

  it("F.3 conversão marca carga.origem_cotacao para o badge", () => {
    expect(orcamentoToOSSrc).toContain("extrairCotacaoIdDoOrcamento");
    expect(orcamentoToOSSrc).toContain("origem_cotacao: cotacaoOrigemId");
    expect(orcamentoToOSSrc).toContain("ID da cotação:");
  });

  it("F.4 prefill da cotação define o clienteId do orçamento", () => {
    expect(orcamentosSrc).toContain("garantirClienteAvulsoCotacao");
    expect(orcamentosSrc).toContain(".clienteId = cliente.clienteId");
    expect(dbMappersSrc).toContain("d.cliente_id = form.clienteId");
    expect(dbMappersSrc).toContain("d.pedido_interno = form.pedidoInterno");
  });

  it("F.5 OrcamentoForm delega a conversão ao serviço (sem insert legado)", () => {
    expect(orcamentoFormSrc).toContain("gerarOSDoOrcamento(comDerivadosCarga(data))");
    expect(orcamentoFormSrc).not.toContain('from("os_enderecos")');
  });

  it("F.6 badge de OS via Cotação Express usa o marcador e leva para a aba OS", () => {
    expect(alertaOsSrc).toContain("carga->>origem_cotacao");
    expect(alertaOsSrc).toContain('"/operacao?tab=os"');
    expect(alertaOsSrc).toContain("STATUS_ENCERRADOS");
    expect(tabExecutivoSrc).toContain("<AlertaOscotacaoExpress />");
    expect(tabComercialSrc).toContain("<AlertaOscotacaoExpress />");
  });

  it("F.7 Alocar Prestador grava prestador/prestador_id/repasse e preserva o status", () => {
    expect(ordensListaSrc).toContain("Alocar Prestador");
    expect(ordensListaSrc).toContain("prestador_id: prestadorAlocacao");
    expect(ordensListaSrc).toContain("custo_prestador: repasse");
    expect(ordensListaSrc).toContain('table="prestadores"');
    expect(ordensListaSrc).toContain("repasse do prestador (maior que zero)");
    expect(ordensListaSrc).not.toContain('status: "agendada"');
  });
});
