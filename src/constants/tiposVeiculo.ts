export const TIPOS_VEICULO = [
  { value: 'moto', label: 'Moto' },
  { value: 'carro_passeio', label: 'Veículo de Passeio' },
  { value: 'fiorino', label: 'Fiorino' },
  { value: 'kangoo', label: 'Kangoo' },
  { value: 'kombi', label: 'Kombi' },
  { value: 'van', label: 'Van' },
  { value: 'hr', label: 'HR' },
  { value: 'vuc', label: 'VUC' },
  { value: 'tres_quartos', label: '3/4' },
  { value: 'toco', label: 'Toco' },
  { value: 'truck', label: 'Truck' },
  { value: 'bitruck', label: 'Bitruck' },
  { value: 'carreta', label: 'Carreta' },
  { value: 'bitrem', label: 'Bitrem' },
];

export const VEICULO_PARAMETROS: Record<string, { pesoMax: number; compMax: number; largMax: number; altMax: number; cubagemMax: number; label: string }> = {
  moto: { pesoMax: 40, compMax: 60, largMax: 60, altMax: 60, cubagemMax: 0.2, label: 'Moto' },
  carro_passeio: { pesoMax: 200, compMax: 120, largMax: 80, altMax: 80, cubagemMax: 0.75, label: 'Veículo de Passeio' },
  fiorino: { pesoMax: 600, compMax: 180, largMax: 130, altMax: 120, cubagemMax: 2.8, label: 'Fiorino' },
  kangoo: { pesoMax: 900, compMax: 170, largMax: 120, altMax: 115, cubagemMax: 3.0, label: 'Kangoo' },
  kombi: { pesoMax: 1100, compMax: 220, largMax: 140, altMax: 130, cubagemMax: 4.0, label: 'Kombi' },
  van: { pesoMax: 1300, compMax: 300, largMax: 160, altMax: 170, cubagemMax: 8.0, label: 'Van' },
  hr: { pesoMax: 1800, compMax: 330, largMax: 180, altMax: 180, cubagemMax: 10.0, label: 'HR' },
  vuc: { pesoMax: 2500, compMax: 420, largMax: 200, altMax: 200, cubagemMax: 16.0, label: 'VUC' },
  tres_quartos: { pesoMax: 4000, compMax: 500, largMax: 220, altMax: 220, cubagemMax: 24.0, label: '3/4' },
  toco: { pesoMax: 7500, compMax: 700, largMax: 240, altMax: 250, cubagemMax: 40.0, label: 'Toco' },
  truck: { pesoMax: 12000, compMax: 900, largMax: 260, altMax: 280, cubagemMax: 60.0, label: 'Truck' },
  bitruck: { pesoMax: 14000, compMax: 950, largMax: 260, altMax: 280, cubagemMax: 65.0, label: 'Bitruck' },
  carreta: { pesoMax: 30000, compMax: 1400, largMax: 260, altMax: 280, cubagemMax: 90.0, label: 'Carreta' },
  bitrem: { pesoMax: 45000, compMax: 1900, largMax: 260, altMax: 280, cubagemMax: 120.0, label: 'Bitrem' },
};

export const sugerirVeiculo = (pesoKg: number, cubagemM3: number = 0, compCm: number = 0, largCm: number = 0, altCm: number = 0): string | null => {
  for (const [tipo, params] of Object.entries(VEICULO_PARAMETROS)) {
    const pesoOk = pesoKg <= params.pesoMax;
    const cubagemOk = cubagemM3 <= params.cubagemMax || params.cubagemMax >= 100;
    const compOk = compCm <= params.compMax || compCm === 0;
    const largOk = largCm <= params.largMax || largCm === 0;
    const altOk = altCm <= params.altMax || altCm === 0;
    
    if (pesoOk && cubagemOk && compOk && largOk && altOk) {
      return tipo;
    }
  }
  return null;
};

export const TIPOS_PARCEIRO = [
  { value: 'autonomo', label: 'Parceiro Autônomo', color: 'blue' },
  { value: 'agregado', label: 'Parceiro Agregado', color: 'purple' },
  { value: 'fixo', label: 'Parceiro Fixo', color: 'green' },
  { value: 'esporadico', label: 'Parceiro Esporádico', color: 'orange' },
  { value: 'terceiro', label: 'Parceiro Terceiro', color: 'gray' },
  { value: 'clt', label: 'CLT', color: 'teal' }
];
