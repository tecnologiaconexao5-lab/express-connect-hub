export type UserRole = "admin" | "operador" | "cliente" | "prestador";

export interface User {
  email: string;
  name: string;
  role: UserRole;
  unit: string;
}

const DEMO_USERS: Record<string, { password: string; user: User }> = {
  "admin@conexaoexpress.com.br": {
    password: "admin123",
    user: { email: "admin@conexaoexpress.com.br", name: "Administrador", role: "admin", unit: "Matriz São Paulo" },
  },
  "operador@conexaoexpress.com.br": {
    password: "oper123",
    user: { email: "operador@conexaoexpress.com.br", name: "Operador", role: "operador", unit: "Filial Campinas" },
  },
  "cliente@empresa.com.br": {
    password: "cli123",
    user: { email: "cliente@empresa.com.br", name: "Cliente Corp", role: "cliente", unit: "Portal Cliente" },
  },
  "prestador@logistica.com.br": {
    password: "prest123",
    user: { email: "prestador@logistica.com.br", name: "Parceiro Log", role: "prestador", unit: "App Prestador" },
  },
};

export function login(email: string, password: string): User | null {
  const entry = DEMO_USERS[email];
  if (entry && entry.password === password) {
    localStorage.setItem("tms_user", JSON.stringify(entry.user));
    return entry.user;
  }
  return null;
}

export function getUser(): User | null {
  const raw = localStorage.getItem("tms_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function logout() {
  localStorage.removeItem("tms_user");
}

export function getRedirectPath(role: UserRole): string {
  switch (role) {
    case "admin": return "/dashboard";
    case "operador": return "/operacao";
    case "cliente": return "/portal-cliente";
    case "prestador": return "/app-prestador";
  }
}
