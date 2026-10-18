import { useState, useEffect } from "react";
import { ArrowLeft, Save, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Veiculo } from "./types";
import { toVeiculoInsert, toVeiculoUpdate, fromVeiculoRow, VeiculoRow } from "@/lib/dbMappers";
import { TIPOS_VEICULO } from "@/constants/tiposVeiculo";

interface Props {
  veiculoId?: string;
  onBack: () => void;
}

// TIPOS_VEICULO imported from @/constants/tiposVeiculo (array of {value, label})
const SUBCATEGORIAS = ["urbano", "leve", "médio", "pesado", "dedicado", "refrigerado", "distribuição", "transferência", "outro"];
const TIPOS_CARROCERIA = ["baú", "baú refrigerado", "baú isotérmico", "sider", "grade baixa", "graneleira", "prancha", "plataforma", "carroceria aberta", "cegonha", "tanque", "container", "furgão", "refrigerada", "lonada", "outro"];
const CLASSIFICACAO_TERMICA = ["seco", "refrigerado", "isotérmico"];

const defaultVeiculo: Partial<Veiculo> = {
  status: "Ativo",
  tipoVeiculo: "",
  subcategoria: "",
  tipoCarroceria: "",
  classificacaoTermica: ""
};

const VeiculoDetalhe = ({ veiculoId, onBack }: Props) => {
  const isNew = !veiculoId;
  const [v, setV] = useState<Partial<Veiculo>>(defaultVeiculo);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (veiculoId) fetchVeiculo();
  }, [veiculoId]);

  const fetchVeiculo = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("veiculos").select("*").eq("id", veiculoId).single();
      if (error) throw error;
      if (data) setV(fromVeiculoRow(data as VeiculoRow) as Partial<Veiculo>);
    } catch (error) {
      console.error("Erro ao buscar no Supabase, tentando localStorage:", error);
      const localData = localStorage.getItem("veiculos_fallback");
      if (localData) {
        const parsed = JSON.parse(localData);
        const found = parsed.find((vec: any) => vec.id === veiculoId);
        if (found) setV(found);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof Veiculo, value: any) => {
    setV(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!v.placa || !v.tipoVeiculo) {
      toast.error("Placa e Tipo de Veículo são obrigatórios.");
      return;
    }

    try {
      setIsSaving(true);
      const isUpdate = !!v.id;
      
      const payload = isUpdate ? toVeiculoUpdate({ ...v, placa: v.placa.toUpperCase() }) : toVeiculoInsert({ ...v, placa: v.placa.toUpperCase() });

      let result;
      if (isUpdate) {
        result = await supabase.from("veiculos").update(payload).eq("id", v.id).select();
      } else {
        result = await supabase.from("veiculos").insert([payload]).select();
      }

      const { data, error } = result;

      if (error) {
        console.error("SUPABASE ERROR:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast.error(`Erro ao ${isUpdate ? 'atualizar' : 'cadastrar'}: ${error.message}`);
        return;
      }
      
      toast.success(isNew ? "Veículo cadastrado!" : "Veículo atualizado!");
      onBack();
    } catch (error: any) {
      console.error("Erro ao salvar veículo:", error);
      toast.error("Erro ao salvar veículo");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center animate-pulse">Carregando dados...</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="text-2xl font-bold">{isNew ? "Novo Veículo" : v.placa?.toUpperCase() || "Detalhes do Veículo"}</h2>
            <p className="text-sm text-muted-foreground">{v.marca} {v.modelo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-primary">
            <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar Veículo"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base text-primary">Classificação e Tipo (Obrigatórios)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Placa*</Label>
                <Input value={v.placa?.toUpperCase() || ""} onChange={e => handleChange("placa", e.target.value)} placeholder="ABC-1234" maxLength={8} />
              </div>
              <div>
                <Label>Tipo de Veículo*</Label>
                <Select value={v.tipoVeiculo || ""} onValueChange={val => handleChange("tipoVeiculo", val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{TIPOS_VEICULO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subcategoria</Label>
                <Select value={v.subcategoria || ""} onValueChange={val => handleChange("subcategoria", val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{SUBCATEGORIAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Carroceria</Label>
                <Select value={v.tipoCarroceria || ""} onValueChange={val => handleChange("tipoCarroceria", val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{TIPOS_CARROCERIA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classificação Térmica</Label>
                <Select value={v.classificacaoTermica || ""} onValueChange={val => handleChange("classificacaoTermica", val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{CLASSIFICACAO_TERMICA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base text-primary">Dados do Veículo e Dimensões</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div><Label>Marca</Label><Input value={v.marca || ""} onChange={e => handleChange("marca", e.target.value)} /></div>
              <div><Label>Modelo</Label><Input value={v.modelo || ""} onChange={e => handleChange("modelo", e.target.value)} /></div>
              <div><Label>Ano Fab.</Label><Input type="number" value={v.anoFabricacao || ""} onChange={e => handleChange("anoFabricacao", parseInt(e.target.value) || 0)} /></div>
              <div><Label>Ano Mod.</Label><Input type="number" value={v.anoModelo || ""} onChange={e => handleChange("anoModelo", parseInt(e.target.value) || 0)} /></div>
              <div><Label>Cor</Label><Input value={v.cor || ""} onChange={e => handleChange("cor", e.target.value)} /></div>
              <div><Label>RENAVAM</Label><Input value={v.renavam || ""} onChange={e => handleChange("renavam", e.target.value)} /></div>
              <div className="col-span-2"><Label>Chassi</Label><Input value={v.chassi || ""} onChange={e => handleChange("chassi", e.target.value)} /></div>
              
              <div><Label>Capac. (kg)</Label><Input type="number" value={v.capacidadeKg || ""} onChange={e => handleChange("capacidadeKg", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Capac. (m³)</Label><Input type="number" value={v.capacidadeM3 || ""} onChange={e => handleChange("capacidadeM3", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Comprim. (m)</Label><Input type="number" value={v.comprimento || ""} onChange={e => handleChange("comprimento", parseFloat(e.target.value) || 0)} /></div>
              <div><Label>Largura (m)</Label><Input type="number" value={v.largura || ""} onChange={e => handleChange("largura", e.target.value)} /></div>
              <div><Label>Altura (m)</Label><Input type="number" value={v.altura || ""} onChange={e => handleChange("altura", e.target.value)} /></div>
              <div><Label>Qtd Pallets</Label><Input type="number" value={v.qtdPallets || ""} onChange={e => handleChange("qtdPallets", e.target.value)} /></div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base text-primary">Vinculação e Financeiro</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select value={v.status || ""} onValueChange={val => handleChange("status", val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Manutenção">Em Manutenção</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Prestador Vinculado (ID)</Label><Input value={v.prestadorVinculado || ""} onChange={e => handleChange("prestadorVinculado", e.target.value)} placeholder="UUID do prestador" /></div>
              <div><Label>Unidade de Atuação</Label><Input value={v.unidade || ""} onChange={e => handleChange("unidade", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Custo / Km (R$)</Label><Input type="number" step="0.01" value={v.custoKm || ""} onChange={e => handleChange("custoKm", parseFloat(e.target.value) || 0)} /></div>
                <div><Label>Custo Diária (R$)</Label><Input type="number" step="0.01" value={v.custoDiaria || ""} onChange={e => handleChange("custoDiaria", parseFloat(e.target.value) || 0)} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base text-primary">Documentação e Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Validade Documental</Label><Input type="date" value={v.validadeDocumental || ""} onChange={e => handleChange("validadeDocumental", e.target.value)} /></div>
              <div><Label>Rastreador (Tecnologia/Empresa)</Label><Input value={v.rastreador || ""} onChange={e => handleChange("rastreador", e.target.value)} /></div>
              <div><Label>Apólice de Seguro</Label><Input value={v.seguroApolice || ""} onChange={e => handleChange("seguroApolice", e.target.value)} /></div>
              <div><Label>Observações Gerais</Label><Textarea rows={3} value={v.observacoes || ""} onChange={e => handleChange("observacoes", e.target.value)} /></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VeiculoDetalhe;
