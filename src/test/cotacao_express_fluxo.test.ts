import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  montarParadasFase1,
  extrairCep,
  gerarNumeroOrcamento,
  gerarLinkFase2,
  montarOrcamentoDaCotacao,
  criarCotacaoFase1,
  buscarCotacao,
  buscarCotacaoPorOrcamento,
  salvarDetalhesFase2,
  vincularCotacaoAoOrcamento,
  gerarLinkFase2EAtualizarStatus,
  MAX_PARADAS_COTACAO,
  type CotacaoPublica,
} from "@/services/cotacoes/cotacaoPublicaService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

// ============================================================================
// MISSÃO COTACAO-EXPRESS — fluxo público de cotação em 2 fases:
// A) Migration cotacoes_publicas (RLS anônimo + Realtime)
// B) Service (guardas, mapeamentos, pré-preenchimento do orçamento)
// C) Fase 1 — /cotacao-express (4 passos, sem fricção)
// D) Fase 2 — /cotacao-express/detalhes/:id (endereços completos)
// E) Rotas públicas no App.tsx
// F) Alertas Realtime na Torre de Controle + integração comercial
// ============================================================================

const migration = readSrc("supabase/migrations/20261024000000_cotacoes_publicas.sql");
const fase1 = readSrc("src/pages/CotacaoExpress.tsx");
const fase2 = readSrc("src/pages/CotacaoExpressDetalhes.tsx");
const app = readSrc("src/App.tsx");
const hook = readSrc("src/hooks/useCotacoesPublicasRealtime.ts");
const layout = readSrc("src/components/AppLayout.tsx");
const lista = readSrc("src/components/comercial/OrcamentosLista.tsx");
const form = readSrc("src/components/comercial/OrcamentoForm.tsx");
const service = readSrc("src/services/cotacoes/cotacaoPublicaService.ts");

const cotacaoExemplo = (): CotacaoPublica => ({
  id: "cota-0001",
  status: "Pendente",
  nome_cliente: "Maria Souza",
  telefone: "(11) 99999-1234",
  carga_descricao: "3 caixas de documentos",
  carga_peso: 18,
  carga_dimensoes: "40x40x40 cm",
  carga_volumes: 3,
  paradas: [
    { sequencia: 1, tipo: "retirada", endereco: "Rua das Flores, 100 - Centro" },
    { sequencia: 2, tipo: "entrega", endereco: "Av. Paulista, 2000" },
  ],
  data_desejada: "2026-11-05",
  hora_desejada: "09:30",
  detalhes: [],
  orcamento_id: null,
  valor_aprovado: null,
});

describe("A) Migration cotacoes_publicas — RLS anônimo + Realtime", () => {
  it("A.1 — cria a tabela com id UUID e status default 'Pendente'", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.cotacoes_publicas");
    expect(migration).toContain("id UUID DEFAULT gen_random_uuid() PRIMARY KEY");
    expect(migration).toContain(
      "status TEXT NOT NULL DEFAULT 'Pendente'",
    );
  });

  it("A.2 — CHECK aceita exatamente os 3 status do fluxo", () => {
    expect(migration).toContain(
      "CHECK (status IN ('Pendente', 'Aguardando Detalhes', 'Pronto para OS'))",
    );
  });

  it("A.3 — guarda paradas (Fase 1), detalhes (Fase 2), vínculo e valor", () => {
    expect(migration).toContain("paradas JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(migration).toContain("detalhes JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(migration).toContain("orcamento_id UUID");
    expect(migration).toContain("valor_aprovado NUMERIC");
    expect(migration).toContain("data_desejada DATE");
  });

  it("A.4 — RLS ativo e INSERT aberto para o formulário público (anon)", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("cotacoes_publicas_insert_anon");
    expect(migration).toContain("FOR INSERT TO anon, authenticated");
    expect(migration).toContain("GRANT INSERT ON TABLE public.cotacoes_publicas TO anon");
    expect(migration).toContain("GRANT UPDATE ON TABLE public.cotacoes_publicas TO anon");
    expect(migration).toContain(
      "FOR DELETE TO authenticated",
    );
  });

  it("A.5 — Realtime habilitado (fonte dos alertas do TMS)", () => {
    expect(migration).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.cotacoes_publicas",
    );
    expect(migration).toContain("current_tenant_id_safe");
  });
});

