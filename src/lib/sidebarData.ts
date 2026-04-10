import {
  LayoutDashboard, Network, Radio, Briefcase, ClipboardList, Database,
  DollarSign, FileText, Car, FileSignature, Award, ShieldCheck,
  BarChart3, Users, Smartphone, Settings, UserPlus, Library, LucideIcon, Sparkles,
  FileCheck, Megaphone, Route, Umbrella,
} from "lucide-react";

export interface SidebarSubItem {
  title: string;
  path: string;
  icon?: LucideIcon;
  children?: SidebarSubItem[];
}

export interface SidebarItem {
  title: string;
  icon: LucideIcon;
  path: string;
  children?: SidebarSubItem[];
}

export const sidebarItems: SidebarItem[] = [
  {
    title: "Dashboard Executivo",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    title: "Torre de Controle",
    icon: Radio,
    path: "/torre-controle",
  },
  {
    title: "Gestão Comercial",
    icon: Briefcase,
    path: "/comercial",
    children: [
      { title: "Clientes", path: "/comercial?tab=clientes" },
      { title: "Tabela de Valores", path: "/comercial?tab=tabela-valores" },
      { title: "Orçamentos", path: "/comercial?tab=orcamentos" },
    ],
  },
  {
    title: "Cadastros Base",
    icon: Database,
    path: "/cadastros",
    children: [
      { title: "Prestadores", path: "/cadastros?tab=prestadores" },
      { title: "Análise de Documentos", path: "/cadastros?tab=analise-documentos" },
      { title: "Análise em Lote", path: "/cadastros?tab=analise-lote" },
      { title: "Status Documental", path: "/cadastros?tab=status-documental" },
      { title: "Unidades", path: "/cadastros?tab=unidades" },
      { title: "Locais (Bases/CDs)", path: "/cadastros?tab=locais" },
      { title: "Tipos de Veículo", path: "/cadastros?tab=veiculos" },
      { title: "Setores & CCs", path: "/cadastros?tab=setores" },
      { title: "Departamentos", path: "/cadastros?tab=departamentos" },
    ],
  },
  {
    title: "Apoio Operacional",
    icon: ClipboardList,
    path: "/operacao",
    children: [
      { title: "Ordens de Serviço", path: "/operacao?tab=os" },
      { title: "Escala", path: "/operacao?tab=escala" },
      { title: "Ocorrências", path: "/operacao?tab=ocorrencias" },
      { title: "Comprovantes/POD", path: "/operacao?tab=pod" },
      { title: "Roteirização", path: "/operacao?tab=roteirizacao" },
      { title: "Programação", path: "/operacao?tab=programacao" },
      { title: "Devoluções", path: "/operacao?tab=devolucoes" },
      { title: "Reentregas", path: "/operacao?tab=reentregas" },
    ],
  },
  {
    title: "Gestão de Frota",
    icon: Car,
    path: "/frota",
    children: [
      { title: "Veículos & Cavalos", path: "/frota?tab=veiculos" },
      { title: "Monitoramento de Combustíveis", path: "/combustiveis" },
      { title: "Manutenção", path: "/frota?tab=manutencao" },
      { title: "Abastecimento", path: "/frota?tab=abastecimento" },
      { title: "Docs & Multas", path: "/frota?tab=documentos" },
      { title: "Custos (Custeio)", path: "/frota?tab=custos" },
    ],
  },
  {
    title: "Financeiro Enterprise",
    icon: DollarSign,
    path: "/financeiro",
    children: [
      { title: "Dashboard Financeiro", path: "/financeiro?tab=dashboard" },
      { title: "Contas a Receber", path: "/financeiro?tab=receber" },
      { title: "Inadimplência", path: "/financeiro?tab=inadimplencia" },
      { title: "Contas a Pagar", path: "/financeiro?tab=pagar" },
      { title: "Fornecedores", path: "/financeiro?tab=pagar-fornecedores" },
      { title: "Fluxo de Caixa", path: "/financeiro?tab=fluxo" },
      { title: "DRE Gerencial", path: "/financeiro?tab=dre" },
      { title: "Plano de Contas", path: "/financeiro?tab=plano-contas" },
      { title: "Conciliação Bancária", path: "/financeiro?tab=conciliacao" },
      { title: "Pagamento em Lote (CNAB)", path: "/financeiro?tab=lotes" },
      { title: "Centro de Resultado", path: "/financeiro?tab=centro-resultado" },
      { title: "Provisões", path: "/financeiro?tab=provisoes" },
      { title: "Seguros Auto", path: "/financeiro?tab=seguros" },
      { title: "Contabilidade", path: "/financeiro?tab=contabilidade" },
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
    children: [
      { title: "Dashboard Relatórios", path: "/relatorios?tab=dashboard" },
      { title: "Extrato Operacional", path: "/relatorios?tab=extrato" },
      { title: "Faturamento por Cliente", path: "/relatorios?tab=faturamento" },
      { title: "Margem por Operação", path: "/relatorios?tab=margem" },
      { title: "Prestadores", path: "/relatorios?tab=prestadores" },
      { title: "Volume Expedido", path: "/relatorios?tab=volume" },
      { title: "Exportador Custom", path: "/relatorios?tab=exportador" },
    ],
  },
  { title: "Painel do Cliente", icon: Users, path: "/portal-cliente" },
  { title: "App Prestador", icon: Smartphone, path: "/app-prestador" },
  {
    title: "Governança e TI",
    icon: ShieldCheck,
    path: "/governanca",
    children: [
      { title: "Auditoria", path: "/governanca?tab=auditoria" },
      { title: "Histórico", path: "/governanca?tab=historico" },
      { title: "Permissões", path: "/governanca?tab=permissoes" },
      { title: "LGPD", path: "/governanca?tab=lgpd" },
    ],
  },
  {
    title: "API e Integrações",
    icon: Network,
    path: "/monitor-api",
    children: [
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
    children: [
      { title: "Geral", path: "/configuracoes?tab=geral" },
      { title: "Empresa", path: "/configuracoes?tab=empresa" },
      { title: "Acessos", path: "/configuracoes?tab=acessos" },
      { title: "Integrações", path: "/configuracoes?tab=integracoes" },
      { title: "Central de Comunicação", path: "/comunicacao", icon: Megaphone },
      { title: "IA & Automações", path: "/ia-automacoes", icon: Sparkles },
    ],
  },
];
