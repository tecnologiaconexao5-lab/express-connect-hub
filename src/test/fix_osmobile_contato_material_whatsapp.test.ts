import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { gerarMensagemOrientacaoExecucao } from "@/lib/osWhatsAppMessage";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const ORIGEM = {
  sequencia: 0,
  tipo: "retirada",
  logradouro: "Rua das Flores",
  numero: "1234",
  bairro: "Vila Madalena",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01310-100",
  nomeContato: "João Porteiro",
  telefoneContato: "(11) 98888-7777",
  material: "2 caixas de documentos",
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
  nome_contato: "Maria Recepção",
  telefone_contato: "(11) 97777-6666",
  material: "1 envelope lacrado",
};

describe("WhatsApp — contato e material reais da operação", () => {
  it("1 — PROCURAR/TELEFONE/MATERIAL usam os campos da parada", () => {
    const msg = gerarMensagemOrientacaoExecucao({
      numero: "OS-202610-112233",
      veiculoTipo: "Moto",
      nomeMotorista: "Carlos Motoboy",
      enderecos: [ORIGEM, DESTINO],
    });

    expect(msg).toContain("Olá, Carlos Motoboy! Você foi selecionado para executar esta OS.");
    expect(msg).toContain("👤 PROCURAR: João Porteiro");
    expect(msg).toContain("📞 TELEFONE: (11) 98888-7777");
    expect(msg).toContain("📦 RETIRAR: 2 caixas de documentos");
    expect(msg).toContain("👤 PROCURAR: Maria Recepção");
    expect(msg).toContain("📞 TELEFONE: (11) 97777-6666");
    expect(msg).toContain("📦 ENTREGAR: 1 envelope lacrado");
  });

  it("2 — saudação cai para 'Motorista' quando não há nome", () => {
    const msg = gerarMensagemOrientacaoExecucao({
      numero: "OS-1",
      enderecos: [ORIGEM, DESTINO],
    });
    expect(msg).toContain("Olá, Motorista! Você foi selecionado para executar esta OS.");
  });

  it("3 — material vazio mantém fallback para volumes", () => {
    const msg = gerarMensagemOrientacaoExecucao({
      numero: "OS-2",
      volumes: 3,
      enderecos: [
        { ...ORIGEM, material: "" },
        { ...DESTINO, material: "" },
      ],
    });
    expect(msg).toContain("📦 RETIRAR: 3");
    expect(msg).toContain("📦 ENTREGAR: 3");
  });
});

describe("OsMobile — formulário de parada e nome do motorista", () => {
  const src = readSrc("src/pages/OsMobile.tsx");

  it("4 — ParadaForm declara nomeContato, telefoneContato e material", () => {
    expect(src).toMatch(/interface ParadaForm\s*\{/);
    expect(src).toContain("nomeContato: string;");
    expect(src).toContain("telefoneContato: string;");
    expect(src).toContain("material: string;");
  });

  it("5 — campos são inicializados vazios no criarParada", () => {
    const bloco = src.slice(src.indexOf("const criarParada"), src.indexOf("const statusBadge"));
    expect(bloco).toContain('nomeContato: ""');
    expect(bloco).toContain('telefoneContato: ""');
    expect(bloco).toContain('material: ""');
  });

  it("6 — UI expõe os campos ao operador", () => {
    expect(src).toContain("Procurar por (contato no local)");
    expect(src).toContain("Telefone do contato");
    expect(src).toContain("O que entregar (material)");
    expect(src).toContain("O que retirar (material)");
  });

  it("7 — endereços persistidos levam contato/material para o jsonb da OS", () => {
    expect(src).toContain("nome_contato: p.nomeContato");
    expect(src).toContain("telefone_contato: p.telefoneContato");
    expect(src).toContain("material: p.material");
  });

  it("8 — nomeMotorista alimenta a saudação e é resetado no limpar", () => {
    expect(src).toContain("const [nomeMotorista, setNomeMotorista] = useState(\"\")");
    expect(src).toContain("setNomeMotorista(value ? nome : \"\")");
    expect(src).toContain("setNomeMotorista(\"\")");
    expect(src).toContain("prestadorNome: nomeMotorista.trim()");
    expect(src).toContain("Olá, {nomeMotorista.trim()");
  });

  it("9 — template local do mobile usa verbo por tipo e campo material", () => {
    const bloco = src.slice(
      src.indexOf("const gerarOrientacaoWhatsApp"),
      src.indexOf("// Shell mobile"),
    );
    expect(bloco).toContain('tipo === "ENTREGA" ? "ENTREGAR"');
    expect(bloco).toContain("ponto.material");
    expect(bloco).toContain("`📦 ${verboMaterial}: ${material}`");
    expect(bloco).not.toContain("📦 RETIRAR: ${instrucoes}");
  });
});
