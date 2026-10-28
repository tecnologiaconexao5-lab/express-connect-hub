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
  aprovarCotacao,
  MAX_PARADAS_COTACAO,
  STATUS_PENDENTE,
  STATUS_AGUARDANDO_APROVACAO,
  STATUS_AGUARDANDO_DETALHES,
  type CotacaoPublica,
} from "@/services/cotacoes/cotacaoPublicaService";
import {
  valorLocalCotacao,
  veiculoSugeridoCotacao,
  candidatosVeiculo,
  formatarBrl,
} from "@/services/cotacoes/cotacaoCalculoService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

// ============================================================================
// MISSÃO COTACAO-EXPRESS — fluxo público de cotação em 2 fases:
// A) Migration cotacoes_publicas (RLS anônimo + Realtime)
// A2) Migration V2 de precificação (status de aprovação + metadata)
// B) Service (guardas, mapeamentos, pré-preenchimento do orçamento)
// C) Fase 1 — /cotacao-express (wizard + resumo + aprovação → Fase 2)
// D) Fase 2 — /cotacao-express/detalhes/:id (endereços completos)
// E) Rotas públicas no App.tsx
// F) Alertas Realtime na Torre de Controle + integração comercial
// G) Cálculo de rota + preço (motor da Fase 1)
// H) Motor premium de indicação de veículo + SLA (peso + cubagem)
// ============================================================================

const migration = readSrc("supabase/migrations/20261024000000_cotacoes_publicas.sql");
const migrationV2 = readSrc(
  "supabase/migrations/20261025000000_cotacoes_precificacao_fase1.sql",
);
const fase1 = readSrc("src/pages/CotacaoExpress.tsx");
const fase2 = readSrc("src/pages/CotacaoExpressDetalhes.tsx");
const app = readSrc("src/App.tsx");
const hook = readSrc("src/hooks/useCotacoesPublicasRealtime.ts");
const layout = readSrc("src/components/AppLayout.tsx");
const lista = readSrc("src/components/comercial/OrcamentosLista.tsx");
const form = readSrc("src/components/comercial/OrcamentoForm.tsx");
const service = readSrc("src/services/cotacoes/cotacaoPublicaService.ts");
const calculo = readSrc("src/services/cotacoes/cotacaoCalculoService.ts");
const veiculoCotacaoSrc = readSrc("src/lib/veiculoCotacao.ts");
const campoEnderecoSrc = readSrc("src/components/cotacao/CampoEnderecoChat.tsx");

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

describe("A2) Migration V2 — preço na Fase 1 (status de aprovação + metadata)", () => {
  it("A2.1 — CHECK de status agora aceita os 4 valores do fluxo", () => {
    expect(migrationV2).toContain("cotacoes_publicas_status_check");
    expect(migrationV2).toContain(STATUS_PENDENTE);
    expect(migrationV2).toContain(STATUS_AGUARDANDO_APROVACAO);
    expect(migrationV2).toContain(STATUS_AGUARDANDO_DETALHES);
    expect(migrationV2).toContain("'Pronto para OS'");
    expect(migrationV2).toContain("CHECK (status IN (");
  });

  it("A2.2 — guarda a precificação em metadata jsonb + índice GIN", () => {
    expect(migrationV2).toContain(
      "ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
    );
    expect(migrationV2).toContain("idx_cotacoes_publicas_metadata");
    expect(migrationV2).toContain("USING GIN (metadata)");
  });

  it("A2.3 — é idempotente e recarrega o PostgREST", () => {
    expect(migrationV2).toContain("DROP CONSTRAINT");
    expect(migrationV2).toContain("ADD CONSTRAINT cotacoes_publicas_status_check");
    expect(migrationV2).toContain("NOTIFY pgrst, 'reload schema'");
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
    expect(service).toContain(`export const STATUS_PENDENTE = "${STATUS_PENDENTE}"`);
    expect(service).toContain(
      `export const STATUS_AGUARDANDO_APROVACAO = "${STATUS_AGUARDANDO_APROVACAO}"`,
    );
    expect(service).toContain(
      `export const STATUS_AGUARDANDO_DETALHES = "${STATUS_AGUARDANDO_DETALHES}"`,
    );
    expect(service).toContain('"Pronto para OS"');
    expect(service).toContain("export async function aprovarCotacao");
  });
});

