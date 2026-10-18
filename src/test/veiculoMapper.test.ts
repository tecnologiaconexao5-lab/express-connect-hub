import { describe, it, expect } from "vitest";
import { toVeiculoInsert, toVeiculoUpdate, fromVeiculoRow } from "@/lib/dbMappers";
import type { VeiculoForm, VeiculoRow } from "@/lib/dbMappers";

const COLUNAS_REAIS = new Set([
  "placa", "tipo_veiculo", "marca", "modelo", "ano_fabricacao", "ano_modelo",
  "cor", "renavam", "chassi", "capacidade_kg", "capacidade_m3", "comprimento",
  "largura", "altura", "qtd_pallets", "rastreador", "seguro_apolice",
  "possui_seguro", "validade_documental", "prestador_vinculado", "unidade",
  "custo_km", "custo_diaria", "antt", "cpf_cnpj_proprietario", "tipo_carga",
  "temp_min", "temp_max", "restricoes_regiao", "observacoes_operacionais",
  "status", "observacoes", "fotos", "created_at", "updated_at",
]);

const COLUNAS_ILEGITIMAS = ["subcategoria", "tipo_carroceria", "classificacao_termica"];

describe("toVeiculoInsert", () => {
  it("1 — payload mínimo (só placa + tipo)", () => {
    const result = toVeiculoInsert({ placa: "hml001", tipoVeiculo: "moto" });
    expect(result.placa).toBe("HML001");
    expect(result.tipo_veiculo).toBe("moto");
  });

  it("2 — NÃO envia subcategoria, tipo_carroceria ou classificacao_termica", () => {
    const result = toVeiculoInsert({
      placa: "TESTE",
      tipoVeiculo: "vuc",
      subcategoria: "urbano",
      tipoCarroceria: "baú",
      classificacaoTermica: "refrigerado",
    });
    COLUNAS_ILEGITIMAS.forEach((col) => {
      expect(Object.keys(result)).not.toContain(col);
    });
  });

  it("3 — todas as chaves do payload são colunas reais", () => {
    const result = toVeiculoInsert({
      placa: "TESTE",
      tipoVeiculo: "vuc",
      marca: "Ford",
      modelo: "Transit",
      anoFabricacao: 2020,
      capacidadeKg: 1000,
      status: "Ativo",
      observacoes: "teste",
    });
    Object.keys(result).forEach((key) => {
      expect(COLUNAS_REAIS.has(key) || key === "id").toBe(true);
    });
  });

  it("4 — subcategoria vazia não gera chave", () => {
    const result = toVeiculoInsert({ placa: "X", tipoVeiculo: "moto", subcategoria: "" });
    expect(Object.keys(result)).not.toContain("subcategoria");
  });

  it("5 — prestadorVinculado undefined não aparece", () => {
    const result = toVeiculoInsert({ placa: "X", tipoVeiculo: "moto" });
    expect(Object.keys(result)).not.toContain("prestador_vinculado");
  });

  it("6 — capacidades numéricas viram number", () => {
    const result = toVeiculoInsert({ placa: "X", tipoVeiculo: "moto", capacidadeKg: 500 });
    expect(result.capacidade_kg).toBe(500);
  });

  it("7 — observacoes preservada", () => {
    const result = toVeiculoInsert({ placa: "X", tipoVeiculo: "moto", observacoes: "TMS-0063-HML" });
    expect(result.observacoes).toBe("TMS-0063-HML");
  });
});

describe("toVeiculoUpdate", () => {
  it("não contém created_at", () => {
    const result = toVeiculoUpdate({ placa: "X", tipoVeiculo: "moto" });
    expect(Object.keys(result)).not.toContain("created_at");
  });

  it("não contém subcategoria / tipo_carroceria / classificacao_termica", () => {
    const result = toVeiculoUpdate({
      placa: "X",
      tipoVeiculo: "moto",
      subcategoria: "urbano",
      tipoCarroceria: "baú",
      classificacaoTermica: "seco",
    });
    COLUNAS_ILEGITIMAS.forEach((col) => {
      expect(Object.keys(result)).not.toContain(col);
    });
  });
});

describe("fromVeiculoRow", () => {
  const row: VeiculoRow = {
    id: "abc-123",
    placa: "HML001",
    tipo_veiculo: "moto",
    status: "Ativo",
    observacoes: "TMS-0063-HML",
  };

  it("retorna VeiculoForm sem subcategoria", () => {
    const form = fromVeiculoRow(row as any);
    expect(form.subcategoria).toBeUndefined();
    expect(form.tipoCarroceria).toBeUndefined();
    expect(form.classificacaoTermica).toBeUndefined();
  });

  it("placa e tipo preservados", () => {
    const form = fromVeiculoRow(row as any);
    expect(form.placa).toBe("HML001");
    expect(form.tipoVeiculo).toBe("moto");
  });
});