describe("B) Service — guardas, mapeamentos e pré-preenchimento", () => {
  it("B.1 — montarParadasFase1: 1ª é retirada, demais são entrega, vazias saem", () => {
    const paradas = montarParadasFase1(["Rua A, 10", "Av. B, 50", "   "]);
    expect(paradas).toHaveLength(2);
    expect(paradas[0]).toEqual({
      sequencia: 1,
      tipo: "retirada",
      endereco: "Rua A, 10",
    });
    expect(paradas[1].tipo).toBe("entrega");
    expect(paradas[1].sequencia).toBe(2);
  });

  it("B.2 — criacao exige ao menos retirada + 1 entrega (sem rede)", async () => {
    const r1 = await criarCotacaoFase1({
      nome_cliente: "Ana",
      telefone: "11999990000",
      carga_descricao: "encomenda",
      carga_peso: 5,
      carga_dimensoes: "",
      paradas: ["Rua A"],
      data_desejada: "2026-11-01",
      hora_desejada: "",
    });
    expect(r1.ok).toBe(false);
    expect(r1.erro).toContain("retirada e 1 entrega");
    expect(r1.dado).toBeUndefined();
  });

  it("B.3 — criacao respeita o limite de 8 paradas", async () => {
    const cheias = Array.from({ length: MAX_PARADAS_COTACAO + 1 }, (_, i) => `Rua ${i}`);
    const r = await criarCotacaoFase1({
      nome_cliente: "Ana",
      telefone: "11999990000",
      carga_descricao: "encomenda",
      carga_peso: null,
      carga_dimensoes: "",
      paradas: cheias,
      data_desejada: "",
      hora_desejada: "",
    });
    expect(MAX_PARADAS_COTACAO).toBe(8);
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("Limite de 8 paradas");
  });

  it("B.4 — leituras nunca consultam sem id (guarda de rede)", async () => {
    expect((await buscarCotacao("")).ok).toBe(false);
    expect((await buscarCotacaoPorOrcamento("")).ok).toBe(false);
    expect((await salvarDetalhesFase2("", [])).ok).toBe(false);
    expect((await vincularCotacaoAoOrcamento("", "")).ok).toBe(false);
    expect((await gerarLinkFase2EAtualizarStatus("")).ok).toBe(false);
  });

  it("B.5 — extrairCep só devolve CEP completo (8 dígitos)", () => {
    expect(extrairCep("Rua X, 123 — 05016-000")).toBe("05016-000");
    expect(extrairCep("Centro, São Paulo")).toBe("");
  });

  it("B.6 — número do orçamento no padrão ORC-YYYYMM-XXXX", () => {
    expect(gerarNumeroOrcamento()).toMatch(/^ORC-\d{6}-\d{4}$/);
  });

  it("B.7 — link da Fase 2 aponta para /cotacao-express/detalhes/:id", () => {
    expect(gerarLinkFase2("cota-0001")).toBe(
      `${window.location.origin}/cotacao-express/detalhes/cota-0001`,
    );
  });

  it("B.8 — montarOrcamentoDaCotacao gera orçamento completo e pré-preenchido", () => {
    const orc = montarOrcamentoDaCotacao(cotacaoExemplo());
    expect(orc.cliente).toBe("Maria Souza");
    expect(orc.status).toBe("em_analise");
    expect(orc.pedidoInterno).toBe("cota-0001");
    expect(orc.carga.descricao).toBe("3 caixas de documentos");
    expect(orc.carga.peso).toBe(18);
    expect(orc.enderecos).toHaveLength(2);
    expect(orc.enderecos[0].tipo).toBe("coleta");
    expect(orc.enderecos[1].tipo).toBe("entrega");
    expect(orc.enderecos[0].endereco).toContain("Rua das Flores");
    expect(orc.enderecos[1].endereco).toContain("Av. Paulista");
    expect(orc.observacoesGerais).toContain("Cotação web (Fase 1)");
    expect(orc.observacoesGerais).toContain("WhatsApp: (11) 99999-1234");
    expect(orc.numero).toMatch(/^ORC-\d{6}-\d{4}$/);
    expect(orc.historico.length).toBeGreaterThan(0);
  });

  it("B.9 — fonte grava sempre pelo id da cotação (nunca varre a tabela)", () => {
    expect(service).toContain('.eq("id", id)');
    expect(service).toContain('.eq("id", cotacaoId)');
    expect(service).toContain('status: "Pendente"');
    expect(service).toContain('"Pronto para OS"');
    expect(service).toContain('"Aguardando Detalhes"');
  });
});

