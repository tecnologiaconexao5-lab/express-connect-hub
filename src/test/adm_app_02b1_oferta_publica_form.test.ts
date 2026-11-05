import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  MENSAGEM_ENVIO_PENDENTE,
  MENSAGEM_OFERTA_REGISTRADA,
  criarOfertaVazia,
  montarPayloadOferta,
  validarOferta,
  validarTelefone,
  validarEmail,
  type OfertaPublicaDraft,
} from "@/lib/ofertaPublica";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

function ofertaValida(overrides: Partial<OfertaPublicaDraft> = {}): OfertaPublicaDraft {
  return {
    ...criarOfertaVazia(),
    tipoOferta: "motorista_veiculo_proprio",
    nome: "Maria da Silva",
    telefone: "(11) 99999-9999",
    email: "maria@exemplo.com",
    cidade: "São Paulo",
    uf: "SP",
    regioes: ["Grande SP"],
    dias: [1, 2, 3, 4, 5],
    horarioInicio: "08:00",
    horarioFim: "18:00",
    modalidades: ["esporadica", "urgente"],
    veiculoCategoria: "proprio",
    veiculoTipo: "Fiorino",
    veiculoAno: "2024",
    carroceria: "Baú fechado",
    capacidadeKg: "1500",
    capacidadeM3: "6",
    valorDiaria: "250",
    consentimento: true,
    ...overrides,
  };
}

