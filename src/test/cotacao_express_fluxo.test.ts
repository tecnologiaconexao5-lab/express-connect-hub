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
import { cepCompleto8, limparCepParcialDoTexto } from "@/lib/cepCotacao";

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
// I) ViaCEP — busca automática de CEP no modo manual
// J) CEP parcial do Mapbox — validação estrita de 8 dígitos + busca reversa
// K) UX avançada — Voltar passo a passo, layout responsivo, proximity SP,
//    tipos de parada + Adicionar Retorno e Salvar PDF / Imprimir
// L) Interceptador de CEP no autocomplete — CEP 8 dígitos → ViaCEP direto
//    (sem Mapbox), sugestão oficial dos Correios no dropdown
// ============================================================================

const migration = readSrc("supabase/migrations/20261024000000_cotacoes_publicas.sql");
const migrationV2 = readSrc(
  "supabase/migrations/20261025000000_cotacoes_precificacao_fase1.sql",
);
const migrationJanela = readSrc(
  "supabase/migrations/20261031000000_cotacao_janela_horario_os.sql",
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

  it("C.5 — resumo com valor em destaque + botão laranja (paleta da marca) que segue direto para a Fase 2", () => {
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
    // Botão de ação EXATO na paleta laranja da marca
    expect(fase1).toContain("Aprovar Frete");
    expect(fase1).toContain("bg-orange-500");
    // Marcação antiga (verde/Sparkles) totalmente removida do wizard
    expect(fase1).not.toContain("emerald");
    expect(fase1).not.toContain("Sparkles");
    // Logo maior no cabeçalho e no card do Resumo
    expect(fase1).toContain("h-12 w-auto");
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
    expect(fase2).toContain("Quem recebe / retira *");
    expect(fase2).toContain("Observações");
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

// ============================================================================
// J) CEP parcial do Mapbox — validação estrita de 8 dígitos + busca reversa
//     O Mapbox devolve `postcode` parcial (ex.: "06473") para ruas BR:
//     nunca aceitar/salvar/exibir CEP < 8 dígitos; resgatar via ViaCEP
//     reverso (UF + cidade + logradouro); senão deixar o CEP vazio.
// ============================================================================

describe("J) CEP parcial do Mapbox — estrito de 8 dígitos + busca reversa", () => {
  const cepCotacao = readSrc("src/lib/cepCotacao.ts");

  it("J.1 — cepCompleto8 só aceita exatamente 8 dígitos (parcial vira vazio)", () => {
    expect(cepCompleto8("05016-000")).toBe("05016-000");
    expect(cepCompleto8("05016000")).toBe("05016-000");
    expect(cepCompleto8("06473")).toBe(""); // CEP parcial de 5 dígitos do Mapbox
    expect(cepCompleto8("064730")).toBe(""); // 6 dígitos
    expect(cepCompleto8("0647300")).toBe(""); // 7 dígitos
    expect(cepCompleto8("")).toBe("");
    expect(cepCompleto8("abc")).toBe("");
    expect(cepCotacao).toContain("d.length === 8");
  });

  it("J.2 — limpa o CEP parcial do place_name sem rasgar números de porta", () => {
    expect(limparCepParcialDoTexto("Avenida Sumaré, São Paulo - SP, 06473", "06473")).toBe(
      "Avenida Sumaré, São Paulo - SP",
    );
    expect(limparCepParcialDoTexto("06473, Rua das Flores, Campinas - SP", "06473")).toBe(
      "Rua das Flores, Campinas - SP",
    );
    // Parcial diferente do número presente → texto intacto
    expect(limparCepParcialDoTexto("Rua 10, 12345 - Centro", "06473")).toBe(
      "Rua 10, 12345 - Centro",
    );
    // Parcial curto demais/não-CEP não dispara limpeza
    expect(limparCepParcialDoTexto("Rua 123, Centro", "12")).toBe("Rua 123, Centro");
  });

  it("J.3 — busca reversa no ViaCEP (UF/cidade/logradouro) com prioridade do prefixo parcial", () => {
    expect(campoEnderecoSrc).toContain("consultarViaCepPorEndereco");
    // Endpoint reverso: /ws/{uf}/{cidade}/{logradouro}/json/
    expect(campoEnderecoSrc).toContain(
      "https://viacep.com.br/ws/${encodeURIComponent(uf.trim().toUpperCase())}",
    );
    expect(campoEnderecoSrc).toContain(
      "/${encodeURIComponent(cidade.trim())}/${encodeURIComponent(logradouro.trim())}/json/",
    );
    // Só resgata CEP de 8 dígitos e prioriza o match do prefixo parcial
    expect(campoEnderecoSrc).toContain("c.length === 8");
    expect(campoEnderecoSrc).toContain("startsWith(prefixoParcial)");
    expect(campoEnderecoSrc).toContain("if (!Array.isArray(dados)) return null");
    // Dispara quando o CEP é parcial/ausente E há rua + cidade + UF
    expect(campoEnderecoSrc).toContain("!cepValido && temBaseReversa");
    expect(campoEnderecoSrc).toContain(
      "item.rua?.trim() && item.cidade?.trim() && item.uf?.trim()",
    );
  });

  it("J.4 — CEP parcial nunca é aceito/salvo/exibido (só 8 dígitos ou vazio)", () => {
    // Resultado final estrito: cep vem só de cepFinal ("" quando parcial)
    expect(campoEnderecoSrc).toContain(
      "let cepFinal = cepValido ? formatarCep(digitosOriginais) : \"\""
    );
    expect(campoEnderecoSrc).toContain("cep: cepFinal");
    // Endereço manual salvo só com CEP de 8 dígitos
    expect(campoEnderecoSrc).toContain("cepCompleto8(c.cep)");
    // Card "Endereço reconhecido" nunca exibe parcial
    expect(campoEnderecoSrc).toContain('valor={cepCompleto8(enderecoConfirmado.cep || "")}');
    // Modo manual não pré-carrega CEP parcial da sugestão
    expect(campoEnderecoSrc).toContain('cep: cepCompleto8(sugestao.cep || "")');
    // place_name reconstruído/limpo sem o CEP parcial
    expect(campoEnderecoSrc).toContain("limparCepParcialDoTexto(item.place_name || \"\"");
  });
});

// ============================================================================
// K) UX avançada — 5 melhorias do wizard /cotacao-express:
//    K.1 Voltar passo a passo (setEtapa prev - 1, preserva dados)
//    K.2 Layout responsivo centralizado (max-w-2xl + shadow/rounded no desktop)
//    K.3 Autocomplete Mapbox com proximity São Paulo
//    K.4 Tipos de parada (Retirada / Entrega / Retirada e Entrega) + Retorno
//    K.5 "Salvar PDF / Imprimir" no resumo (window.print + print:hidden)
// ============================================================================

describe("K) UX avançada — Voltar, layout, proximity, tipos de parada e imprimir", () => {
  const mapboxProviderSrc = readSrc("src/services/maps/mapboxProvider.ts");

  it("K.1 — Voltar avança 1 etapa por vez (Math.max(1, e - 1)) preservando os dados", () => {
    expect(fase1).toContain("Math.max(1, e - 1)");
    // O clamp antigo (etapa mínima 5) foi removido
    expect(fase1).not.toContain("Math.max(5, e - 1)");
    // Só fica desabilitado na primeira etapa (nada anterior a ela)
    expect(fase1).toContain("disabled={etapa <= 1}");
    expect(fase1).not.toContain("disabled={etapa <= 5}");
  });

  it("K.2 — layout centralizado responsivo (max-w-2xl, sombra/cantos no desktop)", () => {
    // Container do wizard e da barra inferior compartilham a mesma largura máxima
    expect(fase1).toContain("max-w-2xl");
    expect(fase1).not.toContain("max-w-xl");
    // Desktop ganha cantos corporativos + sombra; mobile segue full-width
    expect(fase1).toContain("sm:rounded-xl");
    expect(fase1).toContain("sm:shadow-lg");
  });

  it("K.3 — autocomplete Mapbox usa proximity=-46.6333,-23.5505 (São Paulo)", () => {
    expect(mapboxProviderSrc).toContain("proximity=-46.6333,-23.5505");
    // Dentro da função de sugestões usada pelo CampoEnderecoChat
    const urlLine = mapboxProviderSrc.indexOf("buscarSugestoesEnderecos");
    const proximityLine = mapboxProviderSrc.indexOf("proximity=-46.6333,-23.5505");
    expect(urlLine).toBeGreaterThan(0);
    expect(proximityLine).toBeGreaterThan(urlLine);
  });

  it("K.4 — 3 tipos de parada + Adicionar Retorno clona a origem como entrega", () => {
    // Tipos na UI (toggle da última parada) e rótulos legíveis
    expect(fase1).toContain("retirada_entrega");
    expect(fase1).toContain("Retirada e Entrega");
    expect(fase1).toContain("ROTULO_TIPO_PARADA");
    expect(fase1).toContain("rotuloParada");
    // Botão Adicionar Retorno (etapas 6 e 7) com clone do Ponto 1
    expect(fase1).toContain("Adicionar Retorno");
    expect(fase1).toContain("adicionarRetorno");
    expect(fase1).toContain('tipo: "entrega", retorno: true');
    // Service aceita o novo tipo no pass-through
    expect(service).toContain('"retirada" | "entrega" | "retirada_entrega"');
    // Pass-through preserva os tipos informados (incl. retirada_entrega)
    const comTipo = montarParadasFase1(
      ["Origem, 10", "Destino, 20", "Origem, 10"],
      ["retirada", "entrega", "retirada_entrega"],
    );
    expect(comTipo.map((p) => p.tipo)).toEqual(["retirada", "entrega", "retirada_entrega"]);
    // Contrato legado B.1 intacto: sem tipos → 1ª retirada, demais entrega
    const legado = montarParadasFase1(["Rua A", "Rua B"]);
    expect(legado.map((p) => p.tipo)).toEqual(["retirada", "entrega"]);
  });

  it("K.5 — resumo gera proposta comercial em PDF com layout de impressão limpo", () => {
    expect(fase1).toContain("salvarPropostaPdf");
    expect(fase1).toContain("gerarPropostaCotacaoPDF");
    expect(fase1).toContain("Salvar PDF / Imprimir");
    expect(fase1).toContain("Printer");
    // Botões/chrome somem no papel; cabeçalho colorido só aparece na impressão
    expect(fase1).toContain("print:hidden");
    expect(fase1).toContain("print:block");
    expect(fase1).toContain("logo-conexao-colorido.png");
    // Logo da impressão ampliado (print:h-20)
    expect(fase1).toContain("print:h-20");
    expect(fase1).toContain("Proposta de Cotação — Conexão Express");
  });
});

describe("L) Interceptador de CEP no autocomplete — ViaCEP direto, sem Mapbox", () => {
  it("L.1 — regex de CEP válido (ehCepValido) casa 8 dígitos com/s sem traço", () => {
    // Detecção de CEP no termo digitado
    expect(campoEnderecoSrc).toContain("const ehCepValido");
    expect(campoEnderecoSrc).toContain("/^\\d{5}-?\\d{3}$/");
    // Fonte: a função usa a regex no .test do texto digitado
    const fnStart = campoEnderecoSrc.indexOf("const ehCepValido");
    const fnEnd = campoEnderecoSrc.indexOf("function", fnStart + 10);
    const trecho = campoEnderecoSrc.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 200);
    expect(trecho).toContain(".test(texto.trim())");
  });

  it("L.2 — CEP válido INTERROMPE o Mapbox e chama ViaCEP direto (consultarViaCepJson)", () => {
    // Guarda: só entra no interceptor quando o termo é um CEP de 8 dígitos
    expect(campoEnderecoSrc).toContain("if (ehCepValido(termo))");
    // Requisição direta ao ViaCEP por dígitos (sem hífen), reutilizando o wrapper existente
    expect(campoEnderecoSrc).toContain("await consultarViaCepJson(digitos)");
    // O Mapbox (buscarSugestoesEnderecos) NÃO é chamado quando é CEP válido:
    // a chamada Mapbox fica DEPOIS do return do interceptor (fluxo normal)
    const interceptorIdx = campoEnderecoSrc.indexOf("if (ehCepValido(termo))");
    const mapboxIdx = campoEnderecoSrc.indexOf("await buscarSugestoesEnderecos(termo)");
    expect(interceptorIdx).toBeGreaterThan(0);
    expect(mapboxIdx).toBeGreaterThan(interceptorIdx);
    // O interceptor tem return antes da chamada Mapbox
    const trechoInterceptador = campoEnderecoSrc.slice(interceptorIdx, mapboxIdx);
    expect(trechoInterceptador).toContain("return;");
  });

  it("L.3 — montarSugestaoViaCep monta SugestaoEndereco com CEP estrito e lat/lng NaN", () => {
    expect(campoEnderecoSrc).toContain("function montarSugestaoViaCep");
    // CEP sempre via cepCompleto8 (8 dígitos estritos)
    expect(campoEnderecoSrc).toContain("const cep = cepCompleto8(json.cep || \"\")");
    // place_name composto: rua, bairro, cidade - UF, CEP
    const fnStart = campoEnderecoSrc.indexOf("function montarSugestaoViaCep");
    const trecho = campoEnderecoSrc.slice(fnStart, fnStart + 700);
    expect(trecho).toContain("const placeName = [rua, bairro, cidadeUf, cep].filter(Boolean).join(\", \")");
    // lat/lng NaN — cálculo de rota geocoda por texto (Mapbox só em background)
    expect(trecho).toContain("lat: Number.NaN");
    expect(trecho).toContain("lng: Number.NaN");
    // Sugestão 100% ViaCEP: rua/bairro/cidade/uf/cep preenchidos dos Correios
    expect(trecho).toContain("const rua = json.logradouro || \"\"");
    expect(trecho).toContain("const cidade = json.localidade || \"\"");
    expect(trecho).toContain("const uf = json.uf || \"\"");
  });

  it("L.4 — sucesso ViaCEP → sugestão única no dropdown; falha → dropdown fechado", () => {
    // Sucesso (json truthy): injeta a sugestão ViaCEP e abre o dropdown
    expect(campoEnderecoSrc).toContain("setSugestoes([montarSugestaoViaCep(json)])");
    expect(campoEnderecoSrc).toContain("setAberto(true)");
    // Falha (json null): sem sugestão falsa, dropdown fechado
    expect(campoEnderecoSrc).toContain("setSugestoes([])");
    expect(campoEnderecoSrc).toContain("setAberto(false)");
    // Guarda de respostas velhas preservada (sequenciaRef) antes de setar estado
    const interceptIdx = campoEnderecoSrc.indexOf("if (ehCepValido(termo))");
    const guardIdx = campoEnderecoSrc.indexOf("if (meu !== sequenciaRef.current) return;", interceptIdx);
    const setIdx = campoEnderecoSrc.indexOf("setSugestoes([montarSugestaoViaCep(json)])", interceptIdx);
    expect(guardIdx).toBeGreaterThan(interceptIdx);
    expect(setIdx).toBeGreaterThan(guardIdx);
  });
});

// ============================================================================
// M) Cotação Express UX — margem de tempo, agendamento obrigatório com
//    janela de horário, layout compacto da Fase 2 e fundo de conclusão
// ============================================================================
describe("M) Cotação Express UX — tempo, janela e layout", () => {
  it("M.1 — tempo exibido embute +30 min para todos os veículos", () => {
    expect(fase1).toContain("MARGEM_OPERACIONAL_MINUTOS = 30");
    expect(fase1).toContain("rota.duracaoMin + MARGEM_OPERACIONAL_MINUTOS");
  });

  it("M.2 — data e janela de horário são obrigatórias (aprovação bloqueada)", () => {
    expect(fase1).toContain("Quando precisa? *");
    expect(fase1).toContain("Janela de horário *");
    expect(fase1).toContain("const validarAgendamento");
    expect(fase1).toContain("const problemaAgendamento = validarAgendamento();");
    expect(fase1).toContain("JANELAS_HORARIO");
    expect(fase1).toContain('id="cot-hora"');
  });

  it("M.3 — RPC propaga a janela para carga e endereços da OS", () => {
    expect(migrationJanela).toContain("v_janela_inicio");
    expect(migrationJanela).toContain("v_janela_fim");
    expect(migrationJanela).toContain("'janela_inicio', v_janela_inicio");
    expect(migrationJanela).toContain("'janelaInicio', v_janela_inicio");
    expect(migrationJanela).toContain("'agendamento', v_tem_agendamento");
  });

  it("M.4 — Fase 2 compacta (grid em colunas) e fundo padrão na conclusão", () => {
    expect(fase2).toContain("grid grid-cols-2 gap-2 md:grid-cols-4");
    expect(fase2).toContain("mx-auto w-full max-w-2xl space-y-3");
    expect(fase2).not.toContain("Parceria logistica.png");
  });
});