describe("C) Fase 1 PREMIUM — /cotacao-express (wizard + veículo + resumo)", () => {
  it("C.1 — coleta exatamente os campos de baixa fricção (sem número/complemento)", () => {
    const ids = [...fase1.matchAll(/id="([^"]+)"/g)].map((m) => m[1]).sort();
    expect(ids).toEqual([
      "cot-altura",
      "cot-data",
      "cot-descricao",
      "cot-hora",
      "cot-largura",
      "cot-nome",
      "cot-peso",
      "cot-profundidade",
      "cot-telefone",
    ]);
  });

  it("C.2 — wizard minimalista: 1 etapa por vez, autocomplete e loop de paradas", () => {
    // Wizard minimalista: uma etapa por vez com animação (framer-motion)
    expect(fase1).toContain('from "framer-motion"');
    expect(fase1).toContain("AnimatePresence");
    // Autocomplete de endereço (Mapbox) compartilhado
    expect(fase1).toContain("CampoEnderecoChat");
    // Uma referência por parada + loop até o limite
    expect(fase1).toContain("CEP, bairro ou rua");
    expect(fase1).toContain("Outro ponto");
    expect(fase1).toContain("MAX_PARADAS_COTACAO");
    expect(fase1).toContain("rotuloParada");
    expect(fase1).toContain("removerUltimaParada");
    // Perguntas (uma por etapa) — carga em 3 perguntas separadas
    for (const titulo of [
      "Como posso te chamar?",
      "O que transportar",
      "Peso da carga",
      "Dimensões da carga",
      "A retirada",
      "A entrega",
      "Pontos extras",
    ]) {
      expect(fase1).toContain(`titulo="${titulo}"`);
    }
    // Perguntas exatas da carga
    expect(fase1).toContain("O que você precisa transportar? *");
    expect(fase1).toContain("Qual o peso estimado (em kg)? *");
    expect(fase1).toContain("Quais as dimensões da mercadoria? (Altura, Largura e Profundidade)");
    expect(fase1).toContain("Não sei as dimensões");
  });

  it("C.3 — sem indicadores de sistema: sem barra de progresso, sem contador de perguntas, sem rótulo de etapa", () => {
    // UX premium: a tela NÃO exibe nada de "Pergunta X de Y" / % / "Etapa · ..."
    expect(fase1).not.toContain("TOTAL_ETAPAS");
    expect(fase1).not.toContain("Pergunta {etapa} de");
    expect(fase1).not.toContain("rotuloProgresso");
    expect(fase1).not.toContain('style={{ width: `${progresso}%` }}');
    expect(fase1).not.toContain("Etapa · ");
    // Saudação humana + pergunta direta na etapa 1
    expect(fase1).toContain("Olá! Que bom ter você aqui");
    expect(fase1).toContain('titulo="Como posso te chamar?"');
  });

  it("C.4 — motor indica veículo com SLA (sem aviso genérico de 40kg)", () => {
    // Usa o motor premium (peso + cubagem → veículo + SLA)
    expect(fase1).toContain("analisarCargaCotacao");
    expect(fase1).toContain("recomendacao.mensagemBot");
    expect(fase1).toContain("CardVeiculoIndicado");
    expect(fase1).toContain("slaRotulo");
    // Frases combinadas com a operação (fonte: veiculoCotacao.ts)
    expect(veiculoCotacaoSrc).toContain(
      "Conforme peso e dimensões da sua mercadoria, o veículo indicado é: Moto. Este veículo você já consegue pedir de imediato.",
    );
    expect(veiculoCotacaoSrc).toContain(
      "Para este veículo, você precisa agendar com ao menos 24 horas de antecedência.",
    );
    // O aviso genérico de 40kg foi REMOVIDO do fluxo
    expect(fase1).not.toContain("motos transportam até");
    expect(fase1).not.toContain("Acima disso,");
  });

  it("C.5 — resumo com valor em destaque + botão verde que segue direto para a Fase 2", () => {
    // Frase combinada com a operação
    expect(fase1).toContain("Prontinho, ");
    expect(fase1).toContain("! O valor do seu frete fica em ");
    expect(fase1).toContain("formatarBrl(preco.valor)");
    // Resumo da cotação (carga + veículo + valor)
    expect(fase1).toContain('titulo="Resumo da Cotação"');
    expect(fase1).toContain("Proposta instantânea");
    expect(fase1).toContain("formatarBrl(precificacao.valor)");
    // Chip de SLA no resumo
    expect(fase1).toContain("recomendacao.slaRotulo");
    // Botão verde EXATO
    expect(fase1).toContain("Aprovar Frete");
    expect(fase1).toContain("bg-emerald-600");
    // Aprovação → Fase 2 (mesmo fluxo do link comercial "Gerar Link da Fase 2")
    expect(fase1).toContain("navigate(`/cotacao-express/detalhes/${id}`)");
    expect(fase1).toContain("Aprovação registrada");
  });

  it("C.6 — grava já com preço e aprova pelo service (sem varrer a tabela)", () => {
    expect(fase1).toContain("criarCotacaoFase1");
    expect(fase1).toContain("nome_cliente: nome");
    expect(fase1).toContain("paradas,");
    expect(fase1).toContain("STATUS_AGUARDANDO_APROVACAO");
    expect(fase1).toContain("precificacao: preco");
    expect(fase1).toContain("aprovarCotacao(id, {");
    expect(fase1).toContain("valor: precificacao.valor");
    // Etapas do fluxo: cálculo (8) → resumo (9) → Fase 2 via navigate
    expect(fase1).toContain("setEtapa(8)");
    expect(fase1).toContain("setEtapa(9)");
    expect(fase1).not.toContain("setEtapa(10)");
    // O formulário final (número/complemento) é da Fase 2 — sem duplicar
    expect(fase1).not.toContain("salvarDetalhesFase2");
    // Dimensões viram texto canônico para a coluna carga_dimensoes
    expect(fase1).toContain("carga_dimensoes: dimensoesTexto");
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

  it("F.2 — os 3 avisos têm o texto combinado com a operação", () => {
    expect(hook).toContain("🚨 Nova Cotação Web (Pré-cadastro)!");
    expect(hook).toContain("💰 Cotação aprovada pelo cliente!");
    expect(hook).toContain("✅ Detalhes preenchidos pelo cliente!");
    expect(hook).toContain('"Pronto para OS"');
    expect(hook).toContain(STATUS_AGUARDANDO_APROVACAO);
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

describe("G) Motor de cálculo da Fase 1 — rota + preço", () => {
  it("G.1 — usa a edge oficial `estimar` com timeout e cai para a tabela local", () => {
    expect(calculo).toContain('action: "estimar"');
    expect(calculo).toContain("supabase.functions.invoke");
    expect(calculo).toContain("AbortController");
    expect(calculo).toContain("TIMEOUT_PRECIFICACAO_MS");
    expect(calculo).toContain("valorLocalCotacao");
    expect(calculo).toContain("TABELA_TESTE_VEICULOS_SP");
  });

  it("G.2 — fórmula local idêntica à da edge (base + km excedente + 10% por parada)", () => {
    expect(calculo).toContain("base + max(0, km - franquia) × excedente + base × 10% × paradasExtras");

    // moto 10 km / 1 parada → faixa até 10 km = R$ 35,00 e nada de excedente
    const moto10 = valorLocalCotacao({ tipoVeiculo: "moto", distanciaKm: 10, paradas: 1 });
    expect(moto10?.valor).toBe(35);
    expect(moto10?.formula).toEqual({
      valorBase: 35,
      franquiaKm: 10,
      kmExcedente: 0,
      valorKmExcedente: 2.5,
      acrescimoParadasExtras: 0,
    });

    // moto 25 km / 3 paradas → 55 + (5 × 2,50) + (55 × 10% × 2) = 78,50
    const moto25 = valorLocalCotacao({ tipoVeiculo: "moto", distanciaKm: 25, paradas: 3 });
    expect(moto25?.valor).toBe(78.5);
    expect(moto25?.fonte).toBe("tabela_local");
  });

  it("G.3 — alias de veículo mapeia para a tabela real e veículo sugerido por peso", () => {
    expect(valorLocalCotacao({ tipoVeiculo: "passeio", distanciaKm: 6, paradas: 1 })?.valor).toBe(45);
    expect(valorLocalCotacao({ tipoVeiculo: "kombi", distanciaKm: 10, paradas: 1 })?.valor).toBe(120);
    expect(valorLocalCotacao({ tipoVeiculo: "sem-tabela-abc", distanciaKm: 10, paradas: 1 })).toBeNull();

    expect(veiculoSugeridoCotacao(10)?.tipo).toBe("moto");
    expect(veiculoSugeridoCotacao(90)?.tipo).toBe("passeio");
    expect(veiculoSugeridoCotacao(null)?.tipo).toBe("passeio");
    expect(veiculoSugeridoCotacao(3000)?.tipo).toBe("truck");

    expect(candidatosVeiculo("passeio")).toEqual(["passeio", "carro"]);
    expect(candidatosVeiculo("")).toEqual([]);
  });

  it("G.4 — a página encadeia rota + preço (com veículo do motor de carga) e formata em BRL", () => {
    // A chamada passa o veículo indicado pelo analisarCargaCotacao (3º argumento)
    expect(fase1).toContain("const resultado = await calcularRotaEFreteCotacao(");
    expect(fase1).toContain("recomendacao?.tipo ?? null");
    expect(calculo).toContain("tipoVeiculoForcado?: string | null");
    expect(fase1).toContain("MENSAGEM_CALCULO");
    expect(fase1).toContain("MENSAGEM_ERRO_CALCULO");
    expect(formatarBrl(78.5)).toMatch(/R\$\s?78,50/);
  });
});

// ============================================================================
// H) Motor premium de indicação de veículo + SLA (peso + cubagem)
// ============================================================================
describe("H) Motor de indicação de veículo + SLA (analisarCargaCotacao)", () => {
  const importar = () => import("@/lib/veiculoCotacao");

  it("H.1 — carga leve na moto → 'imediato' com a frase exata da operação", async () => {
    const { analisarCargaCotacao } = await importar();
    const r = analisarCargaCotacao({ pesoKg: 12, alturaCm: 40, larguraCm: 40, profundidadeCm: 40 });
    expect(r.tipo).toBe("moto");
    expect(r.cabeMoto).toBe(true);
    expect(r.agendamentoHoras).toBe(0);
    expect(r.slaRotulo).toBe("Atendimento imediato");
    expect(r.litros).toBe(64);
    expect(r.mensagemBot).toBe(
      "Conforme peso e dimensões da sua mercadoria, o veículo indicado é: Moto. Este veículo você já consegue pedir de imediato.",
    );
  });

  it("H.2 — acima de 40kg → veículo maior com SLA de 24h (frase exata)", async () => {
    const { analisarCargaCotacao } = await importar();
    const r = analisarCargaCotacao({ pesoKg: 80, alturaCm: null, larguraCm: null, profundidadeCm: null });
    expect(r.tipo).toBe("passeio");
    expect(r.cabeMoto).toBe(false);
    expect(r.agendamentoHoras).toBe(24);
    expect(r.slaRotulo).toBe("Agende com 24h de antecedência");
    expect(r.mensagemBot).toBe(
      "Conforme peso e dimensões da sua mercadoria, o veículo indicado é: Veículo de Passeio. Para este veículo, você precisa agendar com ao menos 24 horas de antecedência.",
    );
  });

  it("H.3 — cubagem grande derruba a moto mesmo com peso leve (30kg/1000L → Fiorino)", async () => {
    const { analisarCargaCotacao } = await importar();
    const r = analisarCargaCotacao({ pesoKg: 30, alturaCm: 100, larguraCm: 100, profundidadeCm: 100 });
    expect(r.litros).toBe(1000);
    expect(r.tipo).toBe("fiorino");
    expect(r.cabeMoto).toBe(false);
  });

  it("H.4 — cubagem acima de 160L → Fiorino direto (regra do baú)", async () => {
    const { analisarCargaCotacao } = await importar();
    const r = analisarCargaCotacao({ pesoKg: 20, alturaCm: 80, larguraCm: 60, profundidadeCm: 50 });
    expect(r.litros).toBe(240);
    expect(r.tipo).toBe("fiorino");
    expect(r.cabeMoto).toBe(false);
  });

  it("H.5 — peso acima de 2.500kg → Caminhão (truck) com SLA de 24h", async () => {
    const { analisarCargaCotacao } = await importar();
    const r = analisarCargaCotacao({ pesoKg: 3000, alturaCm: null, larguraCm: null, profundidadeCm: null });
    expect(r.tipo).toBe("truck");
    expect(r.nome).toBe("Caminhão");
    expect(r.cabeMoto).toBe(false);
    expect(r.agendamentoHoras).toBe(24);
  });

  it("H.6 — sem peso informado → passeio (não inventa moto)", async () => {
    const { analisarCargaCotacao } = await importar();
    const r = analisarCargaCotacao({ pesoKg: null, alturaCm: null, larguraCm: null, profundidadeCm: null });
    expect(r.tipo).toBe("passeio");
    expect(r.cabeMoto).toBe(false);
    expect(r.litros).toBeNull();
  });

  it("H.7 — a página usa o motor premium e não repete o aviso genérico de 40kg", async () => {
    const { analisarCargaCotacao } = await importar();
    const moto = analisarCargaCotacao({ pesoKg: 35, alturaCm: null, larguraCm: null, profundidadeCm: null });
    const maior = analisarCargaCotacao({ pesoKg: 45, alturaCm: null, larguraCm: null, profundidadeCm: null });
    expect(moto.mensagemBot).toContain("Moto");
    expect(maior.mensagemBot).toContain("Veículo de Passeio");
    expect(maior.mensagemBot).toContain("24 horas de antecedência");
    // Nunca a frase genérica antiga
    expect(maior.mensagemBot).not.toContain("40kg");
    expect(maior.mensagemBot).not.toContain("Acima disso");
  });
});

// ============================================================================
// I) ViaCEP — busca automática de endereço no modo manual do CampoEnderecoChat
// ============================================================================

describe("I) ViaCEP — auto-busca de CEP no modo manual", () => {
  it("I.1 — consulta a API do ViaCEP com o CEP limpo (8 dígitos)", () => {
    expect(campoEnderecoSrc).toContain("https://viacep.com.br/ws/");
    expect(campoEnderecoSrc).toContain("/json/");
    // Só dispara com 8 dígitos (ignora traço)
    expect(campoEnderecoSrc).toContain("somenteDigitos(manual.cep)");
    expect(campoEnderecoSrc).toContain("digitos.length < 8");
  });

  it("I.2 — mostra indicador visual de carregamento ('Buscando endereço...')", () => {
    expect(campoEnderecoSrc).toContain("Buscando endereço...");
    expect(campoEnderecoSrc).toContain('cepStatus === "buscando"');
  });

  it("I.3 — preenche Rua (logradouro), Bairro e Cidade-UF vindos do ViaCEP", () => {
    expect(campoEnderecoSrc).toContain("json.logradouro");
    expect(campoEnderecoSrc).toContain("json.bairro");
    expect(campoEnderecoSrc).toContain("json.localidade");
    expect(campoEnderecoSrc).toContain("json.uf");
  });

  it("I.4 — erro do ViaCEP mostra mensagem amigável + toast e mantém campos abertos", () => {
    expect(campoEnderecoSrc).toContain(
      "CEP não encontrado. Por favor, preencha o endereço manualmente.",
    );
    expect(campoEnderecoSrc).toContain("toast.error");
    // Mensagem de falha de rede/timeout também amigável
    expect(campoEnderecoSrc).toContain(
      "Não conseguimos consultar o CEP agora. Preencha o endereço manualmente.",
    );
  });

  it("I.5 — sem loops infinitos: guarda por CEP já buscado + AbortController + descarte por sequência", () => {
    // Não rebusca o mesmo CEP
    expect(campoEnderecoSrc).toContain("cepUltimoBuscadoRef.current = digitos");
    expect(campoEnderecoSrc).toContain("if (digitos === cepUltimoBuscadoRef.current) return");
    // Cancela requisição anterior ao desmontar/alterar
    expect(campoEnderecoSrc).toContain("AbortController");
    expect(campoEnderecoSrc).toContain("controle.abort()");
    // Descarta resposta obsoleta
    expect(campoEnderecoSrc).toContain("cepSequenciaRef");
  });

  it("I.6 — foco avança para o campo de Rua (não existe 'Número' nesta etapa)", () => {
    expect(campoEnderecoSrc).toContain("ruaManualRef");
    expect(campoEnderecoSrc).toContain("ruaManualRef.current?.focus()");
  });

  it("I.7 — CEP pré-carregado pela sugestão Mapbox não dispara ViaCEP ao abrir o manual", () => {
    expect(campoEnderecoSrc).toContain("cepUltimoBuscadoRef.current = somenteDigitos(sugestao.cep");
  });
});
