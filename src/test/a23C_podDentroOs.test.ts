import { describe, it, expect } from "vitest";
import { montarEntregaOS, type EntregaOS } from "@/services/comprovantes/comprovantesService";

describe("MISSÃO A23 — FASE C — montarEntregaOS (OS → alocação → POD)", () => {
  const alocBase = {
    id: "aloc-1",
    ordem_servico_id: "os-1",
    status: "concluida",
    finalizada: true,
    placa: "ABC1D23",
    tipo_veiculo: "Truck",
    prestador_id: "prest-1",
    destino: "São Paulo - SP",
  };

  it("1 — OS sem POD → tem_pod false e situação pendente", () => {
    const e = montarEntregaOS({ alocacao: alocBase, pod: null });
    expect(e.tem_pod).toBe(false);
    expect(e.situacao_pod).toBeNull();
    expect(e.pod_id).toBeNull();
    expect(e.situacao_label).toBe("Pendente");
  });

  it("2 — OS com POD → dados reais preenchidos", () => {
    const e = montarEntregaOS({
      alocacao: alocBase,
      pod: { id: "pod-1", nome_recebedor: "Maria", documento_recebedor: "123", status: "entregue", data_hora_entrega: "2026-08-14T10:00:00Z" },
    });
    expect(e.tem_pod).toBe(true);
    expect(e.pod_id).toBe("pod-1");
    expect(e.recebedor).toBe("Maria");
    expect(e.documento_recebedor).toBe("123");
    expect(e.data_hora_entrega).toBe("2026-08-14T10:00:00Z");
  });

  it("3 — POD com foto → tem_foto true", () => {
    const e = montarEntregaOS({
      alocacao: alocBase,
      pod: { id: "pod-1", foto_entrega_url: "https://x/foto.jpg", status: "entregue" },
    });
    expect(e.tem_foto).toBe(true);
    expect(e.tem_canhoto).toBe(false);
    expect(e.tem_assinatura).toBe(false);
  });

  it("4 — POD com assinatura → tem_assinatura true", () => {
    const e = montarEntregaOS({
      alocacao: alocBase,
      pod: { id: "pod-1", assinatura_url: "https://x/sig.png", status: "entregue" },
    });
    expect(e.tem_assinatura).toBe(true);
  });

  it("5 — POD com canhoto → tem_canhoto true", () => {
    const e = montarEntregaOS({
      alocacao: alocBase,
      pod: { id: "pod-1", foto_canhoto_url: "https://x/canhoto.jpg", status: "entregue" },
    });
    expect(e.tem_canhoto).toBe(true);
    expect(e.tem_foto).toBe(true); // canhoto conta como evidência fotográfica
  });

  it("6 — múltiplas entregas → montagem preserva todas (via mapeamento)", () => {
    const rawList = [
      { alocacao: { ...alocBase, id: "aloc-1" }, pod: null },
      { alocacao: { ...alocBase, id: "aloc-2" }, pod: { id: "pod-2", status: "entregue", nome_recebedor: "João" } },
    ];
    const entregas: EntregaOS[] = rawList.map((r) => montarEntregaOS(r as any));
    expect(entregas).toHaveLength(2);
    expect(entregas[0].tem_pod).toBe(false);
    expect(entregas[1].tem_pod).toBe(true);
    expect(entregas[1].alocacao_id).toBe("aloc-2");
  });

  it("7 — 'Ver comprovante' → pod_id disponível quando há POD", () => {
    const e = montarEntregaOS({
      alocacao: alocBase,
      pod: { id: "pod-99", status: "entregue_ressalva", nome_recebedor: "Ana" },
    });
    expect(e.pod_id).toBe("pod-99");
    expect(e.tem_pod).toBe(true);
  });

  it("8 — ausência de rota_paradas NÃO quebra a montagem", () => {
    const e = montarEntregaOS({ alocacao: alocBase, pod: null, parada: null, prestador_nome: "Motorista X" });
    expect(e.endereco).toBeNull();
    expect(e.destinatario).toBe("São Paulo - SP"); // fallback destino da alocação
    expect(e.prestador_nome).toBe("Motorista X");
    expect(e.veiculo_placa).toBe("ABC1D23");
  });

  it("9 — volumes ausentes NÃO são inventados", () => {
    const e = montarEntregaOS({ alocacao: alocBase, pod: null, parada: null });
    expect(e.volume_previsto).toBeNull();
    expect(e.volume_entregue).toBeNull();

    const comParada = montarEntregaOS({
      alocacao: alocBase,
      pod: null,
      parada: { volumes: 10, volumes_entregues: 8, destinatario: "Empresa Y", sequencia: 2 },
    });
    expect(comParada.volume_previsto).toBe(10);
    expect(comParada.volume_entregue).toBe(8);
    expect(comParada.sequencia).toBe(2);
  });

  it("10 — dados planejados/manuais da OS permanecem separados do POD", () => {
    // montarEntregaOS só monta dados REAIS de entrega; campos manuais da OS
    // (recebedorNome/recebedorDocumento/dataEntrega) ficam no OrdemServicoForm.
    const e = montarEntregaOS({ alocacao: alocBase, pod: null });
    // sem POD: recebedor do POD é vazio, mas NÃO contamina campos manuais
    expect(e.recebedor).toBeNull();
    expect("recebedorNome" in e).toBe(false);
  });
});
