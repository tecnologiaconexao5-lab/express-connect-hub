# Como Adicionar um Novo Provider

## Passo a Passo

### 1. Criar o arquivo do provider

Em `src/services/ia/comercialIA/providers/NovoProvider.ts`:

```typescript
import type { HunterProvider, ProviderResultado, ProspectBruto } from "./HunterProvider";
import type { EstrategiaHunter } from "../types";

export const novoProvider: HunterProvider = {
  id: "meu_provider",
  nome: "Meu Provider",
  tipo: "web_search", // ou manual, mock, google_maps, catalogo, social_assistido
  ativo: false,
  confianca: "media",  // alta, media, baixa, simulada
  requer_chave_api: true,
  requer_acao_manual: false,

  async buscarProspects(config, estrategia): Promise<ProviderResultado> {
    // 1. Validar se tem configuracao/chave
    // 2. Chamar API ou fonte
    // 3. Retornar prospects com origem rastreavel
    return {
      origem: "meu_provider",
      status: "sucesso", // sucesso, simulado, nao_configurado, erro, sem_chave
      prospects: [],
      custo_estimado: 0,
    };
  },

  validarConfiguracao(providerConfig) {
    return { valido: true };
  },

  estimarCusto(prospectsCount) { return 0; },
  limites() { return { por_ciclo: 30, por_dia: 100 }; },
  descricao() { return "Descricao do provider"; },
};
```

### 2. Registrar no ProviderRegistry

Em `ProviderRegistry.ts`:

```typescript
import { novoProvider } from "./NovoProvider";

// Adicionar ao map
const PROVIDERS = new Map<string, HunterProvider>([
  ...
  [novoProvider.id, novoProvider],
]);
```

### 3. Adicionar na configuracao padrao

Em `types.ts` no `ESTRATEGIA_PADRAO.providers`:

```typescript
meu_provider: { ativo: false, api_key_secret: "MINHA_CHAVE" },
```

### 4. Adicionar na migration SQL

Atualizar o JSON de providers padrao.

### 5. Adicionar na UI

Em `ComercialIAConfigTab.tsx`, adicionar um card na aba "Fontes / Providers".

### 6. Documentar

Adicionar em `docs/CONFIGURAR_PROVIDERS_HUNTER.md`.

## Interface HunterProvider

```typescript
interface HunterProvider {
  id: string;
  nome: string;
  tipo: "manual" | "mock" | "web_search" | "google_maps" | "catalogo" | "social_assistido";
  ativo: boolean;
  confianca: "alta" | "media" | "baixa" | "simulada";
  requer_chave_api: boolean;
  requer_acao_manual: boolean;

  buscarProspects(config, estrategia): Promise<ProviderResultado>;
  validarConfiguracao(config): { valido: boolean; mensagem?: string };
  estimarCusto(count): number;
  limites(): { por_ciclo: number; por_dia: number };
  descricao(): string;
}
```

## Regras

- Provider deve retornar `fonte_nome` e `provider_origem` sempre
- Provider deve marcar `confianca_origem` corretamente
- Provider SIMULADO nunca pode criar leads reais
- Provider sem chave deve retornar `status: "sem_chave"`
- Provider deve respeitar `limites().por_ciclo` 
