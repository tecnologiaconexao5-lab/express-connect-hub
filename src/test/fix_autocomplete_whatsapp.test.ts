import { describe, it, expect, vi, afterEach } from "vitest";

// ============================================================================
// FIX-AUTOCOMPLETE-E-NOVO-TEMPLATE-WHATSAPP
// 1) Template ÚNICO do motoboy: privacidade (sem número da porta), ícone
//    dinâmico por veículo, links curtos do Maps e mesmo gerador no desktop
//    e no /os-mobile (formatos de dados camelCase e snake_case).
// 2) Autocomplete: complementação de CEP/Bairro/Cidade/UF na seleção de
//    sugestão (parsing do place_name + reverse geocoding).
// ============================================================================

import {
  gerarMensagemWhatsAppMotoboy,
  gerarMensagemOSGrupo,
  gerarMensagemOrientacaoExecucao,
  gerarMensagemWhatsAppClienteRastreio,
} from "@/lib/osWhatsAppMessage";
import {
  extrairDadosDePlaceName,
  extrairDadosDaSuggestion,
  complementarDadosEndereco,
  consultarViaCep,
  cepCompleto,
  type MapboxSuggestion,
} from "@/services/maps/mapboxAutocomplete";

// ------------------------------ dados desktop (OS form) --------------------
const OS_DESKTOP = {
  numero: "OS-202610-998877",
  veiculoTipo: "Moto",
  custoPrestador: 77.5,
  formaPagamento: "faturado",
  distanciaKm: 12.5,
  observacoesGerais: "Encaixe às 14h após a 1ª retirada",
  enderecos: [
    {
      sequencia: 1,
      tipo: "coleta",
      logradouro: "Rua das Flores",
      numero: "1234",
      bairro: "Vila Madalena",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01310-100",
      janelaInicio: "09:00",
      janelaFim: "10:00",
    },
    {
      sequencia: 2,
      tipo: "entrega",
      logradouro: "Av. Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01310-100",
      janelaInicio: "14:00",
      janelaFim: "15:00",
    },
  ],
};

