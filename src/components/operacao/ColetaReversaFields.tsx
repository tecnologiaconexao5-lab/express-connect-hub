import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Truck, Camera, MapPin } from "lucide-react";

export interface ReversaFields {
  tipo_reversa: string;
  reversa_qtd_volumes: number;
  reversa_observacoes: string;
  reversa_endereco_coleta: string;
  reversa_endereco_devolucao: string;
  reversa_unidade_cobranca: string;
  reversa_valor_unitario: number;
  reversa_qtd_coletada: number;
  reversa_divergencia: string;
  reversa_motivo_divergencia: string;
  reversa_responsavel: string;
  reversa_documento_responsavel: string;
  reversa_telefone: string;
  reversa_status: string;
  reversa_data_prevista: string;
  reversa_data_realizada: string;
  reversa_valor_adicional: number;
  reversa_impacto_prestador: number;
  reversa_impacto_cliente: number;
  // Modelos independentes cliente/prestador
  reversa_modelo_cliente: string;
  reversa_valor_unitario_cliente: number;
  reversa_valor_fixo_cliente: number;
  reversa_modelo_prestador: string;
  reversa_valor_unitario_prestador: number;
  reversa_valor_fixo_prestador: number;
  // Mídia da reversa
  reversa_fotos: { url: string; categoria?: string; legenda?: string }[];
  reversa_assinatura_url: string;
  reversa_assinatura_nome: string;
  reversa_assinatura_documento: string;
  reversa_assinatura_data: string;
  reversa_latitude: number;
  reversa_longitude: number;
  reversa_gps_data: string;
  reversa_qtd_fotos: number;
}

/** Mapper único: banco (alocacoes_escala) → ReversaFields */
export function dbToReversaFields(db: Record<string, any>): ReversaFields {
  const normalizeNum = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };
  const normalizeStr = (v: any): string => {
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    tipo_reversa: normalizeStr(db.tipo_reversa) || 'sem_reversa',
    reversa_qtd_volumes: normalizeNum(db.reversa_qtd_volumes),
    reversa_observacoes: normalizeStr(db.reversa_observacoes),
    reversa_endereco_coleta: normalizeStr(db.reversa_endereco_coleta),
    reversa_endereco_devolucao: normalizeStr(db.reversa_endereco_devolucao),
    reversa_unidade_cobranca: normalizeStr(db.reversa_unidade_cobranca) || 'unidade',
    reversa_valor_unitario: normalizeNum(db.reversa_valor_unitario),
    reversa_qtd_coletada: normalizeNum(db.reversa_qtd_coletada),
    reversa_divergencia: normalizeStr(db.reversa_divergencia),
    reversa_motivo_divergencia: normalizeStr(db.reversa_motivo_divergencia),
    reversa_responsavel: normalizeStr(db.reversa_responsavel),
    reversa_documento_responsavel: normalizeStr(db.reversa_documento_responsavel),
    reversa_telefone: normalizeStr(db.reversa_telefone),
    reversa_status: normalizeStr(db.reversa_status) || 'nao_iniciada',
    reversa_data_prevista: normalizeStr(db.reversa_data_prevista),
    reversa_data_realizada: normalizeStr(db.reversa_data_realizada),
    reversa_valor_adicional: normalizeNum(db.reversa_valor_adicional),
    reversa_impacto_cliente: normalizeNum(db.reversa_valor_cliente),
    reversa_impacto_prestador: normalizeNum(db.reversa_valor_prestador),
    // Modelos independentes
    reversa_modelo_cliente: normalizeStr(db.reversa_modelo_cliente) || 'por_unidade',
    reversa_valor_unitario_cliente: normalizeNum(db.reversa_valor_unitario_cliente) || normalizeNum(db.reversa_valor_unitario),
    reversa_valor_fixo_cliente: normalizeNum(db.reversa_valor_fixo_cliente),
    reversa_modelo_prestador: normalizeStr(db.reversa_modelo_prestador) || 'por_unidade',
    reversa_valor_unitario_prestador: normalizeNum(db.reversa_valor_unitario_prestador) || normalizeNum(db.reversa_valor_unitario),
    reversa_valor_fixo_prestador: normalizeNum(db.reversa_valor_fixo_prestador),
    // Mídia da reversa
    reversa_fotos: (() => {
      try {
        const fotos = typeof db.reversa_fotos === 'string' ? JSON.parse(db.reversa_fotos) : (db.reversa_fotos || []);
        return Array.isArray(fotos) ? fotos : [];
      } catch { return []; }
    })(),
    reversa_assinatura_url: normalizeStr(db.reversa_assinatura_url),
    reversa_assinatura_nome: normalizeStr(db.reversa_assinatura_nome),
    reversa_assinatura_documento: normalizeStr(db.reversa_assinatura_documento),
    reversa_assinatura_data: normalizeStr(db.reversa_assinatura_data),
    reversa_latitude: normalizeNum(db.reversa_latitude),
    reversa_longitude: normalizeNum(db.reversa_longitude),
    reversa_gps_data: normalizeStr(db.reversa_gps_data),
    reversa_qtd_fotos: (() => {
      try {
        const fotos = typeof db.reversa_fotos === 'string' ? JSON.parse(db.reversa_fotos) : (db.reversa_fotos || []);
        return Array.isArray(fotos) ? fotos.length : 0;
      } catch { return 0; }
    })(),
  };
}

