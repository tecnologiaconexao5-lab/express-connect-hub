// ============================================================
// CORREÇÃO CIRÚRGICA 5 — POD completo (coleta/chegada), fuso
// America/Sao_Paulo, ícones literais no WhatsApp e busca parcial de OS.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  formatarDataBR,
  formatarDataHoraBR,
  formatarDataHoraSolicitacaoBR,
  formatarHoraBR,
  parseDataHoraSP,
} from "@/lib/formatDates";
import { parseStorageRef } from "@/services/comprovantes/podMediaService";
import {
  montarMensagemConfirmacaoCotacao,
  linkConfirmacaoWhatsApp,
} from "@/lib/cotacaoWhatsApp";
import type { CotacaoPublica } from "@/services/cotacoes/cotacaoPublicaService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const lista = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const comprovantesService = readSrc("src/services/comprovantes/comprovantesService.ts");
const portalClienteService = readSrc("src/services/portalCliente/portalClienteService.ts");
const entregasComprovantes = readSrc("src/components/comprovantes/EntregasComprovantes.tsx");
const dossie = readSrc("src/components/comprovantes/DossieEntregaSheet.tsx");
const historico = readSrc("src/components/operacao/HistoricoOS.tsx");
const whatsappLib = readSrc("src/lib/cotacaoWhatsApp.ts");

describe("1) POD completo — foto_coleta e foto_chegada (App → TMS)", () => {
  it("1.1 buscarEntregasDaOS lê metadata.app_motorista e resolve as 2 mídias", () => {
    expect(comprovantesService).toContain("metadata, created_at");
    expect(comprovantesService).toContain(".app_motorista");
    expect(comprovantesService).toContain("foto_chegada_url");
    expect(comprovantesService).toContain("foto_coleta_url");
    expect(comprovantesService).toContain("resolverMidiaPod(rawChegada)");
    expect(comprovantesService).toContain("resolverMidiaPod(rawColeta)");
  });

  it("1.2 montarEntregaOS devolve as evidências de coleta", () => {
    expect(comprovantesService).toContain("foto_chegada_url: raw.foto_chegada_url || null");
    expect(comprovantesService).toContain("foto_coleta_url: raw.foto_coleta_url || null");
  });

  it("1.3 busca do Dossiê expõe e assina as mídias da alocação", () => {
    expect(portalClienteService).toContain("fotoChegadaRaw");
    expect(portalClienteService).toContain("fotoColetaRaw");
    expect(portalClienteService).toContain("foto_chegada_url: fotoChegadaRaw");
    expect(portalClienteService).toContain("foto_coleta_url: fotoColetaRaw");
    expect(portalClienteService).toContain("resolverMidiaPod(alocacao.foto_chegada_url)");
    expect(portalClienteService).toContain("resolverMidiaPod(alocacao.foto_coleta_url)");
  });

  it("1.4 modal Comprovantes da Entrega renderiza as 2 novas fotos", () => {
    expect(entregasComprovantes).toContain('label: "Foto da coleta"');
    expect(entregasComprovantes).toContain('label: "Foto de chegada"');
    expect(entregasComprovantes).toContain("entrega.foto_chegada_url");
    expect(entregasComprovantes).toContain("entrega.foto_coleta_url");
  });

  it("1.5 Dossiê inclui coleta/chegada na galeria de evidências", () => {
    expect(dossie).toContain("aloc?.foto_coleta_url");
    expect(dossie).toContain("aloc?.foto_chegada_url");
    expect(dossie).toContain("Foto da Coleta");
    expect(dossie).toContain("Foto de Chegada (Coleta)");
  });

  it("1.6 caminho relativo do App é resolvido no bucket privado driver-evidence", () => {
    const ref = parseStorageRef("uid-123/loading/op-1/2026/11/09/foto.jpg");
    expect(ref).toEqual({
      bucket: "driver-evidence",
      path: "uid-123/loading/op-1/2026/11/09/foto.jpg",
      external: false,
      raw: "uid-123/loading/op-1/2026/11/09/foto.jpg",
    });
  });
});

describe("2) Fuso America/Sao_Paulo (UTC-3)", () => {
  it("2.1 timestamp sem fuso já está em São Paulo (não desloca)", () => {
    expect(formatarDataHoraBR("2026-11-09 21:13:40")).toBe("09/11/2026, 21:13");
    expect(formatarHoraBR("2026-11-09 21:13:40")).toBe("21:13");
  });

  it("2.2 timestamp UTC é convertido para UTC-3", () => {
    expect(formatarDataHoraBR("2026-11-09T23:50:17Z")).toBe("09/11/2026, 20:50");
    expect(formatarHoraBR("2026-11-09T23:50:17Z")).toBe("20:50");
  });

  it("2.3 data pura não desloca o dia", () => {
    expect(formatarDataBR("2026-11-09")).toBe("09/11/2026");
    expect(formatarHoraBR("2026-11-09")).toBe("12:00");
    expect(parseDataHoraSP("2026-11-09")).not.toBeNull();
  });

  it("2.4 frase da solicitação continua no padrão da operação", () => {
    expect(formatarDataHoraSolicitacaoBR("2026-11-01T17:30:00Z")).toBe("01/11/2026 às 14h30");
  });

  it("2.5 timeline/histórico usam os helpers com fuso (sem toLocaleString do navegador)", () => {
    expect(historico).toContain("formatarDataHoraBR");
    expect(historico).not.toContain('.toLocaleString("pt-BR")');

    expect(dossie).toContain("formatarDataHoraBR");
    expect(dossie).toContain("formatarHoraBR");
    expect(dossie).not.toContain(".toLocaleTimeString(");

    expect(entregasComprovantes).toContain("formatarDataBR");
    expect(entregasComprovantes).toContain("formatarHoraBR");
    expect(entregasComprovantes).not.toContain(".toLocaleTimeString(");
  });
});

