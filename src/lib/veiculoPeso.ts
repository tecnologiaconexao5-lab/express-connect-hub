// ============================================================
// MISSAO OS-MOBILE (item 4) — regra de veículo por peso
// Fonte única compartilhada pelo PedidoRapido (item 2) e pelo
// /os-mobile. Mantida EXATAMENTE como no fluxo do Pedido Rápido:
//   Até 40kg = Moto | 41-150 = Passeio | 151-600 = Fiorino
//   601-1000 = Kombi | 1001-1800 = Van/HR | 1801-2500 = VUC
//   Acima de 2.500 kg: sem sugestão automática (contato operação)
// ============================================================

export const OPCOES_VEICULO: { value: string; label: string }[] = [
  { value: "moto", label: "Moto — até 40 kg" },
  { value: "passeio", label: "Veículo Passeio — 41 a 150 kg" },
  { value: "fiorino", label: "Fiorino — 151 a 600 kg" },
  { value: "kombi", label: "Kombi — 601 a 1.000 kg" },
  { value: "hr", label: "Van / HR — 1.001 a 1.800 kg" },
  { value: "vuc", label: "VUC — 1.801 a 2.500 kg" },
];

/** Regra exata de veículo por peso (auto-sugestão + trava). */
export function veiculoPorPeso(kg: number): string | null {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  if (kg <= 40) return "moto";
  if (kg <= 150) return "passeio";
  if (kg <= 600) return "fiorino";
  if (kg <= 1000) return "kombi";
  if (kg <= 1800) return "hr";
  if (kg <= 2500) return "vuc";
  return null; // acima de 2.500 kg: sem trava automática — contato operação
}

/** Label legível de um código de veículo (ex.: "moto" → "Moto — até 40 kg"). */
export function labelVeiculo(value: string): string | null {
  return OPCOES_VEICULO.find((v) => v.value === value)?.label || null;
}

/**
 * SLA (regra do Pedido Rápido): "Urgente" só existe para Moto.
 * Carro+ usa apenas Normal/Agendado.
 */
export function slaPermitido(veiculo: string, nivel: "urgente" | "normal" | "agendado"): boolean {
  if (nivel === "urgente") return veiculo === "moto";
  return true;
}
