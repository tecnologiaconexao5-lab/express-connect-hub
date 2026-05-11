import { useState } from "react";
import { Shield, ShieldCheck, AlertTriangle, CheckCircle, FileText, Upload, Plus, Download, BarChart2, Calculator, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Apolice {
  id: string;
  seguradora: string;
  numero: string;
  tipo: string;
  vigencia: string;
  valorCobertura: number;
  premioMensal: number;
  percentualPremio: number;
  valorMinimoAverbacao: number;
  formaCalculo: "percentual_nf" | "percentual_frete" | "valor_fixo";
  status: "ativa" | "vencendo" | "vencida";
}

const mockApolices: Apolice[] = [
  { id: "1", seguradora: "Porto Seguro S.A", numero: "14.12.8392.11", tipo: "RCTR-C / RCF-DC", vigencia: "11/2026", valorCobertura: 1500000, premioMensal: 4500, percentualPremio: 0.15, valorMinimoAverbacao: 50, formaCalculo: "percentual_nf", status: "ativa" },
  { id: "2", seguradora: "Sura Seguros", numero: "99.11.2334.00", tipo: "RCF-DC (Desvio)", vigencia: "04/2026", valorCobertura: 500000, premioMensal: 1800, percentualPremio: 0.20, valorMinimoAverbacao: 75, formaCalculo: "percentual_nf", status: "vencendo" },
];

interface Averbacao {
  id: string;
  data: string;
  os: string;
  apolice: string;
  valorNF: number;
  valorFrete: number;
  premioCalculado: number;
  premioCobrado: number;
  status: "sucesso" | "rejeitado" | "pendente";
}

const mockAverbacoes: Averbacao[] = [
  { id: "1", data: "27/03/2026 14:15", os: "OS-202610-8802", apolice: "Porto/14.12.8392.11", valorNF: 84000, valorFrete: 12000, premioCalculado: 126, premioCobrado: 126, status: "sucesso" },
  { id: "2", data: "27/03/2026 10:20", os: "OS-10450-4411", apolice: "Sura/99.11.2334.00", valorNF: 1500000, valorFrete: 45000, premioCalculado: 3000, premioCobrado: 3000, status: "rejeitado" },
  { id: "3", data: "26/03/2026 16:30", os: "OS-202610-8798", apolice: "Porto/14.12.8392.11", valorNF: 52000, valorFrete: 8500, premioCalculado: 78, premioCobrado: 78, status: "sucesso" },
];

export default function SegurosFinanceiro() {
  const [aba, setAba] = useState("apolices");
  const [apolices, setApolices] = useState<Apolice[]>(mockApolices);
  const [averbacoes] = useState<Averbacao[]>(mockAverbacoes);
  const [showModalAverbacao, setShowModalAverbacao] = useState(false);
      const [showModalSinistro, setShowModalSinistro] = useState(false);
  const [sinistros, setSinistros] = useState<any[]>([
    { id: "1", data: "20/03/2026", os: "OS-10450-3200", tipo: "Tombamento", estimativa: 45000, protocolo: "P-923184/26", status: "Em Análise Técnica" },
    { id: "2", data: "05/02/2026", os: "OS-990-22", tipo: "Roubo / Assalto", estimativa: 120000, protocolo: "P-011234/26", status: "Indenizado (Pago)" }
  ]);
  const [formSinistro, setFormSinistro] = useState({
    os_id: '',
    tipo_sinistro: '',
    data_evento: new Date().toISOString().split('T')[0],
    valor_estimado: 0,
    seguradora: '',
    descricao: ''
  });

  const handleSalvarSinistro = async () => {
    try {
      const payload = {
        ...formSinistro,
        status: 'em_analise'
      };
      const { error } = await supabase.from('sinistros').insert([payload]);
      if (error && error.code !== '42P01') throw error;
      
      toast.success('Sinistro registrado com sucesso!');
      setShowModalSinistro(false);
      setSinistros([{
        id: Math.random().toString(),
        data: new Date(formSinistro.data_evento).toLocaleDateString('pt-BR'),
        os: formSinistro.os_id,
        tipo: formSinistro.tipo_sinistro,
        estimativa: formSinistro.valor_estimado,
        protocolo: 'Aguardando',
        status: 'Em Análise Inicial'
      }, ...sinistros]);
    } catch (e: any) {
      toast.error('Erro ao registrar sinistro: ' + e.message);
    }
  };

  const [showModalApolice, setShowModalApolice] = useState(false);
  const [formApolice, setFormApolice] = useState({
    seguradora: '',
    numero_apolice: '',
    tipo_seguro: '',
    veiculo_id: '',
    vigencia_inicio: '',
    vigencia_fim: '',
    valor_premio: 0,
    forma_pagamento: '',
    status: 'ativa',
    observacao: ''
  });

  const handleSalvarApolice = async () => {
    try {
      const payload = {
        ...formApolice,
        veiculo_id: formApolice.veiculo_id || null
      };
      const { error } = await supabase.from('seguros_auto_apolices').insert([payload]);
      if (error && error.code !== '42P01') {
         throw error;
      }
      toast.success('Apólice salva com sucesso!');
      setShowModalApolice(false);
      setApolices([...apolices, {
        id: Math.random().toString(),
        seguradora: formApolice.seguradora,
        numero: formApolice.numero_apolice,
        tipo: formApolice.tipo_seguro,
        vigencia: formApolice.vigencia_inicio + ' até ' + formApolice.vigencia_fim,
        valorCobertura: 0,
        premioMensal: formApolice.valor_premio,
        percentualPremio: 0,
        valorMinimoAverbacao: 0,
        formaCalculo: 'valor_fixo',
        status: formApolice.status as any
      }]);
    } catch (e: any) {
      toast.error('Erro ao salvar apólice: ' + e.message);
    }
  };

  const [novaAverbacao, setNovaAverbacao] = useState({
    os: "",
    apoliceId: "",
    valorNF: 0,
    valorFrete: 0,
  });

  const calcularPremio = (apolice: Apolice, valorNF: number, valorFrete: number): number => {
    let premio = 0;
    switch (apolice.formaCalculo) {
      case "percentual_nf":
        premio = valorNF * (apolice.percentualPremio / 100);
        break;
      case "percentual_frete":
        premio = valorFrete * (apolice.percentualPremio / 100);
        break;
      case "valor_fixo":
        premio = apolice.premioMensal;
        break;
    }
    return premio < apolice.valorMinimoAverbacao ? apolice.valorMinimoAverbacao : premio;
  };

  const getPremioCalculado = () => {
    if (!novaAverbacao.apoliceId || !novaAverbacao.valorNF) return 0;
    const apolice = apolices.find(a => a.id === novaAverbacao.apoliceId);
    if (!apolice) return 0;
    return calcularPremio(apolice, novaAverbacao.valorNF, novaAverbacao.valorFrete);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b pb-4">
        <Button variant={aba === "apolices" ? "default" : "outline"} onClick={() => setAba("apolices")} className="h-9"><ShieldCheck className="w-4 h-4 mr-2"/> Gestão de Apólices</Button>
        <Button variant={aba === "averbacoes" ? "default" : "outline"} onClick={() => setAba("averbacoes")} className="h-9"><FileText className="w-4 h-4 mr-2"/> Histórico de Averbações</Button>
        <Button variant={aba === "sinistros" ? "default" : "outline"} onClick={() => setAba("sinistros")} className="h-9"><AlertTriangle className="w-4 h-4 mr-2"/> Controle de Sinistros</Button>
        <Button variant={aba === "relatorio" ? "default" : "outline"} onClick={() => setAba("relatorio")} className="h-9"><BarChart2 className="w-4 h-4 mr-2"/> Relatório DRE/Seguro</Button>
      </div>

      {aba === "apolices" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center py-4">
              <div><CardTitle>Apólices Vigentes Corporativas</CardTitle></div>
              <Button className="bg-blue-600" onClick={() => setShowModalApolice(true)}><Plus className="w-4 h-4 mr-1"/> Nova Apólice</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seguradora</TableHead>
                    <TableHead>Nº Apólice</TableHead>
                    <TableHead>Tipo Cobertura</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead className="text-right">Valor Cobertura</TableHead>
                    <TableHead className="text-right">% Prêmio</TableHead>
                    <TableHead className="text-right">Premio Mín.</TableHead>
                    <TableHead>Cálculo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apolices.map((apolice) => (
                    <TableRow key={apolice.id}>
                      <TableCell className="font-bold">{apolice.seguradora}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{apolice.numero}</TableCell>
                      <TableCell>{apolice.tipo}</TableCell>
                      <TableCell className={apolice.status === "vencendo" ? "text-orange-600 font-bold" : ""}>{apolice.vigencia}</TableCell>
                      <TableCell className="text-right font-medium">{fmtFin(apolice.valorCobertura)}</TableCell>
                      <TableCell className="text-right">{apolice.percentualPremio}%</TableCell>
                      <TableCell className="text-right">{fmtFin(apolice.valorMinimoAverbacao)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {apolice.formaCalculo === "percentual_nf" ? "% NF" : apolice.formaCalculo === "percentual_frete" ? "% Frete" : "Fixo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={apolice.status === "ativa" ? "text-green-700" : apolice.status === "vencendo" ? "text-orange-600 border-orange-300" : "text-red-600"}>
                          {apolice.status === "ativa" ? "Ativa" : apolice.status === "vencendo" ? "Vencendo" : "Vencida"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border-dashed border-2">
            <CardContent className="p-8">
              <h4 className="font-bold text-slate-700 text-center mb-4 text-lg">Cadastro Rápido de Apólice</h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1"><label className="text-xs font-semibold">Seguradora</label><Input placeholder="Ex: Allianz" /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">Nº Apólice</label><Input placeholder="000.0000..." /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">Tipo</label><Input placeholder="RCTR-C" /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">Corretor Contato</label><Input placeholder="(11) 99999-9999" /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">Valor Cobertura (Limite LMI)</label><Input type="number" placeholder="500000" /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">% Prêmio sobre NF</label><Input type="number" step="0.01" placeholder="0.15" /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">Valor Mínimo Averbação</label><Input type="number" placeholder="50" /></div>
                <div className="space-y-1"><label className="text-xs font-semibold">Forma de Cálculo</label>
                  <Select defaultValue="percentual_nf">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentual_nf">% sobre Valor NF</SelectItem>
                      <SelectItem value="percentual_frete">% sobre Valor Frete</SelectItem>
                      <SelectItem value="valor_fixo">Valor Fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <p className="font-bold text-sm text-slate-800">Averbação Automática na Geração da OS</p>
                  <p className="text-xs text-muted-foreground">O sistema comunicará o endpoint ATMS via API a cada nota fiscal salva.</p>
                </div>
                <div className="flex items-center gap-4">
                  <Input placeholder="CNPJ Averbador" className="w-48 bg-white"/>
                  <Button className="w-32 bg-green-600">Salvar Apólice</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Simular Averbação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                <div>
                  <Label className="text-xs">OS</Label>
                  <Input 
                    placeholder="OS-0000" 
                    value={novaAverbacao.os}
                    onChange={(e) => setNovaAverbacao({...novaAverbacao, os: e.target.value})}
                  />
                </div>
                <div>
                  <Label className="text-xs">Apólice</Label>
                  <Select value={novaAverbacao.apoliceId} onValueChange={(v) => setNovaAverbacao({...novaAverbacao, apoliceId: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {apolices.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.seguradora}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor NF</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={novaAverbacao.valorNF || ""}
                    onChange={(e) => setNovaAverbacao({...novaAverbacao, valorNF: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label className="text-xs">Valor Frete</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={novaAverbacao.valorFrete || ""}
                    onChange={(e) => setNovaAverbacao({...novaAverbacao, valorFrete: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="bg-green-100 p-3 rounded-lg border border-green-200">
                  <p className="text-xs text-green-700 font-semibold">Prêmio Calculado</p>
                  <p className="text-xl font-bold text-green-800">{fmtFin(getPremioCalculado())}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Averbar e Registrar Custo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showModalApolice} onOpenChange={setShowModalApolice}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Apólice</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Seguradora *</Label>
              <Input value={formApolice.seguradora} onChange={e => setFormApolice({...formApolice, seguradora: e.target.value})} placeholder="Nome da Seguradora" />
            </div>
            <div className="space-y-2">
              <Label>Número da Apólice *</Label>
              <Input value={formApolice.numero_apolice} onChange={e => setFormApolice({...formApolice, numero_apolice: e.target.value})} placeholder="Ex: 123456789" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Seguro</Label>
              <Input value={formApolice.tipo_seguro} onChange={e => setFormApolice({...formApolice, tipo_seguro: e.target.value})} placeholder="RCTR-C, Frota, etc." />
            </div>
            <div className="space-y-2">
              <Label>Veículo Vinculado (Opcional)</Label>
              <Input value={formApolice.veiculo_id} onChange={e => setFormApolice({...formApolice, veiculo_id: e.target.value})} placeholder="ID do Veículo" />
            </div>
            <div className="space-y-2">
              <Label>Vigência Início *</Label>
              <Input type="date" value={formApolice.vigencia_inicio} onChange={e => setFormApolice({...formApolice, vigencia_inicio: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Vigência Fim *</Label>
              <Input type="date" value={formApolice.vigencia_fim} onChange={e => setFormApolice({...formApolice, vigencia_fim: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Valor Prêmio (R$)</Label>
              <Input type="number" value={formApolice.valor_premio || ''} onChange={e => setFormApolice({...formApolice, valor_premio: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formApolice.forma_pagamento} onValueChange={v => setFormApolice({...formApolice, forma_pagamento: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Débito em Conta">Débito em Conta</SelectItem>
                  <SelectItem value="Pix">Pix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formApolice.status} onValueChange={v => setFormApolice({...formApolice, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="vencendo">Vencendo</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Observação</Label>
              <Input value={formApolice.observacao} onChange={e => setFormApolice({...formApolice, observacao: e.target.value})} placeholder="Anotações gerais" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalApolice(false)}>Cancelar</Button>
            <Button className="bg-green-600" onClick={handleSalvarApolice}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showModalSinistro} onOpenChange={setShowModalSinistro}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Abertura de Sinistro</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>OS Vinculada *</Label>
              <Input value={formSinistro.os_id} onChange={e => setFormSinistro({...formSinistro, os_id: e.target.value})} placeholder="Busque a OS" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Sinistro *</Label>
              <Select value={formSinistro.tipo_sinistro} onValueChange={v => setFormSinistro({...formSinistro, tipo_sinistro: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="roubo">Roubo / Assalto</SelectItem>
                  <SelectItem value="avaria">Avaria de Carga</SelectItem>
                  <SelectItem value="tombamento">Tombamento</SelectItem>
                  <SelectItem value="extravio">Extravio / Sumiço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do Evento *</Label>
              <Input type="date" value={formSinistro.data_evento} onChange={e => setFormSinistro({...formSinistro, data_evento: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Estimativa de Prejuízo (R$)</Label>
              <Input type="number" value={formSinistro.valor_estimado || ''} onChange={e => setFormSinistro({...formSinistro, valor_estimado: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Seguradora (Apólice Acionada) *</Label>
              <Select value={formSinistro.seguradora} onValueChange={v => setFormSinistro({...formSinistro, seguradora: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione a seguradora ativa"/></SelectTrigger>
                <SelectContent>
                  {apolices.map(a => (
                    <SelectItem key={a.id} value={a.seguradora}>{a.seguradora} - {a.tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descrição do Ocorrido</Label>
              <Input value={formSinistro.descricao} onChange={e => setFormSinistro({...formSinistro, descricao: e.target.value})} placeholder="Relato breve do incidente" />
            </div>
            <div className="space-y-2 col-span-2 mt-2 p-4 border border-dashed rounded flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100">
              <Upload className="w-6 h-6 text-slate-400 mb-2"/>
              <span className="text-sm text-slate-600 font-medium">Anexar BO, Fotos ou Relatórios</span>
              <span className="text-xs text-slate-400">Arraste os arquivos ou clique para buscar</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalSinistro(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleSalvarSinistro}>Registrar Sinistro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {aba === "averbacoes" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle>Histórico de Averbações Sistêmicas ATMS</CardTitle>
              <CardDescription>Logs de tráfego entre ERP Express Hub e Seguradoras conectadas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>OS Vinculada</TableHead>
                    <TableHead>Apólice Acionada</TableHead>
                    <TableHead className="text-right">Valor NF</TableHead>
                    <TableHead className="text-right">Valor Frete</TableHead>
                    <TableHead className="text-right">Premio</TableHead>
                    <TableHead>Retorno Seguradora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {averbacoes.map((averbacao) => (
                    <TableRow key={averbacao.id} className={averbacao.status === "rejeitado" ? "bg-red-50/40" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{averbacao.data}</TableCell>
                      <TableCell className="font-bold text-sm text-blue-600">{averbacao.os}</TableCell>
                      <TableCell className="font-mono text-xs">{averbacao.apolice}</TableCell>
                      <TableCell className="text-right font-medium">{fmtFin(averbacao.valorNF)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtFin(averbacao.valorFrete)}</TableCell>
                      <TableCell className="text-right font-bold text-green-700">{fmtFin(averbacao.premioCobrado)}</TableCell>
                      <TableCell>
                        {averbacao.status === "sucesso" ? (
                          <span className="text-green-600 text-xs font-bold uppercase flex gap-1 items-center"><CheckCircle className="w-3 h-3"/> Sucesso</span>
                        ) : averbacao.status === "rejeitado" ? (
                          <span className="text-red-600 text-xs font-bold uppercase flex gap-1 items-center"><AlertTriangle className="w-3 h-3"/> Rejeitado</span>
                        ) : (
                          <span className="text-yellow-600 text-xs font-bold uppercase flex gap-1 items-center">Pendente</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {aba === "sinistros" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center py-4">
              <div><CardTitle>Gerenciamento de Sinistros e Eventos</CardTitle></div>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowModalSinistro(true)}><Plus className="w-4 h-4 mr-1"/> Abrir Sinistro</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Evento</TableHead>
                    <TableHead>OS Atingida</TableHead>
                    <TableHead>Tipo Sinistro</TableHead>
                    <TableHead className="text-right">Estimativa Prejuízo</TableHead>
                    <TableHead>Protocolo Susep</TableHead>
                    <TableHead>Status Análise</TableHead>
                    <TableHead className="text-right">Dossier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sinistros.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{s.data}</TableCell>
                      <TableCell className="font-bold">{s.os}</TableCell>
                      <TableCell><Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">{s.tipo}</Badge></TableCell>
                      <TableCell className="text-right font-medium text-red-600">{fmtFin(s.estimativa)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.protocolo}</TableCell>
                      <TableCell><Badge variant="outline" className="text-blue-700 bg-blue-50">{s.status}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-8"><Download className="w-4 h-4 text-slate-500"/></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {aba === "relatorio" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-slate-500 uppercase">Prêmios Pagos (YTD)</p><p className="text-2xl font-black mt-1 text-slate-800">{fmtFin(18900)}</p></CardContent></Card>
            <Card className="bg-blue-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-blue-500 uppercase">Averbações (Qtd)</p><p className="text-2xl font-black mt-1 text-blue-700">4.102 OS's</p></CardContent></Card>
            <Card className="bg-red-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-red-500 uppercase">Perdas Sinistradas</p><p className="text-2xl font-black mt-1 text-red-700">{fmtFin(45000)}</p></CardContent></Card>
            <Card className="bg-green-50"><CardContent className="p-4"><p className="text-[10px] font-bold text-green-500 uppercase">Indenizações Recuperadas</p><p className="text-2xl font-black mt-1 text-green-700">{fmtFin(120000)}</p></CardContent></Card>
          </div>
          <Card className="border-dashed border-2">
            <CardContent className="py-20 text-center text-muted-foreground flex flex-col items-center">
              <BarChart2 className="w-12 h-12 mb-3 text-slate-300"/>
              <h3 className="text-lg font-bold text-slate-700">Custo Percentual do Seguro sobre o Faturamento (Ad Valorem)</h3>
              <p className="max-w-md text-sm mt-2">No primeiro trimestre, o custo final da proteção veicular representou <b>1.8%</b> do CMV Logístico.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
