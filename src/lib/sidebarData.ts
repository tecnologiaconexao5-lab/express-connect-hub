import {
  LayoutDashboard, Radio, Briefcase, ClipboardList, Database,
  DollarSign, FileText, Car, FileSignature, Award,
  BarChart3, Users, Smartphone, Settings, UserPlus, Library, LucideIcon,
} from "lucide-react";

export interface SidebarSubItem {
  title: string;
  path: string;
}

export interface SidebarItem {
  title: string;
  icon: LucideIcon;
  path: string;
  children?: SidebarSubItem[];
}

export const sidebarItems: SidebarItem[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    children: [
      { title: "Executivo", path: "/dashboard?tab=executivo" },
      { title: "Operacional", path: "/dashboard?tab=operacional" },
      { title: "Comercial", path: "/dashboard?tab=comercial" },
      { title: "Financeiro", path: "/dashboard?tab=financeiro" },
      { title: "Alertas", path: "/dashboard?tab=alertas" },
    ],
  },
  {
    title: "Torre de Controle",
    icon: Radio,
    path: "/torre-controle",
    children: [
      { title: "Operações em Andamento", path: "/torre-controle?tab=operacoes" },
      { title: "Tracking", path: "/torre-controle?tab=tracking" },
      { title: "Timeline", path: "/torre-controle?tab=timeline" },
      { title: "Alertas", path: "/torre-controle?tab=alertas" },
      { title: "Mapa", path: "/torre-controle?tab=mapa" },
    ],
  },
  {
    title: "Comercial",
    icon: Briefcase,
    path: "/comercial",
    children: [
      { title: "CRM", path: "/comercial?tab=crm" },
      { title: "Orçamentos", path: "/comercial?tab=orcamentos" },
      { title: "Tabela de Valores", path: "/comercial?tab=tabela" },
      { title: "Simulador", path: "/comercial?tab=simulador" },
    ],
  },
  {
    title: "Operação",
    icon: ClipboardList,
    path: "/operacao",
    children: [
      { title: "Ordens de Serviço", path: "/operacao?tab=os" },
      { title: "Escala", path: "/operacao?tab=escala" },
      { title: "Ocorrências", path: "/operacao?tab=ocorrencias" },
      { title: "Comprovantes/POD", path: "/operacao?tab=pod" },
      { title: "Programação", path: "/operacao?tab=programacao" },
      { title: "Devoluções", path: "/operacao?tab=devolucoes" },
      { title: "Reentregas", path: "/operacao?tab=reentregas" },
    ],
  },
  {
    title: "Cadastros",
    icon: Database,
    path: "/cadastros",
    children: [
      { title: "Clientes", path: "/cadastros/clientes" },
      { title: "Prestadores", path: "/cadastros/prestadores" },
      { title: "Veículos", path: "/cadastros/veiculos" },
      { title: "Regiões", path: "/cadastros/auxiliares?tab=regioes" },
      { title: "Filiais", path: "/cadastros/auxiliares?tab=filiais" },
      { title: "Unidades", path: "/cadastros/auxiliares?tab=unidades" },
      { title: "Centros de Custo", path: "/cadastros/auxiliares?tab=centros-custo" },
      { title: "Tabelas Auxiliares", path: "/cadastros/auxiliares?tab=tabelas" },
    ],
  },
  {
    title: "Financeiro",
    icon: DollarSign,
    path: "/financeiro",
    children: [
      { title: "Faturamento", path: "/financeiro?tab=faturamento" },
      { title: "Contas a Receber", path: "/financeiro?tab=receber" },
      { title: "Contas a Pagar", path: "/financeiro?tab=pagar" },
      { title: "Pagamento Prestadores", path: "/financeiro?tab=prestadores" },
      { title: "Fluxo de Caixa", path: "/financeiro?tab=fluxo" },
      { title: "DRE", path: "/financeiro?tab=dre" },
      { title: "Conciliação", path: "/financeiro?tab=conciliacao" },
    ],
  },
  {
    title: "Fiscal",
    icon: FileText,
    path: "/fiscal",
    children: [
      { title: "CT-e", path: "/fiscal?tab=cte" },
      { title: "MDF-e", path: "/fiscal?tab=mdfe" },
      { title: "CIOT", path: "/fiscal?tab=ciot" },
      { title: "XML/PDF", path: "/fiscal?tab=xml-pdf" },
      { title: "Parametrizações", path: "/fiscal?tab=parametrizacoes" },
    ],
  },
  {
    title: "Frota",
    icon: Car,
    path: "/frota",
    children: [
      { title: "Manutenção", path: "/frota?tab=manutencao" },
      { title: "Abastecimento", path: "/frota?tab=abastecimento" },
      { title: "Documentos", path: "/frota?tab=documentos" },
      { title: "Seguros", path: "/frota?tab=seguros" },
      { title: "Custos por Veículo", path: "/frota?tab=custos" },
    ],
  },
  {
    title: "Recrutamento",
    icon: UserPlus,
    path: "/recrutamento",
    children: [
      { title: "Captação", path: "/recrutamento?tab=captacao" },
      { title: "Triagem", path: "/recrutamento?tab=triagem" },
      { title: "Banco de Talentos", path: "/recrutamento?tab=banco" },
      { title: "Homologação", path: "/recrutamento?tab=homologacao" },
      { title: "Convocação", path: "/recrutamento?tab=convocacao" },
      { title: "Histórico", path: "/recrutamento?tab=historico" },
    ],
  },
  {
    title: "Contratos",
    icon: FileSignature,
    path: "/contratos",
    children: [
      { title: "Clientes", path: "/contratos?tab=clientes" },
      { title: "Prestadores", path: "/contratos?tab=prestadores" },
      { title: "Aditivos", path: "/contratos?tab=aditivos" },
      { title: "Vigências", path: "/contratos?tab=vigencias" },
    ],
  },
  {
    title: "SLA e Qualidade",
    icon: Award,
    path: "/sla",
    children: [
      { title: "SLA por Cliente", path: "/sla?tab=cliente" },
      { title: "NPS", path: "/sla?tab=nps" },
      { title: "Taxa de Entrega", path: "/sla?tab=entrega" },
      { title: "Performance", path: "/sla?tab=performance" },
    ],
  },
  {
    title: "Relatórios",
    icon: BarChart3,
    path: "/relatorios",
    children: [
      { title: "Operacionais", path: "/relatorios?tab=operacionais" },
      { title: "Comerciais", path: "/relatorios?tab=comerciais" },
      { title: "Financeiros", path: "/relatorios?tab=financeiros" },
      { title: "Fiscais", path: "/relatorios?tab=fiscais" },
    ],
  },
  {
    title: "Biblioteca",
    icon: Library,
    path: "/biblioteca",
    children: [
      { title: "Operacional", path: "/biblioteca?tab=operacional" },
      { title: "Prestador", path: "/biblioteca?tab=prestador" },
      { title: "Cliente", path: "/biblioteca?tab=cliente" },
      { title: "Modelos", path: "/biblioteca?tab=modelos" },
    ],
  },
  { title: "Painel do Cliente", icon: Users, path: "/portal-cliente" },
  { title: "App Prestador", icon: Smartphone, path: "/app-prestador" },
  {
    title: "Configurações",
    icon: Settings,
    path: "/configuracoes",
    children: [
      { title: "Usuários", path: "/configuracoes?tab=usuarios" },
      { title: "Perfis", path: "/configuracoes?tab=perfis" },
      { title: "Parâmetros", path: "/configuracoes?tab=parametros" },
      { title: "Integrações", path: "/configuracoes?tab=integracoes" },
      { title: "Templates", path: "/configuracoes?tab=templates" },
    ],
  },
];
