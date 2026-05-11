import {
  LayoutDashboard, Network, Radio, Briefcase, ClipboardList, Database,
  DollarSign, FileText, Car, FileSignature, Award, ShieldCheck,
  BarChart3, Users, Smartphone, Settings, UserPlus, Library, LucideIcon, Sparkles,
  FileCheck, Megaphone, Route, Umbrella, Zap, BrainCircuit
} from "lucide-react";

import { getUser } from "./auth";
import { podeAcessar } from "./permissoes";

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

const checkPermission = (modulo?: string): boolean => {
  if (!modulo) return true;
  return podeAcessar(modulo, "ver");
};

export const getVisibleSidebarItems = (): SidebarItem[] => {
  const user = getUser();
  
  return sidebarItems.filter(item => checkPermission(item.modulo)).map(item => ({
    ...item,
    children: item.children?.filter(child => checkPermission(child.modulo))
  }));
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
      { title: "Clientes", path: "/comercial?tab=clientes", modulo: "clientes" },
      { title: "Tabela de Valores", path: "/comercial?tab=tabela-valores", modulo: "clientes" },
      { title: "Orçamentos", path: "/comercial?tab=orcamentos", modulo: "clientes" },
    ],
  },
  {
    title: "Cadastros Base",
    icon: Database,
    path: "/cadastros",
    modulo: "prestadores",
    children: [
      { title: "Prestadores", path: "/cadastros?tab=prestadores", modulo: "prestadores" },
      { title: "Análise de Documentos", path: "/cadastros?tab=analise-documentos", modulo: "prestadores" },
      { title: "Análise em Lote", path: "/cadastros?tab=analise-lote", modulo: "prestadores" },
      { title: "Status Documental", path: "/cadastros?tab=status-documental", modulo: "prestadores" },
      { title: "Unidades", path: "/cadastros?tab=unidades", modulo: "cadastros_auxiliares" },
      { title: "Locais (Bases/CDs)", path: "/cadastros?tab=locais", modulo: "cadastros_auxiliares" },
      { title: "Tipos de Veículo", path: "/cadastros?tab=veiculos", modulo: "cadastros_auxiliares" },
      { title: "Setores & CCs", path: "/cadastros?tab=setores", modulo: "cadastros_auxiliares" },
      { title: "Departamentos", path: "/cadastros?tab=departamentos", modulo: "cadastros_auxiliares" },
    ],
  },
  {
    title: "Apoio Operacional",
    icon: ClipboardList,
    path: "/operacao",
    modulo: "ordens_servico",
    children: [
      { title: "Ordens de Serviço", path: "/operacao?tab=os", modulo: "ordens_servico" },
      { title: "Escala", path: "/operacao?tab=escala", modulo: "ordens_servico" },
      { title: "Ocorrências", path: "/operacao?tab=ocorrencias", modulo: "ordens_servico" },
      { title: "Comprovantes/POD", path: "/operacao?tab=pod", modulo: "ordens_servico" },
      { title: "Roteirização", path: "/operacao?tab=roteirizacao", modulo: "ordens_servico" },
      { title: "Programação", path: "/operacao?tab=programacao", modulo: "ordens_servico" },
      { title: "Devoluções", path: "/operacao?tab=devolucoes", modulo: "ordens_servico" },
      { title: "Reentregas", path: "/operacao?tab=reentregas", modulo: "ordens_servico" },
    ],
  },
  {
    title: "Gestão de Frota",
    icon: Car,
    path: "/frota",
    modulo: "frota",
    children: [
      { title: "Veículos & Cavalos", path: "/frota?tab=veiculos", modulo: "frota" },
      { title: "Monitoramento de Combustíveis", path: "/combustiveis", modulo: "frota" },
      { title: "Manutenção", path: "/frota?tab=manutencao", modulo: "frota" },
      { title: "Abastecimento", path: "/frota?tab=abastecimento", modulo: "frota" },
      { title: "Docs & Multas", path: "/frota?tab=documentos", modulo: "frota" },
      { title: "Custos (Custeio)", path: "/frota?tab=custos", modulo: "frota" },
    ],
  },
  {
    title: "Financeiro Enterprise",
    icon: DollarSign,
    path: "/financeiro",
    modulo: "financeiro",
    children: [
      { title: "Dashboard Financeiro", path: "/financeiro?tab=dashboard", modulo: "financeiro" },
      { title: "Contas a Receber", path: "/financeiro?tab=receber", modulo: "financeiro" },
      { title: "Inadimplência", path: "/financeiro?tab=inadimplencia", modulo: "financeiro" },
      { title: "Contas a Pagar", path: "/financeiro?tab=pagar", modulo: "financeiro" },
      { title: "Fornecedores", path: "/financeiro?tab=pagar-fornecedores", modulo: "financeiro" },
      { title: "Fluxo de Caixa", path: "/financeiro?tab=fluxo", modulo: "financeiro" },
      { title: "DRE Gerencial", path: "/financeiro?tab=dre", modulo: "financeiro" },
      { title: "Plano de Contas", path: "/financeiro?tab=plano-contas", modulo: "financeiro" },
      { title: "Conciliação Bancária", path: "/financeiro?tab=conciliacao", modulo: "financeiro" },
      { title: "Pagamento em Lote (CNAB)", path: "/financeiro?tab=lotes", modulo: "financeiro" },
      { title: "Centro de Resultado", path: "/financeiro?tab=centro-resultado", modulo: "financeiro" },
      { title: "Provisões", path: "/financeiro?tab=provisoes", modulo: "financeiro" },
      { title: "Seguros Auto", path: "/financeiro?tab=seguros", modulo: "financeiro" },
      { title: "Contabilidade", path: "/financeiro?tab=contabilidade", modulo: "financeiro" },
    ],
  },
  {
    title: "Fiscal & Faturamento",
    icon: FileText,
    path: "/fiscal",
    children: [
      { title: "Emissão de CT-e", path: "/fiscal?tab=cte" },
      { title: "Emissão de MDF-e", path: "/fiscal?tab=mdfe" },
      { title: "Lotes de Faturamento", path: "/fiscal?tab=fechamento" },
      { title: "Integração Contábil", path: "/fiscal?tab=xmls" },
    ],
  },
  {
    title: "Contratos Automáticos",
    icon: FileSignature,
    path: "/contratos",
    children: [
      { title: "Construtor de Modelos", path: "/contratos?tab=modelos" },
      { title: "Gerados / Assinados", path: "/contratos?tab=gerados" },
      { title: "Anexos & Evidências", path: "/contratos?tab=anexos" },
      { title: "Políticas GLOBAIS", path: "/contratos?tab=configs" },
    ],
  },
  {
    title: "Recrutamento Expresso",
    icon: UserPlus,
    path: "/recrutamento",
    children: [
      { title: "Operações", path: "/recrutamento?tab=operacoes" },
      { title: "Nova Operação", path: "/recrutamento?tab=nova-operacao" },
      { title: "Indicadores RI", path: "/recrutamento?tab=indicadores-ri" },
      { title: "Disparos WhatsApp", path: "/recrutamento?tab=disparos" },
      { title: "WhatsApp IA Prestadores", path: "/recrutamento?tab=whatsapp-ia" },
      { title: "Banco Motoristas", path: "/recrutamento?tab=motoristas" },
      { title: "Mural Captação (Vagas)", path: "/recrutamento?tab=vagas" },
      { title: "Funil de Triagem", path: "/recrutamento?tab=triagem" },
      { title: "Homologações", path: "/recrutamento?tab=homologacoes" },
      { title: "Banco Talentos", path: "/recrutamento?tab=banco" },
    ],
  },
  {
    title: "Biblioteca Global",
    icon: Library,
    path: "/biblioteca",
    children: [
      { title: "Repositórios/Doc", path: "/biblioteca?tab=arquivos" },
      { title: "Manuais Operação", path: "/biblioteca?tab=manuais" },
      { title: "Manuais Prestador", path: "/biblioteca?tab=onboarding" },
    ],
  },
  {
    title: "SLA e Qualidade",
    icon: Award,
    path: "/sla",
    children: [
      { title: "Indicadores Gerais", path: "/sla?tab=cliente" },
      { title: "NPS e Confiança", path: "/sla?tab=nps" },
      { title: "Desempenho Rota", path: "/sla?tab=entrega" },
      { title: "Ranking Prestadores", path: "/sla?tab=performance" },
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
    title: "Relatórios Enterprise",
    icon: BarChart3,
    path: "/relatorios",
    modulo: "relatorios",
    children: [
      { title: "Dashboard Relatórios", path: "/relatorios?tab=dashboard", modulo: "relatorios" },
      { title: "Extrato Operacional", path: "/relatorios?tab=extrato", modulo: "relatorios" },
      { title: "Faturamento por Cliente", path: "/relatorios?tab=faturamento", modulo: "relatorios" },
      { title: "Margem por Operação", path: "/relatorios?tab=margem", modulo: "relatorios" },
      { title: "Prestadores", path: "/relatorios?tab=prestadores", modulo: "relatorios" },
      { title: "Volume Expedido", path: "/relatorios?tab=volume", modulo: "relatorios" },
      { title: "Exportador Custom", path: "/relatorios?tab=exportador", modulo: "relatorios" },
    ],
  },
  { title: "Painel do Cliente", icon: Users, path: "/portal-cliente" },
  { title: "App Prestador", icon: Smartphone, path: "/app-prestador" },
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
      { title: "IA & Automação", path: "/ia-central-automacao", icon: BrainCircuit },
    ],
  },
  {
    title: "API e Integrações",
    icon: Network,
    path: "/monitor-api",
    children: [
      { title: "Integrações TMS", path: "/integracoes", icon: Zap },
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
      { title: "IA & Automações", path: "/ia-automacoes", icon: Sparkles },
    ],
  },
];
