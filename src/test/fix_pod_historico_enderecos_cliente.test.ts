import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { gerarMensagemComprovantePOD } from "@/lib/podComprovante";
import { montarHistoricoEnderecosCliente } from "@/lib/historicoEnderecosCliente";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

describe("POD — mensagem do comprovante para o cliente final", () => {
  it("1 — gera o texto completo no padrão solicitado", () => {
    const mensagem = gerarMensagemComprovantePOD({
      osNumero: "OS-202610-123456",
      recebedor: "Maria Souza",
      documento: "123.456.789-00",
      local: "Portaria",
      dataHora: "2026-10-20T14:30:00",
      observacao: "Entregue na portaria, lacre conferido.",
    });

    expect(mensagem).toContain("✅ *ENTREGA CONCLUÍDA - CONEXÃO EXPRESS*");
    expect(mensagem).toContain("OS: OS-202610-123456");
    expect(mensagem).toContain("Recebedor: Maria Souza");
    expect(mensagem).toContain("Documento: 123.456.789-00");
    expect(mensagem).toContain("Local: Portaria");
    expect(mensagem).toContain("Data/Hora: 20/10/2026");
    expect(mensagem).toContain("14:30");
    expect(mensagem).toContain("Obs: Entregue na portaria, lacre conferido.");
    expect(mensagem).toContain("(Acesse a imagem do comprovante anexada abaixo)");
  });

  it("2 — campos opcionais vazios viram traço", () => {
    const mensagem = gerarMensagemComprovantePOD({
      osNumero: "OS-1",
      recebedor: "João",
      documento: "",
      local: "",
      dataHora: "",
      observacao: "",
    });

    expect(mensagem).toContain("Documento: —");
    expect(mensagem).toContain("Local: —");
    expect(mensagem).toContain("Data/Hora: —");
    expect(mensagem).toContain("Obs: —");
  });

  it("3 — data/hora inválida é preservada sem quebrar", () => {
    const mensagem = gerarMensagemComprovantePOD({
      osNumero: "OS-1",
      recebedor: "João",
      dataHora: "data-invalida",
    });
    expect(mensagem).toContain("Data/Hora: data-invalida");
  });
});

describe("Histórico de endereços por cliente", () => {
  it("4 — conta frequência das OSs anteriores e preserva instruções/contato", () => {
    const os = [
      {
        enderecos: [
          {
            logradouro: "Av. Sumaré",
            numero: "100",
            bairro: "Sumaré",
            cidade: "São Paulo",
            estado: "SP",
            instrucoes: "Entregar na portaria de cargas",
            contato_nome: "Carlos",
            contato_telefone: "(11) 99999-1111",
          },
        ],
      },
      {
        enderecos: [
          {
            logradouro: "AV. SUMARE",
            numero: "100",
            bairro: "Sumaré",
            cidade: "São Paulo",
            uf: "SP",
            referencia: "Falar com o almoxarifado",
          },
        ],
      },
    ];

    const resultado = montarHistoricoEnderecosCliente([], os);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].usos).toBe(2);
    expect(resultado[0].logradouro).toBe("Av. Sumaré");
    expect(resultado[0].instrucoes).toBe("Entregar na portaria de cargas");
    expect(resultado[0].contatoLocal).toBe("Carlos");
    expect(resultado[0].telefoneLocal).toBe("(11) 99999-1111");
  });

  it("5 — endereço do cadastro tem prioridade e recebe contagem de uso das OSs", () => {
    const cadastro = [
      {
        id: "end-1",
        tipo_endereco: "Matriz",
        logradouro: "Rua Teste",
        numero: "50",
        bairro: "Centro",
        cidade: "Guarulhos",
        uf: "SP",
        cep: "07000-000",
        instrucoes: "Apresentar RG",
        contato_local: "Recepção",
      },
    ];
    const os = [
      { enderecos: [{ logradouro: "Rua Teste", numero: "50" }] },
      { enderecos: [{ logradouro: "Rua Teste", numero: "50" }] },
      { enderecos: [{ logradouro: "Rua Teste", numero: "50" }] },
    ];

    const resultado = montarHistoricoEnderecosCliente(cadastro, os);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].origem).toBe("cadastro");
    expect(resultado[0].id).toBe("end-1");
    expect(resultado[0].usos).toBe(3);
    expect(resultado[0].instrucoes).toBe("Apresentar RG");
    expect(resultado[0].contatoLocal).toBe("Recepção");
  });

  it("6 — ordena pelos mais usados e mantém endereços só de OS", () => {
    const cadastro = [
      { id: "salvo", logradouro: "Rua Pouco Usada", numero: "1" },
    ];
    const os = [
      { enderecos: [{ logradouro: "Rua Muito Usada", numero: "2" }] },
      { enderecos: [{ logradouro: "Rua Muito Usada", numero: "2" }] },
      { enderecos: [{ logradouro: "Rua Pouco Usada", numero: "1" }] },
    ];

    const resultado = montarHistoricoEnderecosCliente(cadastro, os);
    expect(resultado[0].logradouro).toBe("Rua Muito Usada");
    expect(resultado[0].usos).toBe(2);
    expect(resultado[1].logradouro).toBe("Rua Pouco Usada");
    expect(resultado[1].usos).toBe(1);
    expect(resultado.some((e) => e.origem === "os")).toBe(true);
  });

  it("7 — aceita enderecos em JSON string e ignora pontos sem logradouro", () => {
    const os = [
      {
        enderecos: JSON.stringify([
          { logradouro: "Rua JSON", numero: "9", cidade: "São Paulo" },
          { numero: "10" },
        ]),
      },
    ];

    const resultado = montarHistoricoEnderecosCliente([], os);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].logradouro).toBe("Rua JSON");
  });

  it("8 — limita o histórico aos 20 endereços mais frequentes", () => {
    const os = Array.from({ length: 25 }, (_, index) => ({
      enderecos: [{ logradouro: `Rua ${index}`, numero: String(index) }],
    }));
    const resultado = montarHistoricoEnderecosCliente([], os);
    expect(resultado).toHaveLength(20);
  });
});

describe("Integração UI — OsMobile e EnderecoCompleto", () => {
  const osMobile = readSrc("src/pages/OsMobile.tsx");
  const enderecoCompleto = readSrc("src/components/ui/EnderecoCompleto.tsx");

  it("9 — input de fotos aceita galeria/câmera sem capture forçado", () => {
    expect(osMobile).toContain('accept="image/*"');
    expect(osMobile).not.toContain('capture="environment"');
    expect(osMobile).not.toContain("capture=");
  });

  it("10 — botão de copiar comprovante POD na baixa de campo", () => {
    expect(osMobile).toContain("📋 Copiar Comprovante (POD)");
    expect(osMobile).toContain("gerarMensagemComprovantePOD");
    expect(osMobile).toContain("copiarComprovantePOD");
  });

  it("11 — paradas recebem o cliente e o histórico ao selecionar endereço", () => {
    expect(osMobile).toContain("clienteId={clienteId || undefined}");
    expect(osMobile).toContain("onSelectEnderecoSalvo=");
    expect(osMobile).toContain("limparCacheHistoricoEnderecos(clienteId");
  });

  it("12 — EnderecoCompleto consulta o histórico e exibe instruções/contato", () => {
    expect(enderecoCompleto).toContain("buscarHistoricoEnderecosCliente");
    expect(enderecoCompleto).toContain("Endereços salvos e recentes do cliente");
    expect(enderecoCompleto).toContain("👤 Procurar:");
    expect(enderecoCompleto).toContain("📝");
  });
});
