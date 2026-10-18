import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp } from "lucide-react";
import type { ReversaFields } from "./ColetaReversaFields";

interface Props {
  fields: ReversaFields;
  onChange: (fields: ReversaFields) => void;
  readOnly?: boolean;
  qtdPrevista: number;
}

const MODELOS = ["por_unidade", "por_caixa", "por_volume", "por_peca", "por_palete", "valor_fixo", "por_km", "incluido_diaria"];

const MODELO_LABELS: Record<string, string> = {
  por_unidade: "Por Unidade",
  por_caixa: "Por Caixa", por_volume: "Por Volume", por_peca: "Por Peça",
  por_palete: "Por Palete", valor_fixo: "Valor Fixo", por_km: "Por KM",
  incluido_diaria: "Incluído na Diária",
};

function calcValor(modelo: string, qtd: number, unitario: number, valorFixo: number): number {
  if (modelo === "valor_fixo") return valorFixo;
  if (modelo === "incluido_diaria") return 0;
  return qtd * unitario;
}

export function ColetaReversaFinanceiro({ fields, onChange, readOnly = false, qtdPrevista }: Props) {
  if (fields.tipo_reversa === "sem_reversa") return null;

  const update = (key: keyof ReversaFields, value: any) => onChange({ ...fields, [key]: value });
  const qtd = fields.reversa_qtd_coletada > 0 ? fields.reversa_qtd_coletada : qtdPrevista;
  const valCliente = fields.reversa_impacto_cliente || calcValor(fields.reversa_modelo_cliente, qtd, fields.reversa_valor_unitario_cliente, fields.reversa_valor_fixo_cliente);
  const valPrestador = fields.reversa_impacto_prestador || calcValor(fields.reversa_modelo_prestador, qtd, fields.reversa_valor_unitario_prestador, fields.reversa_valor_fixo_prestador);

  return (
    <Card className="border-amber-200">
      <CardHeader className="py-3 px-4 bg-amber-50">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-amber-600" />
          Coleta Reversa — Valores
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        {/* CLIENTE */}
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Faturamento Cliente — Reversa
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Modelo</Label>
              <Select value={fields.reversa_modelo_cliente} onValueChange={(v) => update("reversa_modelo_cliente", v)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELOS.map(m => <SelectItem key={m} value={m}>{MODELO_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">
                {fields.reversa_modelo_cliente === "valor_fixo" ? "Valor Fixo (R$)" : "Valor Unitário (R$)"}
              </Label>
              <Input type="number" step="0.01"
                value={fields.reversa_modelo_cliente === "valor_fixo" ? fields.reversa_valor_fixo_cliente : fields.reversa_valor_unitario_cliente}
                readOnly={readOnly}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  if (fields.reversa_modelo_cliente === "valor_fixo") update("reversa_valor_fixo_cliente", v);
                  else update("reversa_valor_unitario_cliente", v);
                }} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Qtd Faturável</Label>
              <Input type="number" value={qtd} readOnly className="bg-slate-100" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Total Cliente (R$)</Label>
              <Input type="number" value={valCliente.toFixed(2)} readOnly className="bg-emerald-100 font-bold text-emerald-800" />
            </div>
          </div>
        </div>

        {/* PRESTADOR */}
        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Repasse Prestador — Reversa
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Modelo</Label>
              <Select value={fields.reversa_modelo_prestador} onValueChange={(v) => update("reversa_modelo_prestador", v)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELOS.map(m => <SelectItem key={m} value={m}>{MODELO_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">
                {fields.reversa_modelo_prestador === "valor_fixo" ? "Valor Fixo (R$)" : "Valor Unitário (R$)"}
              </Label>
              <Input type="number" step="0.01"
                value={fields.reversa_modelo_prestador === "valor_fixo" ? fields.reversa_valor_fixo_prestador : fields.reversa_valor_unitario_prestador}
                readOnly={readOnly}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  if (fields.reversa_modelo_prestador === "valor_fixo") update("reversa_valor_fixo_prestador", v);
                  else update("reversa_valor_unitario_prestador", v);
                }} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Qtd Pagável</Label>
              <Input type="number" value={qtd} readOnly className="bg-slate-100" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Total Prestador (R$)</Label>
              <Input type="number" value={valPrestador.toFixed(2)} readOnly className="bg-blue-100 font-bold text-blue-800" />
            </div>
          </div>
        </div>

        {/* Totais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-[10px] font-bold text-emerald-700 uppercase">Valor Cliente (Reversa)</p>
            <p className="text-lg font-bold text-emerald-800">R$ {valCliente.toFixed(2)}</p>
            <p className="text-[10px] text-emerald-600">Modelo: {MODELO_LABELS[fields.reversa_modelo_cliente] || fields.reversa_modelo_cliente}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-[10px] font-bold text-blue-700 uppercase">Repasse Prestador (Reversa)</p>
            <p className="text-lg font-bold text-blue-800">R$ {valPrestador.toFixed(2)}</p>
            <p className="text-[10px] text-blue-600">Modelo: {MODELO_LABELS[fields.reversa_modelo_prestador] || fields.reversa_modelo_prestador}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
