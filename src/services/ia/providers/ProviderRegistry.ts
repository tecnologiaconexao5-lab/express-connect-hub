import type { IProvider } from "./ProviderInterface";
import { ZohoMailProvider } from "./ZohoMailProvider";
import { WhatsAppProvider } from "./WhatsAppProvider";
import { VagasProvider } from "./VagasProvider";
import { SocialMediaProvider } from "./SocialMediaProvider";
import { GoogleAdsProvider } from "./GoogleAdsProvider";

const providers: IProvider[] = [
  new ZohoMailProvider(),
  new WhatsAppProvider(),
  new VagasProvider(),
  new SocialMediaProvider(),
  new GoogleAdsProvider(),
];

const providerMap = new Map<string, IProvider>();

for (const p of providers) {
  const key = `${p.tipo}:${p.provedor}`;
  providerMap.set(key, p);
  providerMap.set(p.tipo, p);
}

export function getProvider(tipo: string, provedor: string): IProvider | undefined {
  return providerMap.get(`${tipo}:${provedor}`) || providerMap.get(tipo);
}

export function getProviderByKey(key: string): IProvider | undefined {
  return providerMap.get(key);
}

export function listAllProviders(): IProvider[] {
  return providers;
}

export function getProviderForConector(conector: { tipo: string; provedor: string }): IProvider | undefined {
  return getProvider(conector.tipo, conector.provedor);
}
