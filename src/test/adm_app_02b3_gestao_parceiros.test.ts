import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  extrairCaracteristicas,
  extrairTriagem,
  rotuloCategoriaAtuacao,
} from "@/lib/recrutamento";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const LIB = readSrc("src/lib/recrutamento.ts");
const PAGE = readSrc("src/modules/recrutamento/components/ofertas/OfertasPublicas.tsx");
const SHEET = readSrc("src/modules/recrutamento/components/ofertas/OfertaDetalheSheet.tsx");

describe("ADM-APP-02B.3 — gestão interna de pré-cadastros", () => {
  it("consulta recrutamento_ofertas pelos mais recentes", () => {
    expect(LIB).toContain('from("recrutamento_ofertas")');
    expect(LIB).toContain('order("created_at", { ascending: false })');
    expect(PAGE).toContain("listarPreCadastros");
  });

  it("extrai marca, cilindrada e rastreador de caracteristicas", () => {
    const extras = extrairCaracteristicas([
      "categoria_atuacao:motoboy",
      "marca_moto:Honda",
      "cilindrada:160",
      "marca_rastreador:Autotrac",
      "compartimento:bau",
      "busca_contrato:ambos",
      "modalidade_adicional:Cobertura",
      "Refrigerado",
    ]);
    expect(extras.categoriaAtuacao).toBe("motoboy");
    expect(extras.marcaMoto).toBe("Honda");
    expect(extras.cilindrada).toBe("160");
    expect(extras.marcaRastreador).toBe("Autotrac");
    expect(extras.compartimento).toBe("bau");
    expect(extras.buscaContrato).toBe("ambos");
    expect(extras.modalidadesAdicionais).toEqual(["Cobertura"]);
    expect(extras.outras).toContain("Refrigerado");
  });

  it("formata a triagem em pares pergunta/resposta", () => {
    const { respostas, textoLivre } = extrairTriagem(
      [
        "Texto livre do interessado",
        "Local principal de carregamento: Grande SP",
        "Operacao: Distribuição porta a porta B2B/B2C",
        "Manutencao: Preventiva rigorosa",
        "Carga: Amarração e segurança total",
        "Comunicacao: Contato a base na hora",
        "Tecnologia: Tenho muita facilidade",
        "Disponibilidade: Gosto de fazer horas extras",
        "Consumo: 12 km/l",
        "Abastecimento: Tenho capital próprio",
        "Comprometimento: Cumpro a rota fixa assumida primeiro",
        "Media de paradas: 21 a 50 paradas",
        "Valor semanal: R$ 1.500",
      ].join(" | "),
    );
    expect(textoLivre).toContain("Texto livre do interessado");
    const chaves = respostas.map((resposta) => resposta.chave);
    expect(chaves).toEqual([
      "Local principal de carregamento",
      "Operacao",
      "Manutencao",
      "Carga",
      "Comunicacao",
      "Tecnologia",
      "Disponibilidade",
      "Consumo",
      "Abastecimento",
      "Comprometimento",
      "Media de paradas",
      "Valor semanal",
    ]);
    expect(respostas.find((r) => r.chave === "Operacao")?.pergunta).toContain("operação logística");
    expect(respostas.find((r) => r.chave === "Disponibilidade")?.resposta).toBe(
      "Gosto de fazer horas extras",
    );
    expect(respostas.find((r) => r.chave === "Consumo")?.pergunta).toContain("km por litro");
    expect(respostas.find((r) => r.chave === "Abastecimento")?.pergunta).toContain("abastecimento");
    expect(respostas.find((r) => r.chave === "Comprometimento")?.resposta).toBe(
      "Cumpro a rota fixa assumida primeiro",
    );
    expect(respostas.find((r) => r.chave === "Media de paradas")?.pergunta).toContain(
      "entregas/paradas",
    );
  });

  it("mantém fallback de categoria pelo tipo de oferta", () => {
    expect(rotuloCategoriaAtuacao("motoboy", "motoboy")).toBe("Motoboy");
    expect(rotuloCategoriaAtuacao("", "disponibilidade_veiculo")).toContain("Frotista");
    expect(rotuloCategoriaAtuacao("", "motorista_veiculo_proprio")).toBe("Motorista Agregado");
  });

  it("página exibe cabeçalho, métricas, filtros rápidos e tabela", () => {
    expect(PAGE).toContain("Gestão de Parceiros (Pré-Cadastros)");
    expect(PAGE).toContain("Total de propostas");
    expect(PAGE).toContain("Aguardando análise");
    expect(PAGE).toContain("Filtros rápidos");
    expect(PAGE).toContain("Categoria de veículo");
    expect(PAGE).toContain("Região");
    for (const coluna of ["Data", "Protocolo", "Nome / Contato", "Categoria", "Veículo", "Regiões", "Status"]) {
      expect(PAGE).toContain(coluna);
    }
    expect(PAGE).toContain("OfertaDetalheSheet");
  });

  it("detalhe organiza veículo e perfil a partir de caracteristicas/observacoes", () => {
    expect(SHEET).toContain("extrairCaracteristicas");
    expect(SHEET).toContain("extrairTriagem");
    expect(SHEET).toContain("Perfil Operacional e Psicológico");
    expect(SHEET).toContain("Expectativas de Remuneração");
    expect(SHEET).toContain("Valor semanal");
  });
});
