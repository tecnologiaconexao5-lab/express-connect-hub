import {
  LayoutDashboard, Network, Radio, Briefcase, ClipboardList, Database,
  DollarSign, FileText, Car, FileSignature, Award, ShieldCheck,
  BarChart3, Users, Smartphone, Settings, UserPlus, Library, LucideIcon, Sparkles,
  Megaphone, Umbrella, Zap, BrainCircuit, Activity, MessageSquare
} from "lucide-react";

import { podeAcessar } from "./permissoes";
import type { User } from "./auth";
import { Building2 } from "lucide-react";

export interface SidebarSubItem {
  title: string;
  path: string;
  icon?: LucideIcon;
  modulo?: string;
  children?: SidebarSubItem[];
}

export interface SidebarItem {
  title: string;
  icon: LucideIcon;
  path: string;
  modulo?: string;
  children?: SidebarSubItem[];
}

const checkPermission = (modulo: string | undefined, user: User): boolean => {
  if (!modulo) return true;
  return podeAcessar(modulo, "ver", user);
};

export const getVisibleSidebarItems = (user: User | null): SidebarItem[] => {
  if (!user) return [];
  
  return sidebarItems
    .map(item => {
      const visibleChildren = item.children?.filter(child => checkPermission(child.modulo, user));
      const hasVisibleChildren = visibleChildren && visibleChildren.length > 0;
      
      // Se o item pai tem filhos visíveis, permite ver o pai mesmo que o modulo específico do pai seja restritivo
      const isParentVisible = hasVisibleChildren || checkPermission(item.modulo, user);
      
      if (!isParentVisible) return null;
      
      return {
        ...item,
        children: visibleChildren
      };
    })
    .filter((item): item is SidebarItem => item !== null);
};