describe("ADM-APP-02B.1 — formulário público de ofertas", () => {
  it("fonte: a rota pública usa o novo formulário e não o serviço antigo quebrado", () => {
    const page = readSrc("src/pages/CadastroPrestador.tsx");
    expect(page).toContain('import { OfertaPublicaForm } from "@/components/cadastro-publico/OfertaPublicaForm"');
    expect(page).toContain("<OfertaPublicaForm />");
    expect(page).not.toContain("criarCandidatoService");
    expect(page).not.toContain("onboardingStore");
  });

  it("fonte: envia para a Edge e nao promete sucesso sem protocolo", () => {
    const form = readSrc("src/components/cadastro-publico/OfertaPublicaForm.tsx");
    expect(form).toContain('supabase.functions.invoke("ofertas-publicas"');
    expect(form).toContain("x-idempotency-key");
    expect(form).toContain("protocoloRecebido");
    expect(form).toContain("setConcluido(true)");
    expect(form).not.toContain("criarCandidatoService");
    expect(form).not.toContain("Oferta registrada com sucesso");
    expect(form).not.toContain("Cadastro Completo");
    expect(form).not.toContain("Prestador aprovado");
    expect(form).toContain("MENSAGEM_OFERTA_REGISTRADA");
    expect(form).not.toContain("MENSAGEM_ENVIO_PENDENTE");
    expect(form).not.toContain("Integra");
    expect(form).toContain("consentimento");
    expect(form).toContain("modalidades");
    expect(form).toContain("dias");
    expect(form).toContain("valorNegociavel");
  });

  it("fonte: não solicita documentos/dados de contratação no link público", () => {
    const form = readSrc("src/components/cadastro-publico/OfertaPublicaForm.tsx");
    for (const proibido of ["CPF", "CNH", "CRLV", "selfie", "PIX", "dados bancários", "assinatura"]) {
      expect(form.toLowerCase()).not.toContain(proibido.toLowerCase());
    }
  });

  it("valida contato, e-mail e telefone", () => {
    expect(validarTelefone("(11) 99999-9999")).toBe(true);
    expect(validarTelefone("11999999999")).toBe(true);
    expect(validarTelefone("9999")).toBe(false);
    expect(validarEmail("maria@exemplo.com")).toBe(true);
    expect(validarEmail("maria@")).toBe(false);
    expect(validarEmail("")).toBe(true);
  });

  it("rejeita oferta vazia com mensagens claras", () => {
    const erros = validarOferta(criarOfertaVazia());
    expect(erros.length).toBeGreaterThan(0);
    expect(erros.join(" ")).toContain("tipo de oferta");
    expect(erros.join(" ")).toContain("telefone");
    expect(erros.join(" ")).toContain("região");
    expect(erros.join(" ")).toContain("modalidade");
    expect(erros.join(" ")).toContain("autorizar");
  });

  it("aceita oferta completa e valida horário/modalidades", () => {
    expect(validarOferta(ofertaValida())).toEqual([]);

    const semDia = validarOferta(ofertaValida({ dias: [] }));
    expect(semDia.join(" ")).toContain("dia disponível");

    const horarioInvertido = validarOferta(
      ofertaValida({ horarioInicio: "18:00", horarioFim: "08:00" }),
    );
    expect(horarioInvertido.join(" ")).toContain("horário final");

    const semModalidade = validarOferta(ofertaValida({ modalidades: [] }));
    expect(semModalidade.join(" ")).toContain("modalidade");
  });

  it("valida campos condicionais de motoboy e de veículo", () => {
    const motoboy = ofertaValida({
      tipoOferta: "motoboy",
      tipoMoto: "",
      veiculoTipo: "",
      carroceria: "",
      veiculoCategoria: "proprio",
    });
    expect(validarOferta(motoboy)).toEqual([]);

    const semCategoriaMoto = ofertaValida({
      tipoOferta: "motoboy",
      veiculoCategoria: "",
      veiculoTipo: "",
      carroceria: "",
    });
    expect(validarOferta(semCategoriaMoto).join(" ")).toContain("categoria do veículo");

    const motorista = ofertaValida({ veiculoTipo: "", carroceria: "" });
    expect(validarOferta(motorista).join(" ")).toContain("tipo de veículo");
    expect(validarOferta(motorista).join(" ")).toContain("carroceria");

    const semAno = ofertaValida({ veiculoAno: "" });
    expect(validarOferta(semAno).join(" ")).toContain("ano do veículo");
  });

  it("exige valor/condição ou a opção de valor a negociar", () => {
    const semValor = ofertaValida({
      valorDiaria: "",
      valorKm: "",
      valorSaida: "",
      valorMensal: "",
      condicoesComerciais: "",
      valorNegociavel: false,
    });
    expect(validarOferta(semValor).join(" ")).toContain("valor");

    const negociavel = ofertaValida({
      valorDiaria: "",
      valorKm: "",
      valorSaida: "",
      valorMensal: "",
      condicoesComerciais: "A combinar conforme a rota",
      valorNegociavel: true,
    });
    expect(validarOferta(negociavel)).toEqual([]);
  });

  it("monta payload da oferta sem dados de APP/documentos", () => {
    const payload = montarPayloadOferta(
      ofertaValida({
        tipoOferta: "motoboy",
        tipoMoto: "",
        marcaMoto: "Honda",
        cilindrada: "160",
        possuiBau: true,
        compartimento: "bau",
        capacidadeBauLitros: "90",
        veiculoCategoria: "proprio",
        valorSemanal: "1500",
        atitudeImprevisto: "Aviso imediatamente a base/suporte",
        valorizaParceria: "Suporte rápido e eficiente",
        tipoOperacaoLogistica: "Distribuição porta a porta B2B/B2C",
        manutencaoVeiculo: "Preventiva rigorosa",
        focoCargaFragil: "Amarração e segurança total",
        posturaDivergencia: "Contato a base na hora",
        facilidadeTecnologia: "Tenho muita facilidade",
        disponibilidadeAltaDemanda: "Gosto de fazer horas extras",
        consumoMedioKmL: "12 km/l",
        abastecimentoOperacao: "Tenho capital próprio",
        comprometimentoRotaFixa: "Cumpro a rota fixa assumida primeiro",
        mediaParadasDia: "21 a 50 paradas",
        caracteristicas: ["Rastreador"],
        marcaRastreador: "Autotrac",
      }),
    );

    expect(payload.tipo_oferta).toBe("motoboy");
    expect(payload.veiculo_tipo).toBe("moto");
    expect(payload.tipo_moto).toBe("Outra");
    expect(payload.possui_bau).toBe(true);
    expect(payload.capacidade_bau_litros).toBe(90);
    const caracteristicas = payload.caracteristicas as string[];
    expect(caracteristicas).toContain("marca_moto:Honda");
    expect(caracteristicas).toContain("cilindrada:160");
    expect(caracteristicas).toContain("compartimento:bau");
    expect(caracteristicas).toContain("marca_rastreador:Autotrac");
    const observacoes = String(payload.observacoes || "");
    expect(observacoes).toContain("Valor semanal: R$ 1500");
    expect(observacoes).toContain("Imprevisto/atraso na rota: Aviso imediatamente a base/suporte");
    expect(observacoes).toContain("O que mais valoriza na parceria: Suporte rápido e eficiente");
    expect(observacoes).toContain("Operacao: Distribuição porta a porta B2B/B2C");
    expect(observacoes).toContain("Manutencao: Preventiva rigorosa");
    expect(observacoes).toContain("Carga: Amarração e segurança total");
    expect(observacoes).toContain("Comunicacao: Contato a base na hora");
    expect(observacoes).toContain("Tecnologia: Tenho muita facilidade");
    expect(observacoes).toContain("Disponibilidade: Gosto de fazer horas extras");
    expect(observacoes).toContain("Consumo: 12 km/l");
    expect(observacoes).toContain("Abastecimento: Tenho capital próprio");
    expect(observacoes).toContain("Comprometimento: Cumpro a rota fixa assumida primeiro");
    expect(observacoes).toContain("Media de paradas: 21 a 50 paradas");
    expect(payload.condicoes_comerciais).toBe("Valor semanal: R$ 1500");
    expect(payload.lgpd_consent).toBe(true);
    expect(payload.lgpd_termo_versao).toBe("2026-11-v1");
    expect(payload).not.toHaveProperty("cpf");
    expect(payload).not.toHaveProperty("cnh");
    expect(payload).not.toHaveProperty("crlv");
    expect(payload).not.toHaveProperty("chave_pix");
  });

  it("fonte: Ofertas Públicas está acessível no Recrutamento com copiar/compartilhar", () => {
    const sidebar = readSrc("src/lib/sidebarData.ts");
    const moduleIndex = readSrc("src/modules/recrutamento/index.tsx");
    const layout = readSrc("src/modules/recrutamento/layouts/RecrutamentoLayout.tsx");
    const painel = readSrc("src/modules/recrutamento/components/ofertas/OfertasPublicas.tsx");

    expect(sidebar).toContain("Ofertas Públicas");
    expect(sidebar).toContain("/recrutamento?section=ofertas-publicas");
    expect(moduleIndex).toContain("case 'ofertas-publicas'");
    expect(moduleIndex).toContain("<OfertasPublicas />");
    expect(layout).toContain("ofertas-publicas");
    expect(painel).toContain("obterLinkPublicoOfertas");
    expect(painel).toContain("Copiar link");
    expect(painel).toContain("Compartilhar");
    expect(painel).toContain("Enviar no WhatsApp");
    expect(painel).not.toContain("supabase");
  });

  it("mantém a mensagem final preparada para a integração futura", () => {
    expect(MENSAGEM_OFERTA_REGISTRADA).toContain("Oferta registrada com sucesso");
    expect(MENSAGEM_OFERTA_REGISTRADA).toContain("não representa aprovação, contratação ou liberação de acesso ao APP");
    expect(MENSAGEM_ENVIO_PENDENTE).toContain("Nenhum dado foi enviado ou gravado");
  });
});
