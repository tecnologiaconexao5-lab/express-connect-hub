import { useState } from "react";
import { ArrowLeft, Save, Plus, Trash2, Copy, Eye, CopyCheck, Coins, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { toast } from "sonner";
import { TabelaValores, emptyTabelaValores, RegraFaixa, AdicionaisTaxas } from "./tabelaValoresTypes";
import { TIPOS_VEICULO } from "@/constants/tiposVeiculo";

const TIPOS_COBRANCA = [
  { id: 'saida', label: 'Por Saída (Valor fixo por operação)' },
  { id: 'diaria', label: 'Por Diária (Valor diário)' },
  { id: 'km', label: 'Por km Rodado' },
  { id: 'faixa_km', label: 'Por Faixa de km' },
  { id: 'peso', label: 'Por Peso (R$/kg)' },
  { id: 'faixa_peso', label: 'Por Faixa de Peso' },
  { id: 'cubagem', label: 'Por Cubagem (R$/m³)' },
  { id: 'diaria_km', label: 'Diária + km Excedente' },
  { id: 'regiao_cep', label: 'Por Região/CEP' },
  { id: 'rota_fixa', label: 'Rota Fixa' },
  { id: 'dedicado_mensal', label: 'Dedicado Mensal (Valor fixo mensal)' },
];

interface Props {
  tabela?: TabelaValores | null;
  modo: "ver" | "editar" | "novo";
  onVoltar: () => void;
  onSalvar: (tab: TabelaValores) => void;
}

const Field = ({ label, children, className = "" }: any) => (
  <div className={className}>
    <Label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</Label>
    {children}
  </div>
);

export default function TabelaValoresForm({ tabela, modo, onVoltar, onSalvar }: Props) {
  const [data, setData] = useState<TabelaValores>(tabela || emptyTabelaValores());
  const readOnly = modo === "ver";

  const update = (field: keyof TabelaValores, value: any) => setData(p => ({ ...p, [field]: value }));
  const updateNested = (objKey: "adicionais", field: keyof AdicionaisTaxas, updateObj: any) => {
    setData(p => ({ ...p, [objKey]: { ...p[objKey], [field]: { ...p[objKey][field], ...updateObj } } }));
  };

  const handleToggleCobranca = (cb: string) => {
    if (data.cobrancaPrincipais.includes(cb)) {
       update("cobrancaPrincipais", data.cobrancaPrincipais.filter(x => x !== cb));
    } else {
       update("cobrancaPrincipais", [...data.cobrancaPrincipais, cb]);
    }
  };

  const addFaixa = () => {
    const f: RegraFaixa = {
      id: String(Date.now()), pesoIni: 0, pesoFim: 0, kmIni: 0, kmFim: 0, cubagemIni: 0, cubagemFim: 0, regioesDestino: [], cepIni: "", cepFim: "", cidadeUF: "", prazoEstimado: 24, valorBase: 0, adicionalValor: 0, restricaoVeiculo: "", prioridade: 1, obs: ""
    };
    update("faixas", [...data.faixas, f]);
  };



  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onVoltar}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="text-xl font-bold">{data.nome || "Nova Tabela de Valores"}</h2>
            <p className="text-sm text-muted-foreground">Versão: v{data.versao} | Status: <span className="uppercase text-[10px] bg-slate-200 px-1 py-0.5 rounded text-slate-700 font-bold">{data.status}</span></p>
          </div>
        </div>
        <div className="flex gap-2">
          {!readOnly && <Button variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"><Eye className="w-4 h-4 mr-2"/> Visualizar Impacto</Button>}
          {!readOnly && <Button onClick={() => { toast.success("Tabela salva com sucesso."); onSalvar(data); }}><Save className="w-4 h-4 mr-2"/> Salvar Tabela</Button>}
        </div>
      </div>

      <Tabs defaultValue="aba1" className="w-full">
        <TabsList className="bg-slate-100 px-1 h-auto flex flex-wrap shadow-sm">
           <TabsTrigger value="aba1" className="text-[11px] uppercase tracking-wider py-2"><Coins className="w-3.5 h-3.5 mr-1"/> Identificação</TabsTrigger>
           <TabsTrigger value="aba2" className="text-[11px] uppercase tracking-wider py-2"><Zap className="w-3.5 h-3.5 mr-1"/> Regras Base</TabsTrigger>
           <TabsTrigger value="aba3" className="text-[11px] uppercase tracking-wider py-2">Faixas & Critérios</TabsTrigger>
           <TabsTrigger value="aba4" className="text-[11px] uppercase tracking-wider py-2">Adicionais & Taxas</TabsTrigger>
           <TabsTrigger value="aba5" className="text-[11px] uppercase tracking-wider py-2">Financeiro / Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="aba1">
           <Card>
             <CardHeader className="pb-3 border-b"><CardTitle className="text-sm">Configuração Mestra Comercial</CardTitle></CardHeader>
             <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <Field label="Nome da Tabela" className="lg:col-span-2"><Input value={data.nome} onChange={e => update("nome", e.target.value)} readOnly={readOnly}/></Field>
               <Field label="Cliente Específico (Vazio = Uso Geral)" className="lg:col-span-2">
                  {readOnly ? <Input value={data.cliente} readOnly /> : (
                     <SearchableSelect table="clientes" labelField="nome_fantasia" valueField="nome_fantasia" searchFields={["nome_fantasia", "cnpj"]} value={data.cliente} onChange={v => update("cliente", v || "")} placeholder="Buscar cliente..." />
                  )}
               </Field>
               <Field label="Unidade/Filial">
                  <Select value={data.unidade} onValueChange={v => update("unidade", v)} disabled={readOnly}>
                     <SelectTrigger><SelectValue/></SelectTrigger>
                     <SelectContent><SelectItem value="Todas">Todas / Matriz</SelectItem><SelectItem value="SP">São Paulo</SelectItem><SelectItem value="RJ">Rio de Janeiro</SelectItem></SelectContent>
                  </Select>
               </Field>
               <Field label="Tipo de Operação">
                  <Select value={data.tipoOperacao} onValueChange={v => update("tipoOperacao", v)} disabled={readOnly}>
                     <SelectTrigger><SelectValue/></SelectTrigger>
                     <SelectContent><SelectItem value="dedicado">Dedicado</SelectItem><SelectItem value="fracionado">Fracionado</SelectItem><SelectItem value="urbano">Distribuição Urbana</SelectItem><SelectItem value="todos">Aplicável a Todos</SelectItem></SelectContent>
                  </Select>
               </Field>
               <Field label="Data Vigência Início"><Input type="date" value={data.dataInicio} onChange={e => update("dataInicio", e.target.value)} readOnly={readOnly}/></Field>
               <Field label="Data Vigência Fim"><Input type="date" value={data.dataFim} onChange={e => update("dataFim", e.target.value)} readOnly={readOnly}/></Field>
               <Field label="Status da Tabela">
                  <Select value={data.status} onValueChange={v => update("status", v as any)} disabled={readOnly}>
                     <SelectTrigger><SelectValue/></SelectTrigger>
                     <SelectContent><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="inativa">Inativa</SelectItem><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="vencida">Vencida</SelectItem></SelectContent>
                  </Select>
               </Field>
               <Field label="Tipo de Tabela" className="lg:col-span-3 flex items-center pt-5">
                 <RadioGroup value={data.tipoTabela} onValueChange={v => update("tipoTabela", v)} className="flex gap-4" disabled={readOnly}>
                   <div className="flex items-center space-x-2"><RadioGroupItem value="principal" id="tp"/><Label htmlFor="tp" className="cursor-pointer">Principal (Substitui outras)</Label></div>
                   <div className="flex items-center space-x-2"><RadioGroupItem value="complementar" id="tc"/><Label htmlFor="tc" className="cursor-pointer">Complementar (Soma com Principal)</Label></div>
                 </RadioGroup>
               </Field>
               <Field label="Observações de Contrato" className="lg:col-span-4"><Textarea rows={2} value={data.observacoes} onChange={e => update("observacoes", e.target.value)} readOnly={readOnly}/></Field>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="aba2" className="space-y-4">
           {/* Regras Base */}
           <Card>
              <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="text-sm">Matriz de Formação de Preço</CardTitle>
                <CardDescription>Defina o gatilho gerador do custo primário.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
                 
                  <div className="border border-indigo-100 rounded-lg p-3 bg-indigo-50/30 space-y-2 md:col-span-4 lg:col-span-1">
                     <Label className="font-bold text-indigo-900 border-b border-indigo-100 pb-1 flex w-full">Método de Cobrança Base</Label>
                     {TIPOS_COBRANCA.map(cb => (
                        <div key={cb.id} className="flex items-center space-x-2 w-full hover:bg-white p-1 rounded transition">
                          <Switch checked={data.cobrancaPrincipais.includes(cb.id)} onCheckedChange={() => handleToggleCobranca(cb.id)} disabled={readOnly} id={`cb-${cb.id}`}/>
                          <Label htmlFor={`cb-${cb.id}`} className="text-xs cursor-pointer flex-1">{cb.label}</Label>
                        </div>
                     ))}
                  </div>

                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                     <Field label="Tipo Veículo Perfil (Múltiplo)">
                       <Select value={data.tipoVeiculo || ""} onValueChange={v => update("tipoVeiculo", v)} disabled={readOnly}>
                         <SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger>
                         <SelectContent>
                           <SelectItem value="qualquer">Qualquer Veículo</SelectItem>
                           {TIPOS_VEICULO.map(t => (
                             <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </Field>
                    <Field label="Exigência Térmica"><Select value={data.classificacaoTermica} onValueChange={v => update("classificacaoTermica", v)} disabled={readOnly}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="seco">Seco</SelectItem><SelectItem value="refrigerado">Refrigerado</SelectItem></SelectContent></Select></Field>
                    <Field label="Arredondamento de Cálculos"><Select value={data.arredondamento} onValueChange={v => update("arredondamento", v)} disabled={readOnly}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Matemático Normal</SelectItem><SelectItem value="cima">Sempre p/ Cima</SelectItem></SelectContent></Select></Field>

                    <div className="col-span-3 grid grid-cols-3 gap-4 border-t pt-4">
                       <Field label="Valor Base Tarifa (R$)"><Input type="number" value={data.valorBase} onChange={e => update("valorBase", Number(e.target.value))} readOnly={readOnly} className="font-bold text-blue-700 bg-blue-50"/></Field>
                       <Field label="Valor Mínimo Faturável (R$)"><Input type="number" value={data.minimoFaturavel} onChange={e => update("minimoFaturavel", Number(e.target.value))} readOnly={readOnly} /></Field>
                       <Field label="Valor Franquia/Km Incluso"><Input type="number" value={data.franquiaKm} onChange={e => update("franquiaKm", Number(e.target.value))} readOnly={readOnly} placeholder="ex: 100km gratuitos"/></Field>
                       
                       <Field label="Valor por Km Excedente (R$)"><Input type="number" value={data.valorKmExcedente} onChange={e => update("valorKmExcedente", Number(e.target.value))} readOnly={readOnly} /></Field>
                       <Field label="Custo Teto do Prestador (R$)"><Input type="number" value={data.custoPrestador} onChange={e => update("custoPrestador", Number(e.target.value))} readOnly={readOnly} className="text-orange-700"/></Field>
                       <Field label="Markup Desejável (%)"><Input type="number" value={data.markupPercent} onChange={e => update("markupPercent", Number(e.target.value))} readOnly={readOnly} className="font-bold text-green-700 bg-green-50"/></Field>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="aba3">
           <Card>
             <CardHeader className="flex flex-row justify-between items-center bg-slate-50 border-b pb-4">
               <div><CardTitle className="text-sm">Configuração Dinâmica de Faixas (Lógica Condicional)</CardTitle><CardDescription>Faixas de peso, cubagem ou localidade que agregam custo variável.</CardDescription></div>
               {!readOnly && <Button size="sm" onClick={addFaixa}><Plus className="w-4 h-4 mr-1"/> Adicionar Faixa Condicional</Button>}
             </CardHeader>
             <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                     <TableRow className="bg-slate-100/50">
                        <TableHead className="text-xs">Peso (Ini - Fim)</TableHead>
                        <TableHead className="text-xs">Km (Ini - Fim)</TableHead>
                        <TableHead className="text-xs">CEP (Máscara Reduzida)</TableHead>
                        <TableHead className="text-xs">Adicional (R$)</TableHead>
                        <TableHead className="text-xs">Prioridade</TableHead>
                        {!readOnly && <TableHead className="text-right text-xs">Ações</TableHead>}
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {data.faixas.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">Sem regras condicionais cadastradas. Use o valor base ou faixas se necessário.</TableCell></TableRow> : data.faixas.map((f, i) => (
                        <TableRow key={f.id}>
                           <TableCell><div className="flex gap-1 items-center"><Input className="w-16 h-8 text-xs p-1" value={f.pesoIni} onChange={e => {const t=[...data.faixas]; t[i].pesoIni = Number(e.target.value); update("faixas", t)}}/>- <Input className="w-16 h-8 text-xs p-1" value={f.pesoFim} onChange={e => {const t=[...data.faixas]; t[i].pesoFim = Number(e.target.value); update("faixas", t)}}/></div></TableCell>
                           <TableCell><div className="flex gap-1 items-center"><Input className="w-16 h-8 text-xs p-1" value={f.kmIni} onChange={e => {const t=[...data.faixas]; t[i].kmIni = Number(e.target.value); update("faixas", t)}}/>- <Input className="w-16 h-8 text-xs p-1" value={f.kmFim} onChange={e => {const t=[...data.faixas]; t[i].kmFim = Number(e.target.value); update("faixas", t)}}/></div></TableCell>
                           <TableCell><div className="flex gap-1 items-center"><Input className="w-20 h-8 text-xs p-1" placeholder="CEP Ini" value={f.cepIni} onChange={e => {const t=[...data.faixas]; t[i].cepIni = e.target.value; update("faixas", t)}}/>- <Input className="w-20 h-8 text-xs p-1" placeholder="CEP Fim" value={f.cepFim} onChange={e => {const t=[...data.faixas]; t[i].cepFim = e.target.value; update("faixas", t)}}/></div></TableCell>
                           <TableCell><Input className="w-24 h-8 text-xs font-bold text-green-700 bg-green-50" type="number" value={f.adicionalValor} onChange={e => {const t=[...data.faixas]; t[i].adicionalValor = Number(e.target.value); update("faixas", t)}}/></TableCell>
                           <TableCell><Input className="w-14 h-8 text-xs text-center" type="number" value={f.prioridade} onChange={e => {const t=[...data.faixas]; t[i].prioridade = Number(e.target.value); update("faixas", t)}}/></TableCell>
                           {!readOnly && (
                              <TableCell className="text-right space-x-1">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => update("faixas", [...data.faixas, {...f, id: String(Date.now())}])}><Copy className="w-3.5 h-3.5"/></Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => update("faixas", data.faixas.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5"/></Button>
                              </TableCell>
                           )}
                        </TableRow>
                     ))}
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="aba4">
           <Card>
             <CardHeader className="bg-slate-50 border-b pb-4"><CardTitle className="text-sm">Acessórios, Tarifas de Serviço e Penalidades</CardTitle></CardHeader>
             <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(data.adicionais).map(([k, cfg]: [string, any]) => (
                   <div key={k} className={`p-4 rounded-xl border flex flex-col gap-3 ${cfg.ativo ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                      <div className="flex justify-between items-center">
                         <Label className="font-bold text-slate-800 uppercase text-xs truncate max-w-[150px]">{k}</Label>
                         <Switch disabled={readOnly} checked={cfg.ativo} onCheckedChange={(v) => updateNested("adicionais", k as any, { ativo: v })} />
                      </div>
                      <div className="flex gap-2 w-full mt-2">
                         {cfg.tipo !== undefined && (
                            <Select disabled={!cfg.ativo || readOnly} value={cfg.tipo} onValueChange={(v) => updateNested("adicionais", k as any, { tipo: v })}>
                               <SelectTrigger className="w-[80px] h-9"><SelectValue/></SelectTrigger>
                               <SelectContent><SelectItem value="R$">R$</SelectItem><SelectItem value="%">%</SelectItem></SelectContent>
                            </Select>
                         )}
                         {cfg.valor !== undefined && (
                            <Input disabled={!cfg.ativo || readOnly} type="number" value={cfg.valor} onChange={(e) => updateNested("adicionais", k as any, { valor: Number(e.target.value) })} className="h-9 font-mono" placeholder="Valor"/>
                         )}
                         {cfg.valorPorcent !== undefined && (
                            <div className="relative w-full"><Input disabled={!cfg.ativo || readOnly} type="number" value={cfg.valorPorcent} onChange={(e) => updateNested("adicionais", k as any, { valorPorcent: Number(e.target.value) })} className="h-9 pr-8"/><span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span></div>
                         )}
                         {cfg.valorHora !== undefined && (
                            <div className="w-full flex flex-col gap-1">
                               <Input disabled={!cfg.ativo || readOnly} type="number" value={cfg.minutosFree} onChange={(e) => updateNested("adicionais", k as any, { minutosFree: Number(e.target.value) })} className="h-8 text-xs" placeholder="Min Free"/>
                               <Input disabled={!cfg.ativo || readOnly} type="number" value={cfg.valorHora} onChange={(e) => updateNested("adicionais", k as any, { valorHora: Number(e.target.value) })} className="h-8 text-xs" placeholder="R$/Hora extra"/>
                            </div>
                         )}
                      </div>
                   </div>
                ))}
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="aba5">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Integração Contábil</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                   <Field label="Conta Contábil Padrão do DRE"><Input value={data.contaContabil} onChange={e => update("contaContabil", e.target.value)} readOnly={readOnly}/></Field>
                   <Field label="Centro de Custo Financeiro"><Input value={data.centroCustoPadrao} onChange={e => update("centroCustoPadrao", e.target.value)} readOnly={readOnly}/></Field>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Histórico de Versões e Auditoria</CardTitle></CardHeader>
                <CardContent>
                   <div className="flex items-center gap-4 bg-orange-50 p-4 border border-orange-100 rounded-lg mb-4">
                      <CopyCheck className="w-6 h-6 text-orange-500 shrink-0"/>
                      <div>
                         <p className="text-sm font-bold text-orange-800">Versão Atual Ativa (v{data.versao})</p>
                         <p className="text-xs text-orange-600 mt-1">Modificada por Admin há 2 dias. Última simulação utilizou essa base.</p>
                      </div>
                      <Button variant="outline" className="ml-auto text-xs h-8">Comparar Modificações</Button>
                   </div>
                   <div className="text-sm text-center text-muted-foreground p-4 bg-slate-50 rounded border-dashed border">
                      Auditoria de alterações salva na Cloud do Supabase. Nenhuma divergência nas faixas de peso.
                   </div>
                </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
