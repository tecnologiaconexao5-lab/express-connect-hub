import { useState } from "react";
import { ArrowLeft, Save, Plus, Trash2, Calculator, Shield, Coins, BookOpen, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { TabelaValores, TabelaFaixa } from "./tabelaValoresTypes";

interface Props {
  tabela?: TabelaValores;
  modo: "ver" | "editar" | "novo";
  onVoltar: () => void;
}

const emptyFaixa = (): TabelaFaixa => ({
  tipo_criterio: "peso", inicio: 0, fim: 0, excedente: 0, minimo: 0,
  limite_nota_peso: 0, perc_nota_peso: 0, valor_adicional: 0,
  prazo_estimado: "", restricao_veiculo: "", observacao: ""
});

const emptyTabela = (): TabelaValores => ({
  id: "", nome: "Nova Tabela", cliente: "", unidade: "", centroCusto: "", tipoOperacao: "",
  segmento: "", vigenciaInicial: new Date().toISOString().split("T")[0], vigenciaFinal: "",
  status: "rascunho", versao: "1.0", principalOuComplementar: "principal", observacoes: "",
  tipoCobrancaPrincipal: "por peso", tipoVeiculo: "", subcategoria: "", carroceria: "", classificacaoTermica: "",
  valorBase: 0, valorMinimoFaturavel: 0, valorCusto: 0, markupPercent: 0, margemMinimaDesejada: 0, custoMinimoParceiro: 0,
  arredondamento: false, cobrancaRetorno: false, cobrancaEspera: false, cobrancaAjudante: false,
  faixas: [emptyFaixa()], adicionais: [], contaContabil: "", custoEstimadoTotal: 0, margemEstimadaTotal: 0, historicoVersoes: []
});

const ADICIONAIS_OPCOES = ["Pedágio", "Ajudante", "Espera", "Descarga", "Taxa Administrativa", "Devolução", "Reentrega", "Pernoite", "Taxa de Risco", "Taxa de Restrição", "Segunda Tentativa", "Estacionamento", "Taxa de Agendamento", "Taxa de Dificuldade de Acesso", "Taxa de Escolta", "Estadia", "Diária Extra"];

const TabelaValoresForm = ({ tabela, modo, onVoltar }: Props) => {
  const [data, setData] = useState<TabelaValores>(tabela ? JSON.parse(JSON.stringify(tabela)) : emptyTabela());
  const [isSaving, setIsSaving] = useState(false);
  const readOnly = modo === "ver";

  const update = (field: keyof TabelaValores, value: any) => setData((p) => ({ ...p, [field]: value }));

  const handleSalvar = async () => {
    setIsSaving(true);
    try {
      const isNovo = !data.id;
      const { id, ...rest } = data; // avoid passing empty id if new
      let query;
      
      const payload = { ...rest, historicoVersoes: [...(rest.historicoVersoes || []), { data: new Date().toISOString(), versao: rest.versao }] };

      if (isNovo) query = supabase.from("tabelas_valores").insert([payload]);
      else query = supabase.from("tabelas_valores").update(payload).eq("id", id);
      
      const { error } = await query;
      if (error) throw error;

      toast.success(isNovo ? "Tabela cadastrada com sucesso!" : "Tabela atualizada!");
      onVoltar();
    } catch {
      toast.error("Erro ao salvar tabela de valores.");
    } finally {
      setIsSaving(false);
    }
  };

  const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
    <div className={className}>
      <Label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onVoltar}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{data.nome}</h2>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono">v{data.versao}</span>
            </div>
            <p className="text-sm text-muted-foreground">{data.cliente || "Todos os Clientes"} - {data.status}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!readOnly && <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleSalvar} disabled={isSaving}><Save className="w-4 h-4 mr-1"/> Salvar Tabela</Button>}
        </div>
      </div>

      <Tabs defaultValue="identificacao" className="w-full">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="identificacao" className="text-xs"><BookOpen className="w-3 h-3 mr-1"/> Identificação</TabsTrigger>
          <TabsTrigger value="regras" className="text-xs"><Shield className="w-3 h-3 mr-1"/> Regras Base</TabsTrigger>
          <TabsTrigger value="faixas" className="text-xs"><Calculator className="w-3 h-3 mr-1"/> Faixas e Critérios</TabsTrigger>
          <TabsTrigger value="adicionais" className="text-xs"><Plus className="w-3 h-3 mr-1"/> Adicionais</TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs"><Coins className="w-3 h-3 mr-1"/> Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="identificacao">
          <Card>
            <CardHeader><CardTitle className="text-sm text-primary">Identificação e Validade</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <Field label="Nome da Tabela*"><Input value={data.nome} readOnly={readOnly} onChange={(e) => update("nome", e.target.value)} /></Field>
              <Field label="Cliente Vinculado"><Input value={data.cliente} readOnly={readOnly} onChange={(e) => update("cliente", e.target.value)} placeholder="Deixe em branco p/ geral" /></Field>
              <Field label="Unidade"><Input value={data.unidade} readOnly={readOnly} onChange={(e) => update("unidade", e.target.value)} /></Field>
              <Field label="Centro de Custo"><Input value={data.centroCusto} readOnly={readOnly} onChange={(e) => update("centroCusto", e.target.value)} /></Field>
              <Field label="Tipo de Operação"><Input value={data.tipoOperacao} readOnly={readOnly} onChange={(e) => update("tipoOperacao", e.target.value)} /></Field>
              <Field label="Segmento"><Input value={data.segmento} readOnly={readOnly} onChange={(e) => update("segmento", e.target.value)} /></Field>
              <Field label="Vigência Inicial"><Input type="date" value={data.vigenciaInicial} readOnly={readOnly} onChange={(e) => update("vigenciaInicial", e.target.value)} /></Field>
              <Field label="Vigência Final"><Input type="date" value={data.vigenciaFinal} readOnly={readOnly} onChange={(e) => update("vigenciaFinal", e.target.value)} /></Field>
              <Field label="Status">
                <Select value={data.status} onValueChange={(v) => update("status", v as any)} disabled={readOnly}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="inativa">Inativa</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Versão"><Input value={data.versao} readOnly={readOnly} onChange={(e) => update("versao", e.target.value)} /></Field>
              <Field label="Tipo (Principal/Comp.)">
                <Select value={data.principalOuComplementar} onValueChange={(v) => update("principalOuComplementar", v as any)} disabled={readOnly}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="principal">Principal</SelectItem><SelectItem value="complementar">Complementar</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Observações Gerais" className="md:col-span-2 xl:col-span-4"><Textarea value={data.observacoes} readOnly={readOnly} onChange={(e) => update("observacoes", e.target.value)} rows={2} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras">
          <Card>
            <CardHeader><CardTitle className="text-sm text-primary">Regras Base e Valores Padrão</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Tipo Cobrança Principal">
                <Select value={data.tipoCobrancaPrincipal} onValueChange={(v) => update("tipoCobrancaPrincipal", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {["por saída", "por diária", "por km", "por faixa de km", "por peso", "por faixa de peso", "por cubagem", "por região", "por CEP", "por cidade/UF", "por tipo de veículo", "por diária + km excedente", "por rota fixa", "por operação dedicada"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de Veículo"><Input value={data.tipoVeiculo} readOnly={readOnly} onChange={(e) => update("tipoVeiculo", e.target.value)} /></Field>
              <Field label="Subcategoria"><Input value={data.subcategoria} readOnly={readOnly} onChange={(e) => update("subcategoria", e.target.value)} /></Field>
              <Field label="Carroceria"><Input value={data.carroceria} readOnly={readOnly} onChange={(e) => update("carroceria", e.target.value)} /></Field>
              <Field label="Valor Base (R$)"><Input type="number" value={data.valorBase || ""} readOnly={readOnly} onChange={(e) => update("valorBase", Number(e.target.value))} /></Field>
              <Field label="Mínimo Faturável (R$)"><Input type="number" value={data.valorMinimoFaturavel || ""} readOnly={readOnly} onChange={(e) => update("valorMinimoFaturavel", Number(e.target.value))} /></Field>
              <Field label="Valor Custo (Base)"><Input type="number" value={data.valorCusto || ""} readOnly={readOnly} onChange={(e) => update("valorCusto", Number(e.target.value))} /></Field>
              <Field label="Markup (%)"><Input type="number" value={data.markupPercent || ""} readOnly={readOnly} onChange={(e) => update("markupPercent", Number(e.target.value))} /></Field>
              <Field label="Margem Mín. Desejada (%)"><Input type="number" value={data.margemMinimaDesejada || ""} readOnly={readOnly} onChange={(e) => update("margemMinimaDesejada", Number(e.target.value))} /></Field>
              <Field label="Custo Mín. Parceiro (R$)"><Input type="number" value={data.custoMinimoParceiro || ""} readOnly={readOnly} onChange={(e) => update("custoMinimoParceiro", Number(e.target.value))} /></Field>

              <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div className="flex items-center gap-2"><Switch checked={data.arredondamento} onCheckedChange={(v) => update("arredondamento", v)} disabled={readOnly} /><Label className="text-xs">Arredondamento Padrão</Label></div>
                <div className="flex items-center gap-2"><Switch checked={data.cobrancaRetorno} onCheckedChange={(v) => update("cobrancaRetorno", v)} disabled={readOnly} /><Label className="text-xs">Prevê Cobrança de Retorno</Label></div>
                <div className="flex items-center gap-2"><Switch checked={data.cobrancaEspera} onCheckedChange={(v) => update("cobrancaEspera", v)} disabled={readOnly} /><Label className="text-xs">Prevê Cobrança de Espera</Label></div>
                <div className="flex items-center gap-2"><Switch checked={data.cobrancaAjudante} onCheckedChange={(v) => update("cobrancaAjudante", v)} disabled={readOnly} /><Label className="text-xs">Prevê Adicional Ajudante</Label></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faixas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm text-primary">Tabela Dinâmica de Faixas</CardTitle>
                <CardDescription>Crie cruzamentos de KM x Peso x Valor Opcional.</CardDescription>
              </div>
              {!readOnly && <Button size="sm" variant="outline" onClick={() => update("faixas", [...data.faixas, emptyFaixa()])}><Plus className="w-4 h-4 mr-1"/> Adicionar Faixa</Button>}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-md">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Critério</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Excedente R$</TableHead>
                      <TableHead>Mínimo R$</TableHead>
                      <TableHead>L. N.F R$</TableHead>
                      <TableHead>Valor Adicional R$</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.faixas.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Select value={f.tipo_criterio} onValueChange={(v) => { const fx = [...data.faixas]; fx[i].tipo_criterio = v; update("faixas", fx); }} disabled={readOnly}>
                            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="peso">Por Peso (kg)</SelectItem><SelectItem value="km">Por Km</SelectItem><SelectItem value="regiao">Por Região/CEP</SelectItem></SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input className="h-8 w-[80px]" value={f.inicio} readOnly={readOnly} onChange={(e) => { const fx = [...data.faixas]; fx[i].inicio = e.target.value; update("faixas", fx); }} /></TableCell>
                        <TableCell><Input className="h-8 w-[80px]" value={f.fim} readOnly={readOnly} onChange={(e) => { const fx = [...data.faixas]; fx[i].fim = e.target.value; update("faixas", fx); }} /></TableCell>
                        <TableCell><Input className="h-8 w-[80px]" type="number" value={f.excedente} readOnly={readOnly} onChange={(e) => { const fx = [...data.faixas]; fx[i].excedente = Number(e.target.value); update("faixas", fx); }} /></TableCell>
                        <TableCell><Input className="h-8 w-[80px]" type="number" value={f.minimo} readOnly={readOnly} onChange={(e) => { const fx = [...data.faixas]; fx[i].minimo = Number(e.target.value); update("faixas", fx); }} /></TableCell>
                        <TableCell><Input className="h-8 w-[80px]" type="number" value={f.limite_nota_peso} readOnly={readOnly} onChange={(e) => { const fx = [...data.faixas]; fx[i].limite_nota_peso = Number(e.target.value); update("faixas", fx); }} /></TableCell>
                        <TableCell><Input className="h-8 w-[100px]" type="number" value={f.valor_adicional} readOnly={readOnly} onChange={(e) => { const fx = [...data.faixas]; fx[i].valor_adicional = Number(e.target.value); update("faixas", fx); }} /></TableCell>
                        <TableCell>
                          {!readOnly && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => update("faixas", data.faixas.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.faixas.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-4 text-muted-foreground text-sm">Nenhuma regra detalhada inserida.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adicionais">
          <Card>
            <CardHeader><CardTitle className="text-sm text-primary">Taxas e Adicionais Permitidos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {ADICIONAIS_OPCOES.map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <Switch
                      disabled={readOnly}
                      checked={data.adicionais.includes(opt)}
                      onCheckedChange={(checked) => {
                        const arr = checked ? [...data.adicionais, opt] : data.adicionais.filter(a => a !== opt);
                        update("adicionais", arr);
                      }}
                    />
                    <Label className="text-xs">{opt}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro">
          <Card>
            <CardHeader><CardTitle className="text-sm text-primary">Previsão e Custo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Conta Contábil"><Input value={data.contaContabil} readOnly={readOnly} onChange={(e) => update("contaContabil", e.target.value)} /></Field>
              <Field label="Custo Estimado Médio (R$)"><Input type="number" value={data.custoEstimadoTotal || ""} readOnly={readOnly} onChange={(e) => update("custoEstimadoTotal", Number(e.target.value))} /></Field>
              <Field label="Margem Real Estimada (%)"><Input type="number" value={data.margemEstimadaTotal || ""} readOnly={readOnly} onChange={(e) => update("margemEstimadaTotal", Number(e.target.value))} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default TabelaValoresForm;
