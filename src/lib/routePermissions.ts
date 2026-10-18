import type { UserRole } from "./auth";

export interface RoutePermission {
  modulo?: string;
  roles?: UserRole[];
}

export const ROUTE_PERMISSIONS: Record<string, RoutePermission> = {
  "/dashboard": { modulo: "dashboard" },
  "/torre-controle": { modulo: "ordens_servico" },
  "/roteirizador": { modulo: "ordens_servico" },
  "/comercial": { modulo: "clientes" },
  "/operacao": { modulo: "ordens_servico" },
  // MISSAO OS-MOBILE (item 4) — criação interna de OS pelo celular
  "/os-mobile": { modulo: "ordens_servico", roles: ["super_admin", "admin", "operador"] },
  "/comprovantes": { modulo: "ordens_servico" },
  "/cadastros": { modulo: "prestadores" },
  "/cadastros/prestadores": { modulo: "prestadores" },
  "/cadastros/prestadores/novo": { modulo: "prestadores" },
  "/cadastros/clientes": { modulo: "clientes" },
  "/cadastros/clientes/novo": { modulo: "clientes" },
  "/cadastros/veiculos": { modulo: "frota" },
  "/cadastros/auxiliares": { modulo: "cadastros_auxiliares" },
  "/cadastros/analise-documentos": { modulo: "prestadores" },
  "/financeiro": { modulo: "financeiro" },
  "/fiscal": { modulo: "financeiro", roles: ["super_admin", "admin", "financeiro", "operador"] },
  "/frota": { modulo: "frota" },
  "/combustiveis": { modulo: "frota" },
  "/recrutamento": { modulo: "prestadores", roles: ["super_admin", "admin", "operador"] },
  "/recrutamento/whatsapp-crm": { modulo: "prestadores", roles: ["super_admin", "admin", "operador"] },
  "/recrutamento/banco-talentos": { modulo: "prestadores", roles: ["super_admin", "admin", "operador"] },
  "/contratos": { modulo: "clientes" },
  "/sla": { modulo: "ordens_servico" },
  "/relatorios": { modulo: "relatorios" },
  "/biblioteca": { roles: ["super_admin", "admin", "operador", "financeiro", "comercial", "atendimento"] },
  "/governanca": { modulo: "configuracoes" },
  "/ia-automacoes": { modulo: "configuracoes", roles: ["super_admin", "admin"] },
  "/ia-central-automacao": { modulo: "configuracoes", roles: ["super_admin", "admin"] },
  "/central-ia": { modulo: "configuracoes", roles: ["super_admin", "admin"] },
  "/admin/tenants": { modulo: "admin_tenants", roles: ["super_admin", "admin"] },
  "/admin/conectores": { modulo: "admin_tenants", roles: ["super_admin", "admin"] },
  "/robo-recrutamento-monitor": { modulo: "prestadores", roles: ["super_admin", "admin", "operador"] },
  "/monitor-api": { modulo: "configuracoes", roles: ["super_admin", "admin"] },
  "/app-prestador": { roles: ["prestador", "motorista", "admin", "super_admin"] },
  "/configuracoes": { modulo: "configuracoes" },
  "/comunicacao": { modulo: "configuracoes", roles: ["super_admin", "admin", "comercial", "atendimento"] },
  "/seguros": { modulo: "prestadores", roles: ["super_admin", "admin", "operador"] },
  "/inteligencia": { modulo: "configuracoes", roles: ["super_admin", "admin"] },
  "/integracoes": { modulo: "configuracoes", roles: ["super_admin", "admin"] },
  "/mensagens-whatsapp": { modulo: "configuracoes", roles: ["super_admin", "admin", "comercial", "atendimento"] },
  "/central-comunicacao": { modulo: "configuracoes", roles: ["super_admin", "admin", "comercial", "atendimento"] },
  "/portal-cliente": { roles: ["cliente", "admin", "super_admin"] },
  "/portal-prestador": { roles: ["prestador", "admin", "super_admin"] },
  "/controle-patio": { modulo: "ordens_servico" },
};

export function getRoutePermission(path: string): RoutePermission {
  const normalized = path.split("?")[0];
  const exact = ROUTE_PERMISSIONS[normalized];
  if (exact) return exact;

  const prefix = Object.keys(ROUTE_PERMISSIONS).find(k => normalized.startsWith(k + "/") || normalized === k);
  if (prefix) return ROUTE_PERMISSIONS[prefix];

  return { modulo: "configuracoes", roles: [] };
}