/** Verifica se a alocação possui dados de reversa */
export function hasReversaData(db: Record<string, any>): boolean {
  return db.tipo_reversa !== null && db.tipo_reversa !== undefined && db.tipo_reversa !== 'sem_reversa';
}

export const emptyReversaFields = (): ReversaFields => ({
  tipo_reversa: "sem_reversa",
  reversa_qtd_volumes: 0,
  reversa_observacoes: "",
  reversa_endereco_coleta: "",
  reversa_endereco_devolucao: "",
  reversa_unidade_cobranca: "unidade",
  reversa_valor_unitario: 0,
  reversa_qtd_coletada: 0,
  reversa_divergencia: "",
  reversa_motivo_divergencia: "",
  reversa_responsavel: "",
  reversa_documento_responsavel: "",
  reversa_telefone: "",
  reversa_status: "nao_iniciada",
  reversa_data_prevista: "",
  reversa_data_realizada: "",
  reversa_valor_adicional: 0,
  reversa_impacto_prestador: 0,
  reversa_impacto_cliente: 0,
  reversa_modelo_cliente: "por_unidade",
  reversa_valor_unitario_cliente: 0,
  reversa_valor_fixo_cliente: 0,
  reversa_modelo_prestador: "por_unidade",
  reversa_valor_unitario_prestador: 0,
  reversa_valor_fixo_prestador: 0,
  reversa_fotos: [],
  reversa_assinatura_url: "",
  reversa_assinatura_nome: "",
  reversa_assinatura_documento: "",
  reversa_assinatura_data: "",
  reversa_latitude: 0,
  reversa_longitude: 0,
  reversa_gps_data: "",
  reversa_qtd_fotos: 0,
});

export const REVERSA_STATUS_LABELS: Record<string, string> = {
  nao_iniciada: "Não Iniciada",
  aguardando_coleta: "Aguardando Coleta",
  em_coleta: "Em Coleta",
  coletada: "Coletada",
  em_devolucao: "Em Devolução",
  devolvida: "Devolvida",
  divergente: "Divergente",
  cancelada: "Cancelada",
};

export const REVERSA_TIPO_LABELS: Record<string, string> = {
  sem_reversa: "Sem Reversa",
  coleta_reversa: "Coleta Reversa",
  devolucao: "Devolução",
  troca: "Troca",
  retorno_cd: "Retorno ao CD",
};

export const REVERSA_STATUS_LIST = [
  "nao_iniciada", "aguardando_coleta", "em_coleta", "coletada",
  "em_devolucao", "devolvida", "divergente", "cancelada"
];

export const REVERSA_TIPO_LIST = [
  "sem_reversa", "coleta_reversa", "devolucao", "troca", "retorno_cd"
];

interface ColetaReversaFieldsProps {
  fields: ReversaFields;
  onChange: (fields: ReversaFields) => void;
  readOnly?: boolean;
  defaultOpen?: boolean;
}