const cotacao: CotacaoPublica = {
  id: "cot-5",
  status: "Pronto para OS",
  nome_cliente: "Maria Silva",
  telefone: "(11) 98888-7777",
  carga_descricao: "Caixas",
  carga_peso: 12,
  carga_dimensoes: "40x40x40 cm",
  carga_volumes: null,
  paradas: [
    { sequencia: 1, tipo: "retirada", endereco: "Rua A, 100 - São Paulo/SP" },
    { sequencia: 2, tipo: "entrega", endereco: "Rua B, 200 - Campinas/SP" },
  ],
  data_desejada: "2026-11-15",
  hora_desejada: "09:00 às 11:00",
  detalhes: [],
  orcamento_id: null,
  valor_aprovado: 1234.5,
  metadata: {
    precificacao: {
      valor: 1234.5,
      moeda: "BRL",
      distancia_km: 98.4,
      duracao_min: 120,
      tipo_veiculo: "fiorino",
      rotulo_veiculo: "Fiorino",
      paradas: 2,
      fonte: "tabela_local",
      tabela: "Tabela padrão SP",
      formula: {
        valorBase: 200,
        franquiaKm: 10,
        kmExcedente: 88.4,
        valorKmExcedente: 10,
        acrescimoParadasExtras: 20,
      },
      aviso: "Valor estimado",
      calculado_em: "2026-11-09T12:00:00Z",
    },
  },
};

describe("3) WhatsApp da cotação — ícones literais e texto limpo", () => {
  it("3.1 mantém negritos e os emojis corretos", () => {
    const msg = montarMensagemConfirmacaoCotacao(cotacao);
    expect(msg).toContain("👤 *Nome:* Maria Silva");
    expect(msg).toContain("📞 *Telefone:* (11) 98888-7777");
    expect(msg).toContain("🚚 *Veículo:* Fiorino");
    expect(msg).toContain("💰 *Valor:* R$ 1.234,50");
    expect(msg).toContain("📅 *Data:* 15/11/2026");
    expect(msg).toContain("⏰ *Horário:* Das 09:00 às 11:00");
    expect(msg).toContain("📍 *Coleta:* Rua A, 100 - São Paulo/SP");
    expect(msg).toContain("🏁 *Entrega:* Rua B, 200 - Campinas/SP");
    expect(msg).not.toContain("\uFFFD");
  });

  it("3.2 remove caracteres corrompidos vindos do banco", () => {
    const msg = montarMensagemConfirmacaoCotacao({
      ...cotacao,
      nome_cliente: "Maria \uFFFD Silva",
      telefone: "(11) 98888-7777\uFFFD",
    });
    expect(msg).toContain("👤 *Nome:* Maria Silva");
    expect(msg).not.toContain("\uFFFD");
  });

  it("3.3 fonte usa escapes Unicode explícitos (ASCII-safe)", () => {
    expect(whatsappLib).toContain("\\u{1F464}");
    expect(whatsappLib).toContain("\\u{1F4DE}");
    expect(whatsappLib).toContain("\\u{1F69A}");
    expect(whatsappLib).toContain("\\uFFFD");
    expect(whatsappLib).toContain("limparTexto");
  });

  it("3.4 link wa.me codifica a mensagem", () => {
    const link = linkConfirmacaoWhatsApp(cotacao, "5511913254847");
    expect(link).toContain("https://wa.me/5511913254847?text=");
    expect(link).toContain(encodeURIComponent(montarMensagemConfirmacaoCotacao(cotacao)));
  });
});

describe("4) Busca parcial de OS ('1202' → OS-202611-1202)", () => {
  it("4.1 extrai os dígitos e aplica ilike no número completo", () => {
    expect(lista).toContain("const termoNumeros = termoBusca.replace(/\\D/g, \"\")");
    expect(lista).toContain("numero.ilike.%${termoNumeros}%");
    expect(lista).toContain("numero.ilike.%${termoBusca}%");
  });

  it("4.2 busca é aplicada na QUERY, antes do range/paginação", () => {
    const idxBusca = lista.indexOf("query = query.or(orParts.join");
    const idxRange = lista.indexOf(".range(from, to)");
    expect(idxBusca).toBeGreaterThan(-1);
    expect(idxRange).toBeGreaterThan(idxBusca);
  });
});