// ------------------------------ dados /os-mobile (snake_case) ---------------
const OS_MOBILE = {
  veiculoTipo: "Moto",
  custoPrestador: 25,
  formaPagamento: "avista",
  distanciaKm: 10,
  observacoes: "Retirar na portaria B",
  enderecos: [
    {
      sequencia: 0,
      tipo: "coleta",
      logradouro: "Rua Alegre",
      numero: "777",
      bairro: "Centro",
      cidade: "Guarulhos",
      estado: "SP",
      cep: "07010000",
      janela_inicio: "08:00",
      janela_fim: "09:00",
    },
    {
      sequencia: 1,
      tipo: "entrega",
      logradouro: "Rua do Campo",
      numero: "888",
      bairro: "Jardim Paulista",
      cidade: "São Paulo",
      estado: "SP",
      cep: "02000000",
      janela_inicio: "",
      janela_fim: "11:00",
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Template 1 — Resumo da Rota (padrão obrigatório)", () => {
  const msg = gerarMensagemWhatsAppMotoboy(OS_DESKTOP);
  const linhas = msg.split("\n");

  it("segue o padrão exato linha a linha", () => {
    expect(linhas[0]).toBe("🟠 *CONEXÃO ⚡ EXPRESS* 🟣");
    expect(linhas[1]).toBe("━━━━━━━━━━━━━━━━━🏍️");
    expect(linhas[2]).toBe("");
    expect(linhas[3]).toBe("Vila Madalena ━➤ Bela Vista | 12,5 km");
    expect(linhas[4]).toBe("");
    expect(linhas[5]).toBe("🟣 【 1 】 RET • Rua das Flores - CEP: 01310-100");
    expect(linhas[6]).toBe("⏰ 09:00–10:00");
    expect(linhas[7]).toBe("🗺️ https://maps.google.com/?q=Rua+das+Flores+São+Paulo");
    expect(linhas[8]).toBe("");
    expect(linhas[9]).toBe("🟠 【 2 】 ENT • Av. Paulista - CEP: 01310-100");
    expect(linhas[10]).toBe("⏰ 14:00–15:00");
    expect(linhas[11]).toBe("🗺️ https://maps.google.com/?q=Av.+Paulista+São+Paulo");
    expect(linhas[12]).toBe("");
    expect(linhas[13]).toBe("━━━━━━━━━━━━━━━━━");
    expect(linhas[14]).toBe("💰 R$ 77,50 | A faturar");
    expect(linhas[15]).toBe("");
    expect(linhas[16]).toBe("⚠️ ATENÇÃO: Encaixe às 14h após a 1ª retirada");
  });

  it("PRIVACIDADE: nunca exibe o número da porta/local", () => {
    expect(msg).not.toContain("1234"); // nº da coleta
    expect(msg).not.toContain("1000"); // nº da entrega
    expect(msg).not.toContain("Rua das Flores, 1234");
    expect(msg).not.toContain("Av. Paulista, 1000");
    // links também são montados SEM número
    expect(msg).not.toMatch(/maps\.google\.com\/\?q=[^\n]*1234/);
  });

  it("usa link curto no formato https://maps.google.com/?q=Rua+Cidade", () => {
    expect(msg).toContain("https://maps.google.com/?q=");
    expect(msg).not.toContain("www.google.com/maps");
    expect(msg).not.toContain("google.com/maps/search");
    const links = linhas.filter((l) => l.startsWith("🗺️ "));
    expect(links).toHaveLength(2);
    links.forEach((l) => {
      const url = l.replace(/^🗺️ /, "");
      expect(url).toMatch(/^https:\/\/maps\.google\.com\/\?q=\S+\+\S+/);
      expect(url).not.toContain(" ");
    });
  });
});

describe("Template WhatsApp — ícones dinâmicos por veículo", () => {
  it.each([
    ["Moto", "🏍️"],
    ["MOTO", "🏍️"],
    ["motocicleta", "🏍️"],
    ["Carro", "🚗"],
    ["Passeio", "🚗"],
    ["CARRO", "🚗"],
    ["Van", "🚚"],
    ["VUC", "🚚"],
    ["Kombi", "🚚"],
    ["", "🚚"],
  ])("%s → %s", (veiculo, icone) => {
    const primeira = gerarMensagemWhatsAppMotoboy({
      ...OS_DESKTOP,
      veiculoTipo: veiculo,
    }).split("\n")[1];
    expect(primeira).toBe(`━━━━━━━━━━━━━━━━━${icone}`);
  });
});

describe("Template WhatsApp — pagamento e formas de exibição", () => {
  it.each([
    ["faturado", "A faturar"],
    ["avista", "À vista"],
    ["avista_mesmo_dia", "À vista mesmo dia"],
  ])("%s → %s", (forma, esperado) => {
    const linha = gerarMensagemWhatsAppMotoboy({
      ...OS_DESKTOP,
      formaPagamento: forma,
    })
      .split("\n")
      .find((l) => l.startsWith("💰"));
    expect(linha).toBe(`💰 R$ 77,50 | ${esperado}`);
  });
});

describe("Template WhatsApp — MESMO gerador no /os-mobile (snake_case)", () => {
  const msg = gerarMensagemWhatsAppMotoboy(OS_MOBILE);
  const linhas = msg.split("\n");

  it("preenche rota, janelas e CEP a partir do jsonb enderecos do mobile", () => {
    expect(linhas[1]).toBe("━━━━━━━━━━━━━━━━━🏍️");
    expect(linhas[3]).toBe("Centro ━➤ Jardim Paulista | 10 km");
    expect(linhas[5]).toBe("🟣 【 1 】 RET • Rua Alegre - CEP: 07010-000");
    expect(linhas[6]).toBe("⏰ 08:00–09:00");
    expect(linhas[9]).toBe("🟠 【 2 】 ENT • Rua do Campo - CEP: 02000-000");
    expect(linhas[10]).toBe("⏰ 11:00"); // só janela fim
    expect(linhas[14]).toBe("💰 R$ 25,00 | À vista");
    expect(linhas[16]).toBe("⚠️ ATENÇÃO: Retirar na portaria B");
  });

  it("PRIVACIDADE também no mobile: sem números 777/888", () => {
    expect(msg).not.toContain("777");
    expect(msg).not.toContain("888");
  });

  it("MODELO 1 (grupo) aponta para o MESMO resumo da rota", () => {
    const viaGrupo = gerarMensagemOSGrupo(OS_DESKTOP);
    const viaCanonical = gerarMensagemWhatsAppMotoboy(OS_DESKTOP);
    expect(viaGrupo).toBe(viaCanonical);
  });
});

// ============================================================================
// TEMPLATE 2 — Orientação de Execução (OS completa) + Cliente (rastreio)
// ============================================================================
describe("Template 2 — Orientação de Execução (OS completa)", () => {
  const ORIGEM = {
    sequencia: 0,
    tipo: "coleta",
    logradouro: "Rua das Flores",
    numero: "1234",
    bairro: "Vila Madalena",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01310-100",
    janela_inicio: "09:00",
    janela_fim: "10:00",
    contato: "João Portaria",
    telefone: "(11) 90000-0000",
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
    janela_inicio: "14:00",
    janela_fim: "15:00",
    contato: "Maria Recepção",
    telefone: "(11) 91111-1111",
    instrucoes: "Ligar ao chegar",
  };

  const msg = gerarMensagemOrientacaoExecucao({
    numero: "OS-202610-998877",
    veiculoTipo: "Moto",
    prestadorNome: "Carlos Motoboy",
    custoPrestador: 77.5,
    formaPagamento: "faturado",
    volumes: 3,
    distanciaKm: 12.5,
    enderecos: [ORIGEM, DESTINO],
  });
  const linhas = msg.split("\n");

  it("cabeçalho, OS e saudação ao motoboy", () => {
    expect(linhas[0]).toBe("🟠 CONEXÃO ⚡ EXPRESS 🟣");
    expect(linhas[1]).toBe("📋 ORIENTAÇÃO DE EXECUÇÃO");
    expect(linhas[2]).toBe("OS nº OS-202610-998877");
    expect(linhas[4]).toBe("Olá, Carlos Motoboy! Você foi selecionado para executar esta OS.");
  });

  it("bloco financeiro (veículo/valor/pagamento)", () => {
    expect(msg).toContain("🏍️ VEÍCULO: Moto");
    expect(msg).toContain("💰 VALOR: R$ 77,50");
    expect(msg).toContain("💳 PAGAMENTO: A faturar");
  });

  it("blocos RETIRADA e ENTREGA com endereço COMPLETO (com número)", () => {
    expect(msg).toContain("🟣 【 1 】 RETIRADA");
    expect(msg).toContain("🟠 【 2 】 ENTREGA");
    expect(msg).toContain("📍 ENDEREÇO: Rua das Flores, 1234 - Vila Madalena, São Paulo/SP - 01310-100");
    expect(msg).toContain("📍 ENDEREÇO: Av. Paulista, 1000 - Bela Vista, São Paulo/SP - 01310-100");
    expect(msg).toContain("👤 PROCURAR: João Portaria");
    expect(msg).toContain("📞 TELEFONE: (11) 90000-0000");
    expect(msg).toContain("📦 RETIRAR: 3");
    expect(msg).toContain("⚠️ ORIENTAÇÕES: Entrar pela doca 2");
    expect(msg).toContain("📦 ENTREGAR: 3");
  });

  it("blocos de comprovação e conduta profissional + assinatura final", () => {
    expect(msg).toContain("📸 COMPROVAÇÃO");
    expect(msg).toContain("Enviar o comprovante de entrega pelo WhatsApp após a conclusão.");
    expect(msg).toContain("🤝 CONDUTA PROFISSIONAL");
    expect(linhas[linhas.length - 1]).toBe("🟠 CONEXÃO ⚡ EXPRESS 🟣");
  });

  it("é DIFERENTE do Template 1 (Resumo da Rota)", () => {
    expect(msg).not.toBe(gerarMensagemWhatsAppMotoboy(OS_DESKTOP));
  });
});

describe("WhatsApp Cliente (Rastreio)", () => {
  it("gera o texto com o link, substituindo [ID_DA_OS]", () => {
    const msg = gerarMensagemWhatsAppClienteRastreio({ numeroOS: "OS-202610-998877" });
    expect(msg).toBe(
      "Olá! 📦 Sua encomenda pela *Conexão Express* está a caminho. " +
        "Acompanhe o status em tempo real através do link: " +
        "https://tms.conexaoexpress.com.br/rastreio/OS-202610-998877",
    );
  });

  it("usa o osId quando não há número", () => {
    const msg = gerarMensagemWhatsAppClienteRastreio({ osId: "abc-123" });
    expect(msg).toContain("https://tms.conexaoexpress.com.br/rastreio/abc-123");
  });
});

describe("Autocomplete — extrairDadosDePlaceName (fallback 1)", () => {
  it("extrai CEP, bairro, cidade e UF do place_name do Mapbox", () => {
    const dados = extrairDadosDePlaceName(
      "Rua das Flores, Vila Madalena, São Paulo, SP 01310-100, Brasil",
      "Rua das Flores"
    );
    expect(dados).toEqual({
      cep: "01310-100",
      bairro: "Vila Madalena",
      cidade: "São Paulo",
      estado: "SP",
    });
  });

  it("funciona sem CEP no place_name", () => {
    const dados = extrairDadosDePlaceName(
      "Av. Rebouças, Pinheiros, São Paulo, SP, Brasil",
      "Av. Rebouças"
    );
    expect(dados.estado).toBe("SP");
    expect(dados.cidade).toBe("São Paulo");
    expect(dados.bairro).toBe("Pinheiros");
    expect(dados.cep).toBeUndefined();
  });
});

describe("Autocomplete — complementarDadosEndereco (select da sugestão)", () => {
  const suggestion = (extra: Partial<MapboxSuggestion>): MapboxSuggestion => ({
    id: "place.1",
    place_name: "Rua das Flores, Vila Madalena, São Paulo, SP 01310-100, Brasil",
    place_type: ["address"],
    text: "Rua das Flores",
    ...extra,
  });

  it("não faz nada quando os 4 campos já estão preenchidos", async () => {
    const patch = await complementarDadosEndereco(
      { cep: "01310-100", bairro: "Centro", cidade: "São Paulo", estado: "SP" },
      suggestion({})
    );
    expect(patch).toEqual({});
  });

  it("preenche os campos que faltam a partir do place_name (sem rede)", async () => {
    const patch = await complementarDadosEndereco(
      { cep: "", bairro: "", cidade: "", estado: "" },
      suggestion({})
    );
    expect(patch.cep).toBe("01310-100");
    expect(patch.bairro).toBe("Vila Madalena");
    expect(patch.cidade).toBe("São Paulo");
    expect(patch.estado).toBe("SP");
  });

  it("usa reverse geocoding quando place_name não tem os dados", async () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "pk.teste-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [
            {
              id: "address.2",
              place_name: "Rua X, Centro, Guarulhos, SP 07010-000, Brasil",
              place_type: ["address"],
              text: "Rua X",
              center: [-46.53, -23.45],
              context: [
                { id: "neighborhood.1", text: "Centro" },
                { id: "place.1", text: "Guarulhos" },
                { id: "region.1", text: "São Paulo", short_code: "BR-SP" },
                { id: "postcode.1", text: "07010-000" },
              ],
            },
          ],
        }),
      }))
    );

    const patch = await complementarDadosEndereco(
      { cep: "", bairro: "", cidade: "", estado: "" },
      suggestion({ place_name: "Rua X", center: [-46.53, -23.45] })
    );

    expect(patch.cep).toBe("07010-000");
    expect(patch.bairro).toBe("Centro");
    expect(patch.cidade).toBe("Guarulhos");
    expect(patch.estado).toBe("SP");
    expect(fetch).toHaveBeenCalled();
  });

  it("não sobrescreve valores já existentes no base", async () => {
    const patch = await complementarDadosEndereco(
      { cep: "99999-999", bairro: "", cidade: "Guarulhos", estado: "SP" },
      suggestion({})
    );
    expect(patch.cep).toBeUndefined();
    expect(patch.cidade).toBeUndefined();
    expect(patch.estado).toBeUndefined();
    expect(patch.bairro).toBe("Vila Madalena");
  });

  // --------------------------------------------------------------------------
  // BUG CRÍTICO: CEP parcial ("05016") + Bairro vazio (ex.: Avenida Sumaré/SP)
  // --------------------------------------------------------------------------
  it("extrairDadosDaSuggestion: CEP parcial NÃO vira cep final (só prefixo)", () => {
    const dados = extrairDadosDaSuggestion({
      id: "address.1",
      place_name: "Avenida Sumaré, São Paulo, SP 05016, Brasil",
      place_type: ["address"],
      text: "Avenida Sumaré",
      center: [-46.68, -23.53],
      context: [
        { id: "place.1", text: "São Paulo" },
        { id: "region.1", text: "São Paulo", short_code: "BR-SP" },
        { id: "postcode.1", text: "05016" }, // parcial (5 dígitos)
      ],
    });
    expect(dados.cep).toBeUndefined();
    expect(dados.cepPrefixo).toBe("05016");
    expect(dados.cidade).toBe("São Paulo");
    expect(dados.estado).toBe("SP");
  });

  it("cepCompleto: só valida 8 dígitos", () => {
    expect(cepCompleto("05016")).toBe(false);
    expect(cepCompleto("05016-000")).toBe(true);
    expect(cepCompleto("05016000")).toBe(true);
    expect(cepCompleto("")).toBe(false);
  });

  it("ViaCEP preenche CEP exato e Bairro quando o Mapbox manda só o prefixo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(String(url)).toContain("viacep.com.br");
        return {
          ok: true,
          json: async () => [
            {
              cep: "05016-000",
              logradouro: "Avenida Sumaré",
              complemento: "",
              bairro: "Perdizes",
              localidade: "São Paulo",
              uf: "SP",
            },
          ],
        };
      })
    );

    const patch = await complementarDadosEndereco(
      { cep: "05016", bairro: "", cidade: "São Paulo", estado: "SP" },
      {
        id: "address.1",
        place_name: "Avenida Sumaré, São Paulo, SP 05016, Brasil",
        place_type: ["address"],
        text: "Avenida Sumaré",
        center: [-46.68, -23.53],
        context: [
          { id: "place.1", text: "São Paulo" },
          { id: "region.1", text: "São Paulo", short_code: "BR-SP" },
          { id: "postcode.1", text: "05016" },
        ],
      }
    );

    // CEP parcial corrigido para o CEP completo e Bairro preenchido
    expect(patch.cep).toBe("05016-000");
    expect(patch.bairro).toBe("Perdizes");
    // não sobrescreve cidade/estado já presentes
    expect(patch.cidade).toBeUndefined();
    expect(patch.estado).toBeUndefined();
  });

  it("ViaCEP: prioriza o resultado cujo CEP casa com o prefixo", async () => {
    vi.stubEnv("VITE_MAPBOX_ACCESS_TOKEN", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { cep: "05010-000", bairro: "Bairro Errado", localidade: "São Paulo", uf: "SP", logradouro: "Avenida Sumaré" },
          { cep: "05016-000", bairro: "Perdizes", localidade: "São Paulo", uf: "SP", logradouro: "Avenida Sumaré" },
        ],
      }))
    );

    const via = await consultarViaCep({
      cepPrefixo: "05016",
      uf: "SP",
      cidade: "São Paulo",
      logradouro: "Avenida Sumaré",
    });
    expect(via?.cep).toBe("05016-000");
    expect(via?.bairro).toBe("Perdizes");
  });

  it("NUNCA injeta CEP parcial no patch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    );
    const patch = await complementarDadosEndereco(
      { cep: "05016", bairro: "", cidade: "", estado: "" },
      {
        id: "x",
        place_name: "Avenida Sumaré, SP 05016",
        place_type: ["address"],
        text: "Avenida Sumaré",
      }
    );
    // sem CEP completo disponível → não injeta nada de cep
    expect(patch.cep).toBeUndefined();
  });
});
