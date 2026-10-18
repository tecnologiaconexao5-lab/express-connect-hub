import type { FreightProviderInterface } from "./FreightProviderInterface";
import { FrenetProvider } from "./FrenetProvider";
import { EdgeFreightProvider } from "./EdgeFreightProvider";

export type FreightProviderCodigo =
  | "AZUL_CARGO"
  | "GOLLOG"
  | "LATAM_CARGO"
  | "FRENET"
  | "RODONAVES"
  | "JAMEF"
  | "BRASPRESS"
  | "KANGU";

export class FreightProviderRegistry {
  private static instanciaUnica: FreightProviderRegistry | null = null;
  private readonly provedores: Map<string, FreightProviderInterface>;

  constructor() {
    this.provedores = new Map<string, FreightProviderInterface>();
    this.provedores.set("AZUL_CARGO", new EdgeFreightProvider("AZUL_CARGO"));
    this.provedores.set("GOLLOG", new EdgeFreightProvider("GOLLOG"));
    this.provedores.set("LATAM_CARGO", new EdgeFreightProvider("LATAM_CARGO"));
    this.provedores.set("RODONAVES", new EdgeFreightProvider("RODONAVES"));
    this.provedores.set("JAMEF", new EdgeFreightProvider("JAMEF"));
    this.provedores.set("BRASPRESS", new EdgeFreightProvider("BRASPRESS"));
    this.provedores.set("KANGU", new EdgeFreightProvider("KANGU"));
    this.provedores.set("FRENET", new FrenetProvider());
  }

  private static obterInstancia(): FreightProviderRegistry {
    if (!FreightProviderRegistry.instanciaUnica) {
      FreightProviderRegistry.instanciaUnica = new FreightProviderRegistry();
    }
    return FreightProviderRegistry.instanciaUnica;
  }

  static obterProvedor(codigo: string): FreightProviderInterface {
    return FreightProviderRegistry.obterInstancia().obterProvedor(codigo);
  }

  static listarCodigos(): string[] {
    return FreightProviderRegistry.obterInstancia().listarCodigos();
  }

  registrar(codigo: FreightProviderCodigo, provedor: FreightProviderInterface): void {
    this.provedores.set(codigo, provedor);
  }

  obterProvedor(codigo: string): FreightProviderInterface {
    const provedor = this.provedores.get(codigo);
    if (!provedor) {
      throw new Error(`Provedor de frete não suportado: ${codigo}`);
    }
    return provedor;
  }

  listarCodigos(): string[] {
    return Array.from(this.provedores.keys());
  }
}
