import { useEffect, useMemo, useRef } from "react";
import { obterConfigCaptcha } from "@/lib/ofertaCaptcha";


interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId?: string) => void;
}

interface HCaptchaApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    hcaptcha?: HCaptchaApi;
  }
}


function carregarScript(src: string, id: string): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("sem_documento"));
  const existente = document.getElementById(id) as HTMLScriptElement | null;
  if (existente) {
    if (existente.dataset.carregado === "true") return Promise.resolve();
    return new Promise((resolve, reject) => {
      existente.addEventListener("load", () => resolve(), { once: true });
      existente.addEventListener("error", () => reject(new Error("script_captcha")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.carregado = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error("script_captcha")), { once: true });
    document.head.appendChild(script);
  });
}

export function OfertaCaptcha({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string) => void;
  resetKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);
  const config = useMemo(() => obterConfigCaptcha(), []);

  useEffect(() => {
    if (!config || !containerRef.current) return;
    let ativo = true;
    const scriptId = "captcha-" + config.provider;
    const scriptSrc =
      config.provider === "hcaptcha"
        ? "https://js.hcaptcha.com/1/api.js?render=explicit"
        : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

    carregarScript(scriptSrc, scriptId)
      .then(() => {
        if (!ativo || !containerRef.current) return;
        const api = config.provider === "hcaptcha" ? window.hcaptcha : window.turnstile;
        if (!api) return;
        if (widgetRef.current) {
          api.remove(widgetRef.current);
          widgetRef.current = null;
        }
        widgetRef.current = api.render(containerRef.current, {
          sitekey: config.siteKey,
          theme: "light",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => {
        if (ativo) onToken("");
      });

    return () => {
      ativo = false;
      const api = config.provider === "hcaptcha" ? window.hcaptcha : window.turnstile;
      if (api && widgetRef.current) {
        api.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [config, onToken, resetKey]);

  if (!config) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">Verificação anti-spam *</p>
      <p className="text-[11px] text-slate-500">
        Conclua a verificação para enviar a oferta com segurança.
      </p>
      <div ref={containerRef} />
    </div>
  );
}
