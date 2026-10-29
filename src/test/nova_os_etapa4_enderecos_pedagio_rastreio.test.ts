// ============================================================
// ETAPA 4 — Endereços salvos do cliente, pedágio detalhado,
// rastreio por WhatsApp no ponto e payload operacional do App.
// Testes baseados em fonte (padrão do repo).
// ============================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "..", "..");
const readSrc = (rel: string): string => readFileSync(join(raiz, rel), "utf8");

const formSrc = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const osTypesSrc = readSrc("src/components/operacao/osTypes.ts");
const enderecoSrc = readSrc("src/components/ui/EnderecoCompleto.tsx");
const favoritosSrc = readSrc("src/components/enderecos/EnderecosFavoritos.tsx");
const mapperSrc = readSrc("src/lib/dbMappers.ts");
const listaSrc = readSrc("src/components/operacao/OrdensServicoLista.tsx");

describe("A) Endereços salvos/favoritos do cliente", () => {
  it("A.1 lista os endereços salvos do cliente e abre ao focar no CEP", () => {
    expect(enderecoSrc).toContain("Endereços salvos do cliente");
    expect(enderecoSrc).toContain("onFocus={() => { if (enderecosSalvosFiltrados.length > 0) setShowSuggestions(true); }}");
    expect(enderecoSrc).toContain(".sort((a, b) => (Number(b.usos) || 0) - (Number(a.usos) || 0))");
    expect(enderecoSrc).toContain("handleSelectEnderecoSalvo(salvo)");
  });

  it("A.2 salvar favorito persiste para o cliente (com fallback sem cliente)", () => {
    expect(favoritosSrc).toContain("salvarEnderecoFavoritoCliente");
    expect(favoritosSrc).toContain("clienteId?: string");
    expect(favoritosSrc).toContain("Selecione um cliente para vincular à base");
    expect(formSrc).toContain("<SaveFavoritoButton");
    expect(formSrc).toContain("clienteId={clienteIdEfetivo || undefined}");
  });
});

describe("B) Pedágio detalhado por praça", () => {
  it("B.1 tipo carga.pedagios + estado/expansão do detalhamento", () => {
    expect(osTypesSrc).toContain("pedagios?: { praca: string; valor: number }[]");
    expect(formSrc).toContain("const [mostrarPedagiosDetalhe, setMostrarPedagiosDetalhe] = useState(false);");
    expect(formSrc).toContain("const pedagiosDetalhe = data.carga?.pedagios || [];");
    expect(formSrc).toContain("const updatePedagios = (lista: { praca: string; valor: number }[])");
  });

  it("B.2 lista praças, total em destaque e total manual continua livre", () => {
    expect(formSrc).toContain("Detalhar pedágios");
    expect(formSrc).toContain("Adicionar praça");
    expect(formSrc).toContain("Usar total das praças");
    expect(formSrc).toContain("O valor total acima permanece livre para edição manual.");
    // o input manual do total continua existindo/refletindo em data.pedagio
    expect(formSrc).toContain('update("pedagio", Number(e.target.value));');
  });
});

describe("C) Chave de notificação de rastreio por WhatsApp", () => {
  it("C.1 flag notificarWhatsApp no ponto + toggle no formulário", () => {
    expect(osTypesSrc).toContain("notificarWhatsApp?: boolean");
    expect(formSrc).toContain("notificarWhatsApp: false");
    expect(formSrc).toContain("🔔 Enviar Rastreio por WhatsApp");
    expect(formSrc).toContain("Atualizações em tempo real e \"Saiu para entrega\"");
    expect(formSrc).toContain("t[idx].notificarWhatsApp = v;");
  });
});

describe("D) Payload do App do Motorista (dados operacionais do local)", () => {
  it("D.1 toOSInsert mapeia os campos operacionais e o flag de rastreio", () => {
    expect(mapperSrc).toContain("notificarWhatsApp: e.notificarWhatsApp || false");
    expect(mapperSrc).toContain("notificar_whatsapp: e.notificarWhatsApp || false");
    expect(mapperSrc).toContain("portaria: e.portaria || \"\"");
    expect(mapperSrc).toContain("doca: e.doca || \"\"");
    expect(mapperSrc).toContain("procedimentoEntrada: e.procedimentoEntrada || \"\"");
    expect(mapperSrc).toContain("estacionamento: e.estacionamento || \"\"");
    expect(mapperSrc).toContain("documentoNecessario: e.documentoNecessario || \"\"");
    expect(mapperSrc).toContain("codigoAcesso: e.codigoAcesso || \"\"");
    expect(mapperSrc).toContain("contatoNome: e.contatoNome || e.contato || \"\"");
    expect(mapperSrc).toContain("contatoTelefone: e.contatoTelefone || \"\"");
    expect(mapperSrc).toContain("outrasRestricoes: e.outrasRestricoes || \"\"");
  });

  it("D.2 edição pela lista preserva o itinerário salvo", () => {
    expect(listaSrc).toContain("enderecos: Array.isArray(item.enderecos) ? item.enderecos : []");
  });
});