describe("C) Fase 1 — /cotacao-express (4 passos, sem fricção)", () => {
  it("C.1 — coleta exatamente os campos de baixa fricção (sem número/complemento)", () => {
    const ids = [...fase1.matchAll(/id="([^"]+)"/g)].map((m) => m[1]).sort();
    expect(ids).toEqual([
      "cot-data",
      "cot-descricao",
      "cot-dimensoes",
      "cot-hora",
      "cot-nome",
      "cot-peso",
      "cot-telefone",
    ]);
  });

  it("C.2 — trajeto dinâmico com uma única referência por parada", () => {
    expect(fase1).toContain("CEP, bairro ou rua");
    expect(fase1).toContain("Adicionar parada");
    expect(fase1).toContain("MAX_PARADAS_COTACAO");
    expect(fase1).toContain("rotuloParada");
    expect(fase1).toContain("removerParada");
  });

  it("C.3 — 4 passos com barra de progresso estilo Typeform", () => {
    expect(fase1).toContain("const TOTAL_ETAPAS = 4;");
    expect(fase1).toContain("Pergunta {etapa} de {TOTAL_ETAPAS}");
    expect(fase1).toContain('style={{ width: `${progresso}%` }}');
    expect(fase1).toContain("Etapa 1 · Quem pediu");
    expect(fase1).toContain("Etapa 2 · A carga");
    expect(fase1).toContain("Etapa 3 · O trajeto");
    expect(fase1).toContain("Etapa 4 · Quando");
  });

  it("C.4 — aviso sutil da capacidade de moto (40kg)", () => {
    expect(fase1).toContain("motos transportam até");
    expect(fase1).toContain("40kg");
  });

  it("C.5 — mensagem de sucesso exata combinada com a operação", () => {
    expect(fase1).toContain("Tudo certo, ");
    expect(fase1).toContain("! 🚀");
    expect(fase1).toContain("Analisaremos a rota e enviaremos o valor no WhatsApp.");
    expect(fase1).toContain("pediremos os detalhes finais do endereço.");
  });

  it("C.6 — envia via service com status inicial 'Pendente'", () => {
    expect(fase1).toContain("criarCotacaoFase1");
    expect(fase1).toContain("nome_cliente: nome");
    expect(fase1).toContain("paradas,");
    expect(fase1).toContain("setEtapa(5)");
  });

  it("C.7 — rota pública sem sidebar/topbar do TMS", () => {
    expect(fase1).not.toContain("AppSidebar");
    expect(fase1).not.toContain("AppTopbar");
    expect(fase1).not.toContain("useAuth");
  });
});

