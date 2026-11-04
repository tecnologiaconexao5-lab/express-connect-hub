export type ProvedorCaptcha = "turnstile" | "hcaptcha";

export function obterConfigCaptcha(): { provider: ProvedorCaptcha; siteKey: string } | null {
  const provider = ((import.meta.env.VITE_OFERTAS_CAPTCHA_PROVIDER as string | undefined) || "turnstile")
    .trim()
    .toLowerCase();
  const siteKey = ((import.meta.env.VITE_OFERTAS_CAPTCHA_SITE_KEY as string | undefined) || "").trim();
  if (!siteKey || (provider !== "turnstile" && provider !== "hcaptcha")) return null;
  return { provider, siteKey };
}
