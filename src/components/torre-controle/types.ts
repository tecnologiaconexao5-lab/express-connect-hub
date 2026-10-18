import { LucideIcon } from "lucide-react";

export type TipoEventoTimeline =
  | "os_criada" | "os_em_rota" | "os_atrasada" | "os_concluida"
  | "ocorrencia_aberta" | "alerta_humano" | "comprovante_pendente" | "alocacao_concluida"
  | "app_aceite" | "app_chegada" | "app_coleta" | "app_deslocamento"
  | "app_entrega" | "app_finalizacao" | "app_evidencia" | "app_assinatura"
  | "app_documento" | "app_gps" | "app_generico";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  tipoEvento: TipoEventoTimeline;
  severidade: "baixa" | "media" | "alta" | "critica";
  cliente: string;
  prestador: string;
  os: string;
  descricao: string;
  source?: string;
  stage?: string;
  locationText?: string;
  evidenceUrl?: string;
}
