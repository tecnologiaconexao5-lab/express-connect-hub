import { create } from "zustand";

export type ConversationStatus = "nova" | "em_analise" | "aprovado" | "reprovado" | "bloqueado" | "treinamento" | "reativado";
export type QueuePriority = "baixa" | "media" | "alta" | "urgente";
export type MessageOrigin = "prestador" | "ia" | "humano" | "sistema" | "automacao";
export type CampaignStatus = "rascunho" | "agendada" | "enviando" | "concluida" | "cancelada";
export type AutomationTrigger = "novo_candidato" | "documento_pendente" | "documento_aprovado" | "inativo" | "aprovado_sem_ativar" | "treinamento_pendente" | "score_baixo" | "aniversario_cadastro" | "reativacao";
export type IntentClassification = "duvida" | "interesse" | "documentacao" | "reclamacao" | "cancelamento" | "parceria" | "operacao" | "treinamento" | "outro";

export interface ContatoWhatsApp {
  id: string;
  nome: string;
  telefone: string;
  avatar: string;
  status: ConversationStatus;
  tags: string[];
  score: number;
  ultimaMensagem: string;
  ultimaData: string;
  naoLidas: number;
  origem: string;
  regiao: string;
  tipoVeiculo: string;
  humanoAssumiu: boolean;
  iaAtiva: boolean;
  analiseSentimento?: "positivo" | "neutro" | "negativo";
  intentClassificada?: IntentClassification;
}

export interface MensagemCRM {
  id: string;
  conversaId: string;
  texto: string;
  origem: MessageOrigin;
  timestamp: string;
  lida: boolean;
  templateUsado?: string;
  metadata?: Record<string, unknown>;
}

export interface FilaItem {
  id: string;
  contatoId: string;
  prioridade: QueuePriority;
  atribuidoPara: string | null;
  status: "aguardando" | "em_atendimento" | "resolvido" | "transferido";
  entradaFila: string;
  tempoEspera: number;
  motivo: string;
}

export interface TemplateWhatsApp {
  id: string;
  nome: string;
  categoria: "boas_vindas" | "cobranca_documento" | "lembrete" | "aprovacao" | "bloqueio" | "treinamento" | "reativacao" | "operacao" | "followup" | "campanha";
  mensagem: string;
  variaveis: string[];
  usos: number;
  ultimoUso?: string;
}

export interface AutomacaoRegra {
  id: string;
  nome: string;
  trigger: AutomationTrigger;
  condicoes: Record<string, unknown>;
  acoes: { tipo: string; parametros: Record<string, unknown> }[];
  ativa: boolean;
  ultimaExecucao?: string;
  totalExecucoes: number;
}

export interface CampanhaWhatsApp {
  id: string;
  nome: string;
  templateId: string;
  filtros: Record<string, unknown>;
  status: CampaignStatus;
  agendadaPara?: string;
  enviadas: number;
  entregues: number;
  lidas: number;
  respondidas: number;
  criadaEm: string;
}