export const sidebarItems: SidebarItem[] = [
  {
    title: "Dashboard Executivo",
    icon: LayoutDashboard,
    path: "/dashboard",
    modulo: "dashboard",
  },
  {
    title: "Torre de Controle",
    icon: Radio,
    path: "/torre-controle",
    modulo: "ordens_servico",
  },
  {
    title: "Gestão Comercial",
    icon: Briefcase,
    path: "/comercial",
    modulo: "clientes",
    children: [
      { title: "Orçamentos", path: "/comercial?tab=orcamentos", modulo: "clientes" },
      { title: "CRM", path: "/comercial?tab=crm", modulo: "clientes" },
      { title: "Marketing", path: "/comercial?tab=marketing", modulo: "clientes" },
      { title: "Propostas", path: "/comercial?tab=propostas", modulo: "clientes" },
      { title: "Tabela de Valores", path: "/comercial?tab=tabela", modulo: "clientes" },
      { title: "Simulador de Frete", path: "/comercial?tab=simulador", modulo: "clientes" },
      { title: "Automação Comercial", path: "/comercial?tab=automacao", modulo: "clientes" },
    ],
  },
  {
    title: "Cadastros Base",
    icon: Database,
    path: "/cadastros",
    children: [
      { title: "Clientes", path: "/cadastros/clientes", modulo: "clientes" },
      { title: "Prestadores", path: "/cadastros/prestadores", modulo: "prestadores" },
      { title: "Fornecedores", path: "/cadastros/fornecedores", modulo: "cadastros_auxiliares" },
      { title: "Análise de Documentos", path: "/cadastros/analise-documentos", modulo: "prestadores" },
      { title: "Veículos", path: "/cadastros/veiculos", modulo: "cadastros_auxiliares" },
      { title: "Regiões", path: "/cadastros/auxiliares?tab=regioes", modulo: "cadastros_auxiliares" },
      { title: "Filiais", path: "/cadastros/auxiliares?tab=filiais", modulo: "cadastros_auxiliares" },
      { title: "Unidades", path: "/cadastros/auxiliares?tab=unidades", modulo: "cadastros_auxiliares" },
      { title: "Centros de Custo", path: "/cadastros/auxiliares?tab=centros-custo", modulo: "cadastros_auxiliares" },
      { title: "Tabelas Auxiliares", path: "/cadastros/auxiliares?tab=tabelas", modulo: "cadastros_auxiliares" },
    ],
  },
  {
    title: "Apoio Operacional",
    icon: ClipboardList,
    path: "/operacao",
    modulo: "ordens_servico",
    children: [
      { title: "Ordens de Serviço", path: "/operacao?tab=os", modulo: "ordens_servico" },
      { title: "Solicitações Cliente", path: "/operacao?tab=solicitacoes", modulo: "ordens_servico" },
      { title: "Programação Operacional", path: "/operacao?tab=escala", modulo: "ordens_servico" },
      { title: "Roteirização", path: "/operacao?tab=roteirizacao", modulo: "ordens_servico" },
      { title: "Ocorrências", path: "/operacao?tab=ocorrencias", modulo: "ordens_servico" },
      { title: "Comprovantes/POD", path: "/operacao?tab=pod", modulo: "ordens_servico" },
      { title: "Comprovantes de Entrega", path: "/comprovantes", modulo: "ordens_servico" },
      { title: "Devoluções", path: "/operacao?tab=devolucoes", modulo: "ordens_servico" },
      { title: "Reentregas", path: "/operacao?tab=reentregas", modulo: "ordens_servico" },
      { title: "Controle de Pátio", path: "/controle-patio", modulo: "ordens_servico" },
    ],
  },
  {
    title: "Gestão de Frota",
    icon: Car,
    path: "/frota",
    modulo: "frota",
    children: [
      { title: "Veículos & Cavalos", path: "/cadastros/veiculos", modulo: "frota" },
      { title: "Monitoramento de Combustíveis", path: "/combustiveis", modulo: "frota" },
      { title: "Manutenção", path: "/frota?tab=manutencao", modulo: "frota" },
      { title: "Abastecimento", path: "/frota?tab=abastecimento", modulo: "frota" },
      { title: "Docs & Multas", path: "/frota?tab=documentos", modulo: "frota" },
      { title: "Custos (Custeio)", path: "/frota?tab=custos", modulo: "frota" },
    ],
  },
  {
    title: "Gestão Financeira",
    icon: DollarSign,
    path: "/financeiro",
    modulo: "financeiro",
    children: [
      { title: "Dashboard Financeiro", path: "/financeiro?tab=dashboard", modulo: "financeiro" },
      { title: "Pendências", path: "/financeiro?tab=pendencias", modulo: "financeiro" },
      { title: "Conferência", path: "/financeiro?tab=conferencia", modulo: "financeiro" },
      { title: "Faturas", path: "/financeiro?tab=faturas", modulo: "financeiro" },
      { title: "Contas a Receber", path: "/financeiro?tab=receber", modulo: "financeiro" },
      { title: "Inadimplência", path: "/financeiro?tab=inadimplencia", modulo: "financeiro" },
      { title: "Relatório de Faturamento", path: "/financeiro?tab=relatorio-faturamento", modulo: "financeiro" },
      { title: "Contas a Pagar", path: "/financeiro?tab=pagar", modulo: "financeiro" },
      { title: "Pag. Prestadores", path: "/financeiro?tab=pagamento-prestadores", modulo: "financeiro" },
      { title: "Fluxo de Caixa", path: "/financeiro?tab=fluxo", modulo: "financeiro" },
      { title: "Contas & Caixas", path: "/financeiro?tab=contas-caixas", modulo: "financeiro" },
      { title: "Conciliação Bancária", path: "/financeiro?tab=conciliacao", modulo: "financeiro" },
      { title: "Pagamento em Lote (CNAB)", path: "/financeiro?tab=lotes", modulo: "financeiro" },
      { title: "DRE Gerencial", path: "/financeiro?tab=dre", modulo: "financeiro" },
      { title: "Margem por OS", path: "/financeiro?tab=margem-os", modulo: "financeiro" },
      { title: "Relatórios Financeiros", path: "/financeiro?tab=relatorios", modulo: "financeiro" },
      { title: "Recibos", path: "/financeiro?tab=recibos", modulo: "financeiro" },
      { title: "Plano de Contas", path: "/financeiro?tab=plano-contas", modulo: "financeiro" },
      { title: "Config. Financeiras", path: "/financeiro?tab=config-financeira", modulo: "financeiro" },
      { title: "Regras por Cliente", path: "/financeiro?tab=regras-cliente", modulo: "financeiro" },
      { title: "Seguros Auto", path: "/financeiro?tab=seguros-auto", modulo: "financeiro" },
      { title: "Contabilidade", path: "/financeiro?tab=contabilidade", modulo: "financeiro" },
      { title: "Margem (legado)", path: "/financeiro?tab=margem", modulo: "financeiro" },
      { title: "Rentabilidade", path: "/financeiro?tab=rentabilidade", modulo: "financeiro" },
    ],
  },
  {
    title: "Fiscal & Faturamento",
    icon: FileText,
    path: "/fiscal",
    children: [
      { title: "Dashboard Fiscal", path: "/fiscal?tab=dashboard" },
      { title: "Emissão de CT-e", path: "/fiscal?tab=cte" },
      { title: "Emissão de MDF-e", path: "/fiscal?tab=mdfe" },
      { title: "NFS-e", path: "/fiscal?tab=nfse" },
      { title: "Emitente Fiscal", path: "/fiscal?tab=emitente" },
      { title: "Regras CT-e", path: "/fiscal?tab=regras" },
      { title: "Regras NFS-e", path: "/fiscal?tab=regras_nfse" },
      { title: "Documentos Fiscais", path: "/fiscal?tab=documentos" },
      { title: "Focus NFe", path: "/fiscal?tab=focus" },
      { title: "Auditoria Fiscal", path: "/fiscal?tab=auditoria" },
    ],
  },
  {
    title: "Contratos Automáticos",
    icon: FileSignature,
    path: "/contratos",
    children: [
      { title: "Construtor de Modelos", path: "/contratos?tab=modelos" },
      { title: "Gerados / Assinados", path: "/contratos?tab=gerados" },
      { title: "Configurações", path: "/contratos?tab=configuracoes" },
    ],
  },
  {
    title: "Recrutamento Inteligente",
    icon: UserPlus,
    path: "/recrutamento",
    children: [
      { title: "Dashboard", path: "/recrutamento" },
      { title: "Pipeline Enterprise", path: "/recrutamento?section=pipeline-kanban" },
      { title: "Operações", path: "/recrutamento?section=operacoes" },
      { title: "Nova Operação", path: "/recrutamento?section=nova-operacao" },
      { title: "Prestadores", path: "/recrutamento?section=prestadores" },
      { title: "CRM Logístico", path: "/recrutamento?section=crm" },
      { title: "Central Documental", path: "/recrutamento?section=documentos" },
      { title: "IA Operacional", path: "/recrutamento?section=ia" },
      { title: "Onboarding", path: "/recrutamento?section=onboarding" },
      { title: "Score", path: "/recrutamento?section=score" },
      { title: "Automações", path: "/recrutamento?section=automacoes" },
      { title: "Portal do Prestador", path: "/recrutamento?section=portal" },
      { title: "Prestadores Aptos", path: "/recrutamento?section=operacionais" },
      { title: "Banco de Talentos", path: "/recrutamento?section=talentos" },
    ],
  },
  {
    title: "Central de Robôs IA",
    icon: BrainCircuit,
    path: "/central-ia",
    children: [
      { title: "Central", path: "/central-ia" },
      { title: "Monitor Robô Recrutamento", path: "/robo-recrutamento-monitor" },
    ],
  },
  {
    title: "Biblioteca Global",
    icon: Library,
    path: "/biblioteca",
    children: [
      { title: "Central Operacional", path: "/biblioteca?tab=operacional" },
      { title: "Pasta do Prestador (App)", path: "/biblioteca?tab=prestador" },
      { title: "Pasta do Cliente (Portal)", path: "/biblioteca?tab=cliente" },
      { title: "Modelos e Templates", path: "/biblioteca?tab=modelos" },
      { title: "Mensagens Rápidas", path: "/biblioteca?tab=mensagens" },
      { title: "Fluxo de Recrutamento", path: "/biblioteca?tab=fluxo" },
    ],
  },
  {
    title: "SLA e Qualidade",
    icon: Award,
    path: "/sla",
    children: [
      { title: "Indicadores e Dashboard", path: "/sla?tab=cliente" },
      { title: "SLA por Cliente", path: "/sla?tab=nps" },
      { title: "SLA por Operação", path: "/sla?tab=entrega" },
      { title: "Perf. Prestador", path: "/sla?tab=performance" },
    ],
  },
  {
    title: "Seguros e Risco",
    icon: Umbrella,
    path: "/seguros",
    children: [
      { title: "Configuração Geral", path: "/seguros?tab=configuracao" },
      { title: "Apólices Transportador", path: "/seguros?tab=apolices" },
      { title: "Regras por Cliente", path: "/seguros?tab=regras-cliente" },
      { title: "Regras de Cálculo", path: "/seguros?tab=regras-calculo" },
      { title: "Alertas e Painel", path: "/seguros?tab=alertas" },
      { title: "Histórico Sinistros", path: "/seguros?tab=sinistros" },
    ],
  },
  {
    title: "Relatórios Operacionais",
    icon: BarChart3,
    path: "/relatorios",
    modulo: "relatorios",
    children: [
      { title: "Extrato Operacional", path: "/relatorios?tab=extrato", modulo: "relatorios" },
      { title: "Faturamento por Cliente", path: "/relatorios?tab=faturamento", modulo: "relatorios" },
      { title: "Margem por Operação", path: "/relatorios?tab=margem", modulo: "relatorios" },
      { title: "Prestadores", path: "/relatorios?tab=prestadores", modulo: "relatorios" },
    ],
  },
    {
    title: "Comunicação Inteligente",
    icon: MessageSquare,
    path: "/central-comunicacao",
    children: [
      { title: "Central de Comunicação", path: "/central-comunicacao", icon: MessageSquare },
      { title: "Histórico de Mensagens", path: "/comunicacao", icon: Megaphone },
    ],
  },
  {
    title: "Painel do Cliente", icon: Users, path: "/portal-cliente" },
  { title: "Admin App Prestador", icon: Smartphone, path: "/app-prestador" },
  {
    title: "Governança e TI",
    icon: ShieldCheck,
    path: "/governanca",
    modulo: "configuracoes",
    children: [
      { title: "Auditoria", path: "/governanca?tab=auditoria", modulo: "configuracoes" },
      { title: "Histórico", path: "/governanca?tab=historico", modulo: "configuracoes" },
      { title: "Permissões", path: "/governanca?tab=permissoes", modulo: "configuracoes" },
      { title: "LGPD", path: "/governanca?tab=lgpd", modulo: "configuracoes" },
      { title: "Empresas", path: "/admin/tenants", modulo: "admin_tenants", icon: Building2 },
      { title: "Central de Robôs", path: "/central-ia", icon: BrainCircuit },
    ],
  },
  {
    title: "API e Integrações",
    icon: Network,
    path: "/monitor-api",
    children: [
      { title: "Integrações TMS", path: "/integracoes", icon: Zap },
      { title: "Monitor de Conectores", path: "/admin/conectores", icon: Activity },
      { title: "Monitor Core", path: "/monitor-api?tab=monitor" },
      { title: "SEFAZ Nacional", path: "/monitor-api?tab=sefaz" },
      { title: "ANTT / CIOT", path: "/monitor-api?tab=ciot" },
      { title: "Prefeituras NFSe", path: "/monitor-api?tab=nfse" },
    ],
  },
  {
    title: "Configurações",
    icon: Settings,
    path: "/configuracoes",
    modulo: "configuracoes",
    children: [
      { title: "Geral", path: "/configuracoes?tab=geral", modulo: "configuracoes" },
      { title: "Empresa", path: "/configuracoes?tab=empresa" },
      { title: "Acessos", path: "/configuracoes?tab=acessos" },
      { title: "Integrações", path: "/configuracoes?tab=integracoes" },
      { title: "Integrações Legadas", path: "/configuracoes?tab=central-integracoes" },
      { title: "Central de Comunicação", path: "/comunicacao", icon: Megaphone },
      { title: "Central de Robôs", path: "/central-ia", icon: BrainCircuit },
      { title: "IA & Automações (Legado)", path: "/ia-automacoes", icon: Sparkles },
    ],
  },
];