export function ColetaReversaFields({ fields, onChange, readOnly = false, defaultOpen = false }: ColetaReversaFieldsProps) {
  const update = (key: keyof ReversaFields, value: any) => {
    onChange({ ...fields, [key]: value });
  };

  const temReversa = fields.tipo_reversa !== "sem_reversa";
  const divergenciaCalc = fields.reversa_qtd_coletada > 0 ? fields.reversa_qtd_coletada - fields.reversa_qtd_volumes : 0;
  const divergenciaLabel = divergenciaCalc === 0 ? "Sem divergência" : divergenciaCalc < 0 ? `Faltante: ${Math.abs(divergenciaCalc)}` : `Excedente: ${divergenciaCalc}`;

  return (
    <Card className="border-amber-200">
      <CardHeader className="py-3 px-4 bg-amber-50">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Truck className="h-4 w-4 text-amber-600" />
          Coleta Reversa
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Reversa</Label>
            <Select value={fields.tipo_reversa} onValueChange={(v) => update("tipo_reversa", v)} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REVERSA_TIPO_LIST.map((t) => (
                  <SelectItem key={t} value={t}>{REVERSA_TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {temReversa && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={fields.reversa_status} onValueChange={(v) => update("reversa_status", v)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVERSA_STATUS_LIST.map((s) => (
                    <SelectItem key={s} value={s}>{REVERSA_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {temReversa && (
          <Collapsible defaultOpen={defaultOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <ChevronDown className="h-4 w-4" /> Dados da Reversa
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Endereço da Coleta</Label>
                  <Input value={fields.reversa_endereco_coleta} readOnly={readOnly}
                    onChange={(e) => update("reversa_endereco_coleta", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Endereço de Devolução</Label>
                  <Input value={fields.reversa_endereco_devolucao} readOnly={readOnly}
                    onChange={(e) => update("reversa_endereco_devolucao", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade Prevista</Label>
                  <Input type="number" value={fields.reversa_qtd_volumes} readOnly={readOnly}
                    onChange={(e) => update("reversa_qtd_volumes", parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Unidade de Cobrança</Label>
                  <Select value={fields.reversa_unidade_cobranca}
                    onValueChange={(v) => update("reversa_unidade_cobranca", v)} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unidade">Unidade</SelectItem>
                      <SelectItem value="volume">Volume</SelectItem>
                      <SelectItem value="caixa">Caixa</SelectItem>
                      <SelectItem value="pallet">Pallet</SelectItem>
                      <SelectItem value="kg">KG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor por Unidade (R$)</Label>
                  <Input type="number" step="0.01" value={fields.reversa_valor_unitario} readOnly={readOnly}
                    onChange={(e) => update("reversa_valor_unitario", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade Efetivamente Coletada</Label>
                  <Input type="number" value={fields.reversa_qtd_coletada} readOnly={readOnly}
                    onChange={(e) => update("reversa_qtd_coletada", parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Divergência</Label>
                  {fields.reversa_qtd_coletada > 0 ? (
                    <div className={`p-2 rounded-lg text-sm font-medium ${divergenciaCalc === 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : divergenciaCalc < 0 ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                      {divergenciaLabel}
                    </div>
                  ) : (
                    <Input value="" readOnly placeholder="Aguardando coleta..." className="bg-slate-50" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Motivo da Divergência</Label>
                  <Input value={fields.reversa_motivo_divergencia} readOnly={readOnly}
                    onChange={(e) => update("reversa_motivo_divergencia", e.target.value)}
                    disabled={divergenciaCalc === 0} />
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={fields.reversa_responsavel} readOnly={readOnly}
                    onChange={(e) => update("reversa_responsavel", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Documento do Responsável</Label>
                  <Input value={fields.reversa_documento_responsavel} readOnly={readOnly}
                    onChange={(e) => update("reversa_documento_responsavel", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={fields.reversa_telefone} readOnly={readOnly}
                    onChange={(e) => update("reversa_telefone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Prevista</Label>
                  <Input type="date" value={fields.reversa_data_prevista} readOnly={readOnly}
                    onChange={(e) => update("reversa_data_prevista", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Realizada</Label>
                  <Input type="date" value={fields.reversa_data_realizada} readOnly={readOnly}
                    onChange={(e) => update("reversa_data_realizada", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Valor Adicional (R$)</Label>
                  <Input type="number" step="0.01" value={fields.reversa_valor_adicional} readOnly={readOnly}
                    onChange={(e) => update("reversa_valor_adicional", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Impacto Repasse Prestador (R$)</Label>
                  <Input type="number" step="0.01" value={fields.reversa_impacto_prestador} readOnly={readOnly}
                    onChange={(e) => update("reversa_impacto_prestador", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Impacto Faturamento Cliente (R$)</Label>
                  <Input type="number" step="0.01" value={fields.reversa_impacto_cliente} readOnly={readOnly}
                    onChange={(e) => update("reversa_impacto_cliente", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações da Reversa</Label>
                <Textarea value={fields.reversa_observacoes} readOnly={readOnly}
                  onChange={(e) => update("reversa_observacoes", e.target.value)} rows={3} />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> Fotos</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> GPS Coleta</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> GPS Devolução</span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
