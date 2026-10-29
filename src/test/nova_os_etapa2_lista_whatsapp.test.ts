// ============================================================
// ETAPA 2 — Lista de OS (filtro Hoje por data local, colunas e histórico)
// + Template 2 do WhatsApp no padrão Conexão Express.
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gerarMensagemOrientacaoExecucao, iconeVeiculo } from "@/lib/osWhatsAppMessage";

const raiz = join(__dirname, "..", "..");
const readSrc = (rel: string): string => readFileSync(join(raiz, rel), "utf8");

const listaSrc = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const previewSrc = readSrc("src/components/operacao/OrdemServicoPreview.tsx");
const historicoSrc = readSrc("src/components/operacao/HistoricoOS.tsx");

const ORIGEM = {
  sequencia: 0,
  tipo: "coleta",
  logradouro: "Rua das Flores",
  numero: "1234",
  bairro: "Vila Madalena",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01310-100",
  instrucoes: "Entrar pela doca 2",
};
const DESTINO = {
  sequencia: 1,
  tipo: "entrega",
  logradouro: "Av. Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01310-100",
  instrucoes: "Ligar ao chegar",
};

describe("A) Filtro de período — timezone (comparação por data local)", () => {
  it("A.1 existe normalização para YYYY-MM-DD sem passar pelo toISOString", () => {
    expect(listaSrc).toContain("const dataLocalISO = (d: Date): string =>");
    expect(listaSrc).toContain("getFullYear()");
    expect(listaSrc).toContain("const normalizarDataOS = (valor?: string | null): string =>");
    expect(listaSrc).toContain("const iso = texto.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);");
  });

  it("A.2 filtro Hoje compara strings de data (nunca `new Date(os.data)`)", () => {
    expect(listaSrc).toContain("const dataOSStr = normalizarDataOS(os.data);");
    expect(listaSrc).toContain("matchPeriodo = dataOSStr === hojeStr;");
    expect(listaSrc).toContain("matchPeriodo = dataOSStr === dataLocalISO(ontem);");
    expect(listaSrc).toContain("matchPeriodo = dataOSStr >= dataInicio && dataOSStr <= dataFim;");
    expect(listaSrc).not.toContain("const dataOS = new Date(os.data);");
  });

  it("A.3 safeFormatDate formata YYYY-MM-DD por string (sem deslocar o dia)", () => {
    expect(listaSrc).toContain("const iso = String(dateStr).match(/^(\\d{4})-(\\d{2})-(\\d{2})/);");
    expect(listaSrc).toContain("return `${iso[3]}/${iso[2]}/${iso[1]}`;");
  });
});

describe("B) Lista de OS — UI/UX (data, prestador, status, histórico)", () => {
  it("B.1 data de emissão abaixo do número em text-xs text-gray-500", () => {
    expect(listaSrc).toContain('className="mt-0.5 flex items-center gap-1 text-xs text-gray-500"');
    expect(listaSrc).toContain("{safeFormatDate(os.data)}");
  });

  it("B.2 tag 'Sem prestador' em bg-red-100 text-red-700", () => {
    expect(listaSrc).toContain("bg-red-100 text-red-700 border border-red-200");
    expect(listaSrc).toContain("Sem prestador");
  });

  it("B.3 dot pulsante na badge de status ativo", () => {
    expect(listaSrc).toContain('const statusAtivo = !STATUS_ENCERRADOS.includes(String(os.status)) && os.status !== "rascunho";');
    expect(listaSrc).toContain('className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse"');
  });

  it("B.4 botão de histórico na coluna Ações + Dialog rápido", () => {
    expect(listaSrc).toContain("title=\"Histórico da OS\"");
    expect(listaSrc).toContain("<History className=\"w-4 h-4\"/>");
    expect(listaSrc).toContain("<HistoricoOS historico={osHistorico?.historico} />");
    expect(listaSrc).toContain("Histórico — {osHistorico?.numero || \"OS\"}");
  });

  it("B.5 componente de histórico é compartilhado com o Preview", () => {
    expect(historicoSrc).toContain("export function HistoricoOS");
    expect(historicoSrc).toContain("export interface HistoricoOSItem");
    expect(previewSrc).toContain('import { HistoricoOS, type HistoricoOSItem } from "./HistoricoOS";');
    expect(previewSrc).toContain("<HistoricoOS historico={os.historico as HistoricoOSItem[] | undefined} />");
  });
});

describe("C) Template 2 — WhatsApp padrão Conexão Express", () => {
  const msg = gerarMensagemOrientacaoExecucao({
    numero: "OS-202610-998877",
    veiculoTipo: "VUC",
    custoPrestador: 250,
    formaPagamento: "fatura",
    distanciaKm: 18.3,
    observacoesGerais: "Não subir no dock antes das 8h",
    enderecos: [ORIGEM, DESTINO],
  });

  it("C.1 cabeçalho com asteriscos e saudação ao Parceiro", () => {
    expect(msg.split("\n")[0]).toBe("🟠 *CONEXÃO ⚡ EXPRESS* 🟣");
    expect(msg).toContain("Olá, Parceiro! Você foi selecionado para executar esta OS.");
    expect(msg).not.toContain("Olá, Motorista!");
  });

  it("C.2 rota com asteriscos e km formatado", () => {
    expect(msg).toContain("*Vila Madalena ━➤ Bela Vista* | *18,3 km*");
  });

  it("C.3 pontos RET/ENT com emoji, asteriscos e bullet", () => {
    expect(msg).toContain("🟣 *【 1 】 RET* • Rua das Flores, 1234 - Vila Madalena, São Paulo/SP - 01310-100");
    expect(msg).toContain("🟠 *【 2 】 ENT* • Av. Paulista, 1000 - Bela Vista, São Paulo/SP - 01310-100");
  });

  it("C.4 alerta padronizado antes das observações", () => {
    expect(msg).toContain("⚠️ *ATENÇÃO:* Entrar pela doca 2");
    expect(msg).toContain("⚠️ *ATENÇÃO:* Ligar ao chegar");
    expect(msg).toContain("⚠️ *ATENÇÃO:* Não subir no dock antes das 8h");
  });

  it("C.5 ícone dinâmico do veículo (Moto/Carro/VUC)", () => {
    expect(iconeVeiculo({ veiculoTipo: "Moto" })).toBe("🏍️");
    expect(iconeVeiculo({ veiculoTipo: "Carro de Passeio" })).toBe("🚗");
    expect(iconeVeiculo({ veiculoTipo: "VUC" })).toBe("🚚");
    expect(iconeVeiculo({ veiculoTipo: "Truck" })).toBe("🚚");
    expect(msg).toContain("🚚 *VEÍCULO:* VUC");
  });
});
