export type LogLevel = "debug" | "info" | "warn" | "error";

const IS_DEV = import.meta.env.DEV;

const PII_KEYS = new Set([
  "senha", "password", "token", "secret", "key", "api_key",
  "cpf", "cpf_cnpj", "cnpj", "documento",
  "telefone", "phone", "whatsapp", "celular",
  "email", "e_mail",
  "endereco", "address", "rua", "logradouro",
  "rg", "cnh", "pis", "ctps",
]);

function maskPiiValue(key: string, value: unknown): unknown {
  const k = key.toLowerCase();
  if (PII_KEYS.has(k)) {
    if (typeof value === "string") {
      if (k.includes("cpf") || k.includes("cnpj") || k.includes("documento")) {
        const digits = value.replace(/\D/g, "");
        if (digits.length >= 11) return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
      }
      if (k.includes("telefone") || k.includes("phone") || k.includes("whatsapp") || k.includes("celular")) {
        const digits = value.replace(/\D/g, "");
        if (digits.length >= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}****-${digits.slice(-4)}`;
      }
      if (k.includes("email")) {
        const [local, domain] = value.split("@");
        if (domain && local.length > 1) return `${local[0]}***@${domain}`;
      }
    }
    return "***";
  }
  return value;
}

function formatMessage(level: LogLevel, module: string, message: string, data?: unknown): string {
  const prefix = `[${level.toUpperCase()}][${module}]`;
  if (data) {
    const safe = typeof data === "object" ? JSON.stringify(data, (key, value) => {
      return maskPiiValue(key, value);
    }) : String(data);
    return `${prefix} ${message} ${safe}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(module: string, message: string, data?: unknown) {
    if (IS_DEV) {
      console.debug(formatMessage("debug", module, message, data));
    }
  },
  info(module: string, message: string, data?: unknown) {
    if (IS_DEV) {
      console.info(formatMessage("info", module, message, data));
    }
  },
  warn(module: string, message: string, data?: unknown) {
    console.warn(formatMessage("warn", module, message, data));
  },
  error(module: string, message: string, data?: unknown) {
    console.error(formatMessage("error", module, message, data));
  },
};

export default logger;