describe("D) Fase 2 — /cotacao-express/detalhes/:id", () => {
  it("D.1 — carrega a cotação pelo id da URL", () => {
    expect(fase2).toContain("useParams");
    expect(fase2).toContain("buscarCotacao");
    expect(fase2).toContain("setConcluido(true)");
  });

  it("D.2 — pede número, complemento, contato e observações por parada", () => {
    expect(fase2).toContain('id={`num-${detalhe.sequencia}`}');
    expect(fase2).toContain('id={`comp-${detalhe.sequencia}`}');
    expect(fase2).toContain('id={`contato-${detalhe.sequencia}`}');
    expect(fase2).toContain('id={`obs-${detalhe.sequencia}`}');
    expect(fase2).toContain("Número *");
    expect(fase2).toContain("Nome de quem recebe / retira *");
    expect(fase2).toContain("Observações ou instruções");
  });

  it("D.3 — validação exige número e contato em todas as paradas", () => {
    expect(fase2).toContain("Preencha o número de todas as paradas.");
    expect(fase2).toContain("Informe o nome de quem recebe em cada parada.");
  });

  it("D.4 — salvar move a cotação para 'Pronto para OS' (idempotente)", () => {
    expect(fase2).toContain("salvarDetalhesFase2");
    expect(fase2).toContain('c.status === "Pronto para OS"');
    expect(fase2).toContain("Perfeito! Tudo pronto para a emissão da sua Ordem de Serviço.");
  });
});

describe("E) Rotas públicas no App.tsx", () => {
  it("E.1 — as 2 rotas existem como lazy fora do ProtectedRoute", () => {
    expect(app).toContain(
      'const CotacaoExpress = lazy(() => import("@/pages/CotacaoExpress"));',
    );
    expect(app).toContain(
      'const CotacaoExpressDetalhes = lazy(() => import("@/pages/CotacaoExpressDetalhes"));',
    );
    expect(app).toContain(
      '<Route path="/cotacao-express" element={<Lazy><CotacaoExpress /></Lazy>} />',
    );
    expect(app).toContain(
      '<Route path="/cotacao-express/detalhes/:id" element={<Lazy><CotacaoExpressDetalhes /></Lazy>} />',
    );
  });
});

describe("F) Alertas Realtime + integração com o Orçamento Comercial", () => {
  it("F.1 — hook assina cotacoes_publicas com canal exclusivo e cleanup", () => {
    expect(hook).toContain('channel("cotacoes-publicas-alertas")');
    expect(hook).toContain('event: "INSERT"');
    expect(hook).toContain('event: "UPDATE"');
    expect(hook).toContain('table: "cotacoes_publicas"');
    expect(hook).toContain("removeChannel");
    expect(hook).toContain("avisados.current.add");
  });

  it("F.2 — os 2 avisos têm o texto combinado com a operação", () => {
    expect(hook).toContain("🚨 Nova Cotação Web (Pré-cadastro)!");
    expect(hook).toContain("✅ Detalhes preenchidos pelo cliente!");
    expect(hook).toContain('"Pronto para OS"');
  });

  it("F.3 — AppLayout dispara os alertas e navega para o lugar certo", () => {
    expect(layout).toContain("useCotacoesPublicasRealtime");
    expect(layout).toContain("onAbrirCotacao: abrirCotacao");
    expect(layout).toContain("`/comercial?tab=orcamentos&orcamento=${orcamentoId}`");
    expect(layout).toContain("`/comercial?tab=orcamentos&action=novo&cotacao=${cotacaoId}`");
  });

  it("F.4 — lista pré-preenche o Novo Orçamento e faz o vínculo", () => {
    expect(lista).toContain("montarOrcamentoDaCotacao(res.dado)");
    expect(lista).toContain("setCotacaoVinculada(res.dado.id)");
    expect(lista).toContain(
      "vincularCotacaoAoOrcamento(cotacaoVinculada, String(idSalvo))",
    );
    expect(lista).toContain("buscarCotacaoPorOrcamento(orc.id)");
    expect(lista).toContain("marcarCotacaoAguardandoDetalhes(cotacao.dado.id)");
    expect(lista).toContain("orcamento={orcamentoSelecionado || undefined}");
    expect(lista).toContain("cotacaoId={cotacaoVinculada}");
  });

  it("F.5 — botão 'Gerar Link da Fase 2' copia o link público", () => {
    expect(form).toContain("Gerar Link da Fase 2");
    expect(form).toContain("gerarLinkFase2EAtualizarStatus");
    expect(form).toContain("navigator.clipboard.writeText(res.dado)");
    expect(form).toContain("Link da Fase 2 copiado!");
  });
});