export interface LogConversa {
  id: string;
  contatoId: string;
  tipo: "ia_resposta" | "humano_assumiu" | "humano_liberou" | "automacao" | "template_enviado" | "erro" | "alerta";
  descricao: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppCRMState {
  conversas: ContatoWhatsApp[];
  mensagens: Record<string, MensagemCRM[]>;
  fila: FilaItem[];
  templates: TemplateWhatsApp[];
  automacoes: AutomacaoRegra[];
  campanhas: CampanhaWhatsApp[];
  logs: LogConversa[];
  conversaAtiva: string | null;
  searchQuery: string;
  filtroStatus: ConversationStatus | "todas";
  iaGlobalAtiva: boolean;

  setConversaAtiva: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setFiltroStatus: (s: ConversationStatus | "todas") => void;
  toggleIaGlobal: () => void;
  assumirConversa: (id: string) => void;
  liberarConversa: (id: string) => void;
  enviarMensagem: (conversaId: string, texto: string, origem: MessageOrigin, templateNome?: string) => void;
  classificarIntencao: (conversaId: string, intent: IntentClassification) => void;
  atualizarStatus: (conversaId: string, status: ConversationStatus) => void;
  adicionarTag: (conversaId: string, tag: string) => void;
  removerTag: (conversaId: string, tag: string) => void;
  adicionarFila: (contatoId: string, prioridade: QueuePriority, motivo: string) => void;
  atenderFila: (filaId: string) => void;
  transferirFila: (filaId: string, para: string) => void;
  adicionarTemplate: (template: TemplateWhatsApp) => void;
  usarTemplate: (templateId: string) => void;
  toggleAutomacao: (id: string) => void;
  criarCampanha: (campanha: CampanhaWhatsApp) => void;
  atualizarCampanha: (id: string, data: Partial<CampanhaWhatsApp>) => void;
}

const now = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

const mockContatos: ContatoWhatsApp[] = [
  { id: "c1", nome: "Carlos Silva", telefone: "5511999998888", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face", status: "nova", tags: ["motorista"], score: 72, ultimaMensagem: "Olá, vi que estão contratando motoristas. Tenho CNH D e disponibilidade imediata.", ultimaData: ago(5), naoLidas: 2, origem: "WhatsApp", regiao: "Grande SP", tipoVeiculo: "Truck", humanoAssumiu: false, iaAtiva: true, analiseSentimento: "positivo", intentClassificada: "interesse" },
  { id: "c2", nome: "Ana Oliveira", telefone: "5511988887777", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face", status: "em_analise", tags: ["carga_perigosa", "refrigerado"], score: 85, ultimaMensagem: "Enviei meus documentos. Conseguem verificar se está tudo certo?", ultimaData: ago(30), naoLidas: 0, origem: "WhatsApp", regiao: "Interior SP", tipoVeiculo: "Bitrem", humanoAssumiu: false, iaAtiva: true, analiseSentimento: "neutro", intentClassificada: "documentacao" },
  { id: "c3", nome: "Roberto Santos", telefone: "5511977776666", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face", status: "aprovado", tags: ["motorista", "treinado"], score: 91, ultimaMensagem: "Show! Já completei o treinamento online. Quando posso começar?", ultimaData: ago(120), naoLidas: 0, origem: "WhatsApp", regiao: "ABC Paulista", tipoVeiculo: "Carreta", humanoAssumiu: true, iaAtiva: false, analiseSentimento: "positivo", intentClassificada: "operacao" },
  { id: "c4", nome: "Maria Costa", telefone: "5511966665555", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face", status: "bloqueado", tags: ["documento_vencido"], score: 34, ultimaMensagem: "Meu seguro venceu, estou providenciando a renovação.", ultimaData: ago(180), naoLidas: 1, origem: "WhatsApp", regiao: "Litoral SP", tipoVeiculo: "VUC", humanoAssumiu: false, iaAtiva: true, analiseSentimento: "negativo", intentClassificada: "documentacao" },
  { id: "c5", nome: "João Pereira", telefone: "5511955554444", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face", status: "treinamento", tags: ["novato", "em_treinamento"], score: 45, ultimaMensagem: "Terminei o módulo 1 de direção defensiva.", ultimaData: ago(60), naoLidas: 0, origem: "WhatsApp", regiao: "Grande SP", tipoVeiculo: "Fiorino/Van", humanoAssumiu: false, iaAtiva: true, analiseSentimento: "neutro", intentClassificada: "treinamento" },
  { id: "c6", nome: "Patrícia Lima", telefone: "5511944443333", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face", status: "reativado", tags: ["motorista", "experiente"], score: 78, ultimaMensagem: "Estou livre novamente! Quero voltar a operar.", ultimaData: ago(15), naoLidas: 1, origem: "WhatsApp", regiao: "Rio de Janeiro", tipoVeiculo: "Truck", humanoAssumiu: false, iaAtiva: true, analiseSentimento: "positivo", intentClassificada: "interesse" },
  { id: "c7", nome: "Fernando Alves", telefone: "5511933332222", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face", status: "nova", tags: [], score: 55, ultimaMensagem: "Bom dia! Tenho interesse em fazer parte da frota. Como funciona?", ultimaData: ago(2), naoLidas: 1, origem: "WhatsApp", regiao: "Paraná", tipoVeiculo: "Rodotrem", humanoAssumiu: false, iaAtiva: true },
  { id: "c8", nome: "Lucia Mendes", telefone: "5511922221111", avatar: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=100&h=100&fit=crop&crop=face", status: "em_analise", tags: ["carga_seca"], score: 62, ultimaMensagem: "Anexei o CRLV e a CNH no formulário.", ultimaData: ago(45), naoLidas: 0, origem: "WhatsApp", regiao: "Belo Horizonte", tipoVeiculo: "Bitrem", humanoAssumiu: false, iaAtiva: true, intentClassificada: "documentacao" },
];

const mockMensagens: Record<string, MensagemCRM[]> = {
  c1: [
    { id: "m1", conversaId: "c1", texto: "Olá, vi que estão contratando motoristas. Tenho CNH D e disponibilidade imediata.", origem: "prestador", timestamp: ago(15), lida: true },
    { id: "m2", conversaId: "c1", texto: "Olá Carlos! 👋 Que bom que você nos procurou! Sim, estamos contratando. Vou te explicar rapidinho como funciona o processo...", origem: "ia", timestamp: ago(14), lida: true },
    { id: "m3", conversaId: "c1", texto: "Legal! O que preciso enviar primeiro?", origem: "prestador", timestamp: ago(10), lida: true },
    { id: "m4", conversaId: "c1", texto: "Ótima pergunta! Para começarmos, você vai precisar enviar:\n\n📄 CNH (frente e verso)\n📋 CRLV do veículo\n🏠 Comprovante de residência\n📸 Selfie segurando o documento\n\nConsegue enviar esses documentos agora?", origem: "ia", timestamp: ago(9), lida: true },
    { id: "m5", conversaId: "c1", texto: "Vou providenciar e já te mando!", origem: "prestador", timestamp: ago(5), lida: false },
    { id: "m6", conversaId: "c1", texto: "Perfeito! 💪 Assim que receber, nossa IA já faz a validação na hora. Qualquer dúvida é só chamar!", origem: "ia", timestamp: ago(4), lida: false },
  ],
  c2: [
    { id: "m7", conversaId: "c2", texto: "Olá, sou Ana Oliveira, motorista de bitrem. Gostaria de me cadastrar.", origem: "prestador", timestamp: ago(120), lida: true },
    { id: "m8", conversaId: "c2", texto: "Olá Ana! 😊 Seja bem-vinda! Vou te guiar no cadastro. Primeiro, me diga em qual região você atua.", origem: "ia", timestamp: ago(119), lida: true },
    { id: "m9", conversaId: "c2", texto: "Atuo no Interior de SP e triângulo mineiro.", origem: "prestador", timestamp: ago(90), lida: true },
    { id: "m10", conversaId: "c2", texto: "Excelente, região estratégica! 🎯 Já vou preparar seu perfil. Enquanto isso, você pode enviar seus documentos? CNH, CRLV e certidões.", origem: "ia", timestamp: ago(89), lida: true },
    { id: "m11", conversaId: "c2", texto: "Enviei meus documentos. Conseguem verificar se está tudo certo?", origem: "prestador", timestamp: ago(30), lida: true },
    { id: "m12", conversaId: "c2", texto: "Recebemos seus documentos! 📄 Nossa IA já está analisando. Assim que tivermos o resultado, aviso você. Geralmente leva alguns minutos.", origem: "ia", timestamp: ago(29), lida: true },
  ],
};

const mockTemplates: TemplateWhatsApp[] = [
  { id: "t1", nome: "Boas-vindas Candidato", categoria: "boas_vindas", mensagem: "Olá {{nome}}! 👋 Seja bem-vindo à Conexão Express!\n\nFicamos felizes com seu interesse em fazer parte da nossa rede de prestadores.\n\nPara iniciar seu cadastro, precisamos de:\n📄 CNH (frente e verso)\n📋 CRLV\n🏠 Comprovante de residência\n📸 Selfie\n\nPode enviar esses documentos agora?", variaveis: ["nome"], usos: 234, ultimoUso: ago(2) },
  { id: "t2", nome: "Cobrança Documentos", categoria: "cobranca_documento", mensagem: "Olá {{nome}}! ⏳ Identificamos que alguns documentos ainda estão pendentes:\n\n{{documentos_pendentes}}\n\nPara dar continuidade ao seu cadastro, é importante enviar o quanto antes. Posso ajudar com alguma dúvida?", variaveis: ["nome", "documentos_pendentes"], usos: 156, ultimoUso: ago(5) },
  { id: "t3", nome: "Lembrete Treinamento", categoria: "treinamento", mensagem: "Olá {{nome}}! 🎓 Seu treinamento {{treinamento_nome}} está disponível!\n\nAcesse e complete para desbloquear novas oportunidades.\n\nDuração: {{duracao}}\n\nVamos nessa? 💪", variaveis: ["nome", "treinamento_nome", "duracao"], usos: 89, ultimoUso: ago(15) },
  { id: "t4", nome: "Aprovação Cadastro", categoria: "aprovacao", mensagem: "Parabéns {{nome}}! 🎉 Seu cadastro foi APROVADO!\n\nSeu score é {{score}} — classificação {{classificacao}}.\n\nAgora você já pode receber operações. Fique de olho nas notificações!\n\nBem-vindo ao time! 🚛", variaveis: ["nome", "score", "classificacao"], usos: 67, ultimoUso: ago(10) },
  { id: "t5", nome: "Bloqueio Documento", categoria: "bloqueio", mensagem: "Olá {{nome}}! ⚠️ Identificamos que seu {{documento}} está vencido desde {{data_vencimento}}.\n\nPara sua segurança e para continuar operando, é necessário renovar o documento.\n\nApós a renovação, nos envie a foto do novo documento que liberamos seu acesso! ✅", variaveis: ["nome", "documento", "data_vencimento"], usos: 43, ultimoUso: ago(7) },
  { id: "t6", nome: "Reativação", categoria: "reativacao", mensagem: "Olá {{nome}}! 👋 Saudades!\n\nVimos que está há um tempo sem operar. Temos novas oportunidades na região {{regiao}} que podem se encaixar no seu perfil.\n\nQuer voltar a ativar? É rapidinho! 🚛", variaveis: ["nome", "regiao"], usos: 28, ultimoUso: ago(20) },
  { id: "t7", nome: "Follow-up Documentos", categoria: "followup", mensagem: "Olá {{nome}}! 😊 Tudo bem?\n\nFaz alguns dias que não falamos. Lembrando que seus documentos podem ser enviados a qualquer momento pelo WhatsApp.\n\nPrecisa de ajuda com algo? Estou aqui! 👍", variaveis: ["nome"], usos: 112, ultimoUso: ago(3) },
];

const mockFila: FilaItem[] = [
  { id: "f1", contatoId: "c1", prioridade: "alta", atribuidoPara: null, status: "aguardando", entradaFila: ago(5), tempoEspera: 5, motivo: "Novo candidato interessado" },
  { id: "f2", contatoId: "c7", prioridade: "media", atribuidoPara: null, status: "aguardando", entradaFila: ago(2), tempoEspera: 2, motivo: "Potencial parceiro" },
  { id: "f4", contatoId: "c4", prioridade: "urgente", atribuidoPara: "recrutador1", status: "em_atendimento", entradaFila: ago(180), tempoEspera: 180, motivo: "Documento vencido - risco de bloqueio" },
];

const mockAutomacoes: AutomacaoRegra[] = [
  { id: "a1", nome: "Onboarding automático", trigger: "novo_candidato", condicoes: {}, acoes: [{ tipo: "enviar_template", parametros: { templateId: "t1" } }, { tipo: "criar_fila", parametros: { prioridade: "media" } }], ativa: true, totalExecucoes: 89 },
  { id: "a2", nome: "Cobrança documentos automática", trigger: "documento_pendente", condicoes: {}, acoes: [{ tipo: "enviar_template", parametros: { templateId: "t2" } }], ativa: true, totalExecucoes: 156 },
  { id: "a3", nome: "Bloqueio por vencimento", trigger: "score_baixo", condicoes: { scoreMaximo: 40 }, acoes: [{ tipo: "bloquear_prestador", parametros: {} }, { tipo: "enviar_template", parametros: { templateId: "t5" } }, { tipo: "criar_fila", parametros: { prioridade: "urgente" } }], ativa: true, totalExecucoes: 23 },
  { id: "a4", nome: "Reativação automática", trigger: "inativo", condicoes: { diasInativo: 60 }, acoes: [{ tipo: "enviar_template", parametros: { templateId: "t6" } }], ativa: false, totalExecucoes: 12 },
  { id: "a5", nome: "Treinamento pendente", trigger: "treinamento_pendente", condicoes: {}, acoes: [{ tipo: "enviar_template", parametros: { templateId: "t3" } }, { tipo: "criar_fila", parametros: { prioridade: "media" } }], ativa: true, totalExecucoes: 45 },
];

const mockCampanhas: CampanhaWhatsApp[] = [
  { id: "cp1", nome: "Reativação Inativos Q2", templateId: "t6", filtros: { status: "inativo" }, status: "concluida", enviadas: 150, entregues: 142, lidas: 98, respondidas: 34, criadaEm: ago(720) },
  { id: "cp2", nome: "Cobrança Documentos Maio", templateId: "t2", filtros: { documentosPendentes: true }, status: "enviando", enviadas: 45, entregues: 40, lidas: 28, respondidas: 12, criadaEm: ago(60) },
];

const mockLogs: LogConversa[] = [
  { id: "l1", contatoId: "c1", tipo: "ia_resposta", descricao: "IA respondeu: boas-vindas enviadas", timestamp: ago(14) },
  { id: "l2", contatoId: "c1", tipo: "automacao", descricao: "Automação 'Onboarding' disparou template t1", timestamp: ago(14) },
  { id: "l3", contatoId: "c3", tipo: "humano_assumiu", descricao: "Recrutador João assumiu conversa", timestamp: ago(120) },
  { id: "l4", contatoId: "c4", tipo: "alerta", descricao: "Documento expirado: Seguro da Carga venceu em 01/05/2026", timestamp: ago(180) },
  { id: "l5", contatoId: "c4", tipo: "automacao", descricao: "Automação 'Bloqueio por vencimento' ativou bloqueio", timestamp: ago(180) },
];

export const useWhatsAppCRMStore = create<WhatsAppCRMState>()((set) => ({
  conversas: mockContatos,
  mensagens: mockMensagens,
  fila: mockFila,
  templates: mockTemplates,
  automacoes: mockAutomacoes,
  campanhas: mockCampanhas,
  logs: mockLogs,
  conversaAtiva: null,
  searchQuery: "",
  filtroStatus: "todas",
  iaGlobalAtiva: true,

  setConversaAtiva: (id) => set({ conversaAtiva: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFiltroStatus: (s) => set({ filtroStatus: s }),
  toggleIaGlobal: () => set((s) => ({ iaGlobalAtiva: !s.iaGlobalAtiva })),

  assumirConversa: (id) => set((s) => ({
    conversas: s.conversas.map((c) => c.id === id ? { ...c, humanoAssumiu: true, iaAtiva: false } : c),
    logs: [{ id: crypto.randomUUID(), contatoId: id, tipo: "humano_assumiu", descricao: "Recrutador assumiu conversa", timestamp: now() }, ...s.logs],
  })),

  liberarConversa: (id) => set((s) => ({
    conversas: s.conversas.map((c) => c.id === id ? { ...c, humanoAssumiu: false, iaAtiva: s.iaGlobalAtiva } : c),
    logs: [{ id: crypto.randomUUID(), contatoId: id, tipo: "humano_liberou", descricao: "Conversa liberada para IA", timestamp: now() }, ...s.logs],
  })),

  enviarMensagem: (conversaId, texto, origem, templateNome) => set((s) => {
    const msg: MensagemCRM = { id: crypto.randomUUID(), conversaId, texto, origem, timestamp: now(), lida: false, templateUsado: templateNome };
    return {
      mensagens: { ...s.mensagens, [conversaId]: [...(s.mensagens[conversaId] || []), msg] },
      conversas: s.conversas.map((c) => c.id === conversaId ? { ...c, ultimaMensagem: texto, ultimaData: now() } : c),
    };
  }),

  classificarIntencao: (conversaId, intent) => set((s) => ({
    conversas: s.conversas.map((c) => c.id === conversaId ? { ...c, intentClassificada: intent } : c),
  })),

  atualizarStatus: (conversaId, status) => set((s) => ({
    conversas: s.conversas.map((c) => c.id === conversaId ? { ...c, status } : c),
    logs: [{ id: crypto.randomUUID(), contatoId: conversaId, tipo: "automacao", descricao: `Status atualizado para: ${status}`, timestamp: now() }, ...s.logs],
  })),

  adicionarTag: (conversaId, tag) => set((s) => ({
    conversas: s.conversas.map((c) => c.id === conversaId ? { ...c, tags: [...new Set([...c.tags, tag])] } : c),
  })),

  removerTag: (conversaId, tag) => set((s) => ({
    conversas: s.conversas.map((c) => c.id === conversaId ? { ...c, tags: c.tags.filter((t) => t !== tag) } : c),
  })),

  adicionarFila: (contatoId, prioridade, motivo) => set((s) => ({
    fila: [...s.fila, { id: crypto.randomUUID(), contatoId, prioridade, atribuidoPara: null, status: "aguardando", entradaFila: now(), tempoEspera: 0, motivo }],
  })),

  atenderFila: (filaId) => set((s) => ({
    fila: s.fila.map((f) => f.id === filaId ? { ...f, status: "resolvido" } : f),
  })),

  transferirFila: (filaId, para) => set((s) => ({
    fila: s.fila.map((f) => f.id === filaId ? { ...f, atribuidoPara: para, status: "transferido" } : f),
  })),

  adicionarTemplate: (template) => set((s) => ({ templates: [...s.templates, template] })),
  usarTemplate: (templateId) => set((s) => ({
    templates: s.templates.map((t) => t.id === templateId ? { ...t, usos: t.usos + 1, ultimoUso: now() } : t),
  })),
  toggleAutomacao: (id) => set((s) => ({ automacoes: s.automacoes.map((a) => a.id === id ? { ...a, ativa: !a.ativa } : a) })),

  criarCampanha: (campanha) => set((s) => ({ campanhas: [...s.campanhas, campanha] })),
  atualizarCampanha: (id, data) => set((s) => ({ campanhas: s.campanhas.map((c) => c.id === id ? { ...c, ...data } : c) })),
}));
