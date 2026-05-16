import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OnboardingState {
  currentStep: number;
  isComplete: boolean;
  submittedAt: string | null;

  nome: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  selfieUrl: string | null;
  cnhUrl: string | null;

  tipoVeiculo: string;
  modelo: string;
  placa: string;
  ano: string;
  capacidade: string;
  fotosVeiculo: string[];

  crlvUrl: string | null;
  comprovanteUrl: string | null;
  anttUrl: string | null;
  moppUrl: string | null;
  seguroUrl: string | null;
  chavePix: string;
  banco: string;

  regioes: string[];
  horariosInicio: string;
  horariosFim: string;
  tipoCarga: string;
  tipoViagem: string[];
  fazColeta: boolean;
  fazEntrega: boolean;
  distanciaMaxima: string;

  aceiteLGPD: boolean;
  aceiteContrato: boolean;
  aceiteResponsabilidade: boolean;
  assinaturaDataUrl: string | null;
  dataAssinatura: string | null;

  documentValidations: Record<string, { approved: boolean; confidence: number }>;
  showAIDashboard: boolean;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateField: (field: string, value: unknown) => void;
  setFile: (field: string, url: string) => void;
  addVehiclePhoto: (url: string) => void;
  removeVehiclePhoto: (index: number) => void;
  toggleRegiao: (regiao: string) => void;
  toggleTipoViagem: (tipo: string) => void;
  setDocumentValidation: (docType: string, validation: { approved: boolean; confidence: number }) => void;
  toggleAIDashboard: () => void;
  submitComplete: () => void;
  reset: () => void;
}

const initialState = {
  currentStep: 0,
  isComplete: false,
  submittedAt: null,

  nome: "",
  cpf: "",
  rg: "",
  dataNascimento: "",
  selfieUrl: null as string | null,
  cnhUrl: null as string | null,

  tipoVeiculo: "",
  modelo: "",
  placa: "",
  ano: "",
  capacidade: "",
  fotosVeiculo: [] as string[],

  crlvUrl: null as string | null,
  comprovanteUrl: null as string | null,
  anttUrl: null as string | null,
  moppUrl: null as string | null,
  seguroUrl: null as string | null,
  chavePix: "",
  banco: "",

  regioes: [] as string[],
  horariosInicio: "",
  horariosFim: "",
  tipoCarga: "",
  tipoViagem: [] as string[],
  fazColeta: false,
  fazEntrega: false,
  distanciaMaxima: "",

  aceiteLGPD: false,
  aceiteContrato: false,
  aceiteResponsabilidade: false,
  assinaturaDataUrl: null as string | null,
  dataAssinatura: null as string | null,

  documentValidations: {} as Record<string, { approved: boolean; confidence: number }>,
  showAIDashboard: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep } = get();
        if (currentStep < 4) set({ currentStep: currentStep + 1 });
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) set({ currentStep: currentStep - 1 });
      },

      updateField: (field, value) => set({ [field]: value }),

      setFile: (field, url) => set({ [field]: url }),

      addVehiclePhoto: (url) => {
        const { fotosVeiculo } = get();
        set({ fotosVeiculo: [...fotosVeiculo, url] });
      },

      removeVehiclePhoto: (index) => {
        const { fotosVeiculo } = get();
        set({ fotosVeiculo: fotosVeiculo.filter((_, i) => i !== index) });
      },

      toggleRegiao: (regiao) => {
        const { regioes } = get();
        if (regioes.includes(regiao)) {
          set({ regioes: regioes.filter((r) => r !== regiao) });
        } else {
          set({ regioes: [...regioes, regiao] });
        }
      },

      toggleTipoViagem: (tipo) => {
        const { tipoViagem } = get();
        if (tipoViagem.includes(tipo)) {
          set({ tipoViagem: tipoViagem.filter((t) => t !== tipo) });
        } else {
          set({ tipoViagem: [...tipoViagem, tipo] });
        }
      },

      setDocumentValidation: (docType, validation) => {
        const { documentValidations } = get();
        set({
          documentValidations: { ...documentValidations, [docType]: validation },
        });
      },

      toggleAIDashboard: () => {
        const { showAIDashboard } = get();
        set({ showAIDashboard: !showAIDashboard });
      },

      submitComplete: () =>
        set({
          isComplete: true,
          submittedAt: new Date().toISOString(),
          currentStep: 5,
        }),

      reset: () => set({ ...initialState }),
    }),
    {
      name: "prestador-onboarding-draft",
      partialize: (state) => {
        const { setStep, nextStep, prevStep, updateField, setFile, addVehiclePhoto, removeVehiclePhoto, toggleRegiao, toggleTipoViagem, setDocumentValidation, toggleAIDashboard, submitComplete, reset, ...data } = state;
        return data;
      },
    }
  )
);
