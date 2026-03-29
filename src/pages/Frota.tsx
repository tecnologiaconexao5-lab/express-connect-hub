import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Car, Wrench, Fuel, FileText, Shield, PieChart, Info, AlertTriangle, CheckCircle, Plus, MapPin, Phone, Building2, CreditCard, Truck, Search, Upload, DollarSign, Gauge } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface PostoConveniado {
  id: number;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  combustiveis: string[];
  tipoConvenio: 'desconto' | 'tabelado' | 'cartao';
  desconto: { [key: string]: number };
  limiteCredito: number;
  contato: string;
  status: 'ativo' | 'inativo';
}

const mockPostos: PostoConveniado[] = [
  { id: 1, nome: "Posto Ipiranga Rota 2", razaoSocial: "Ipiranga Derivados de Petróleo Ltda", cnpj: "12.345.678/0001-90", endereco: "Rod. Régis Bittencourt, 1500 - São Paulo/SP", combustiveis: ["Diesel S10", "Diesel S500", "Etanol", "Gasolina"], tipoConvenio: "desconto", desconto: { "Diesel S10": 0.12, "Diesel S500": 0.10, "Etanol": 0.08, "Gasolina": 0.05 }, limiteCredito: 50000, contato: "João - (11) 99999-0001", status: "ativo" },
  { id: 2, nome: "Posto Ale Centro", razaoSocial: "Ale Combustíveis S/A", cnpj: "23.456.789/0001-01", endereco: "Av. Paulista, 500 - São Paulo/SP", combustiveis: ["Etanol", "Gasolina"], tipoConvenio: "desconto", desconto: { "Etanol": 0.06, "Gasolina": 0.04 }, limiteCredito: 25000, contato: "Maria - (11) 99999-0002", status: "ativo" },
  { id: 3, nome: "Shell highway", razaoSocial: "Shell Brasil Ltda", cnpj: "34.567.890/0001-12", endereco: "Rod. Anhanguera, km 50 - Campinas/SP", combustiveis: ["Diesel S10", "Diesel S500", "Etanol", "Gasolina", "GNV"], tipoConvenio: "tabelado", desconto: {}, limiteCredito: 80000, contato: "Carlos - (19) 99999-0003", status: "ativo" },
];

interface Abastecimento {
  id: number;
  postoId: number;
  postoNome: string;
  veiculo: string;
  prestador: string;
  os?: string;
  combustivel: string;
  litros: number;
  precoUnitario: number;
  precoReferencia: number;
  desconto: number;
  valorFinal: number;
  hodometro: number;
  data: string;
}

const mockAbastecimentos: Abastecimento[] = [
  { id: 1, postoId: 1, postoNome: "Posto Ipiranga Rota 2", veiculo: "ABC-1234", prestador: "João Transporte", os: "OS-420", combustivel: "Diesel S10", litros: 55, precoUnitario: 5.18, precoReferencia: 5.89, desconto: 0.12, valorFinal: 250.19, hodometro: 42100, data: "27/03/2026" },
  { id: 2, postoId: 2, postoNome: "Posto Ale Centro", veiculo: "XYZ-9876", prestador: "Maria Logistics", combustivel: "Etanol", litros: 42, precoUnitario: 3.45, precoReferencia: 3.67, desconto: 0.06, valorFinal: 136.01, hodometro: 185320, data: "26/03/2026" },
  { id: 3, postoId: 1, postoNome: "Posto Ipiranga Rota 2", veiculo: "GHI-4433", prestador: "Transportes ABC", os: "OS-425", combustivel: "Diesel S10", litros: 60, precoUnitario: 5.18, precoReferencia: 5.89, desconto: 0.12, valorFinal: 273.50, hodometro: 98200, data: "25/03/2026" },
];

interface Multa {
  id: number;
  veiculo: string;
  prestador?: string;
  data: string;
  descricao: string;
  valor: number;
  status: 'pagar' | 'recorrer' | 'paga' | 'recorrida';
  infracao: string;
}

const mockMultas: Multa[] = [
  { id: 1, veiculo: "ABC-1234", prestador: "João Transporte", data: "15/03/2026", descricao: "Excesso de velocidade", valor: 130.16, status: "pagar", infracao: "Art. 218 - Lei 9503" },
  { id: 2, veiculo: "XYZ-9876", data: "20/03/2026", descricao: "Estacionamento irregular", valor: 68.50, status: "recorrer", infracao: "Art. 181 - Lei 9503" },
  { id: 3, veiculo: "GHI-4433", prestador: "Transportes ABC", data: "10/03/2026", descricao: "Transitar em faixa exclusiva", valor: 88.38, status: "paga", infracao: "Art. 183 - Lei 9503" },
];

export default function Frota() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "manutencao";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });
  
  const [postos, setPostos] = useState<PostoConveniado[]>(mockPostos);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>(mockAbastecimentos);
  const [multas, setMultas] = useState<Multa[]>(mockMultas);
  const [showPostoModal, setShowPostoModal] = useState(false);
  const [showAbastecimentoModal, setShowAbastecimentoModal] = useState(false);
  const [showMultaModal, setShowMultaModal] = useState(false);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-8 h-8 text-primary" /> Gestão de Frota e Veículos
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">Controle, custos e abastecimento.<Badge variant="secondary" className="bg-amber-100 text-amber-800 ml-2">Módulo em Desenvolvimento</Badge></p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="veiculos" className="px-5"><Car className="w-4 h-4 mr-2"/> Veículos</TabsTrigger>
           <TabsTrigger value="manutencao" className="px-5"><Wrench className="w-4 h-4 mr-2"/> Manutenção</TabsTrigger>
           <TabsTrigger value="abastecimento" className="px-5"><Fuel className="w-4 h-4 mr-2"/> Abastecimento</TabsTrigger>
           <TabsTrigger value="postos" className="px-5"><Building2 className="w-4 h-4 mr-2"/> Postos Conveniados</TabsTrigger>
           <TabsTrigger value="multas" className="px-5"><AlertTriangle className="w-4 h-4 mr-2"/> Multas</TabsTrigger>
           <TabsTrigger value="documentos" className="px-5"><FileText className="w-4 h-4 mr-2"/> Documentos</TabsTrigger>
           <TabsTrigger value="seguros" className="px-5"><Shield className="w-4 h-4 mr-2"/> Seguros</TabsTrigger>
           <TabsTrigger value="custos" className="px-5"><PieChart className="w-4 h-4 mr-2"/> Custos</TabsTrigger>
        </TabsList>

        <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-lg text-sm text-blue-800 flex items-center gap-3">
           <Info className="w-5 h-5 text-blue-600 shrink-0"/>
           Esse módulo está em transição analítica. No futuro, todos os lançamentos gerarão contabilidade e integrarão com o <b>Portal do Prestador</b> para avisos de manutenções correntes.
        </div>

        {/* --- VEÍCULOS --- */}
        <TabsContent value="veiculos" className="pt-2 space-y-4">
          <div className="flex justify-between items-center">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-blue-50 border-blue-200"><CardContent className="p-4"><p className="text-xs font-bold text-blue-600 uppercase">Total Veículos</p><p className="text-2xl font-black text-blue-700">24</p></CardContent></Card>
              <Card className="bg-green-50 border-green-200"><CardContent className="p-4"><p className="text-xs font-bold text-green-600 uppercase">Disponíveis</p><p className="text-2xl font-black text-green-700">18</p></CardContent></Card>
              <Card className="bg-orange-50 border-orange-200"><CardContent className="p-4"><p className="text-xs font-bold text-orange-600 uppercase">Em Rota</p><p className="text-2xl font-black text-orange-700">4</p></CardContent></Card>
              <Card className="bg-red-50 border-red-200"><CardContent className="p-4"><p className="text-xs font-bold text-red-600 uppercase">Manutenção</p><p className="text-2xl font-black text-red-700">2</p></CardContent></Card>
            </div>
            <Button className="bg-primary"><Plus className="w-4 h-4 mr-1"/> Novo Veículo</Button>
          </div>
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Car className="w-4 h-4"/> Frota Ativa</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Placa</TableHead><TableHead>Tipo</TableHead><TableHead>Prestador</TableHead><TableHead>Status</TableHead><TableHead>Documento</TableHead><TableHead>Última Revisão</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell className="font-bold">ABC-1234</TableCell><TableCell><Badge variant="outline">Fiorino</Badge></TableCell><TableCell className="text-sm">João Transporte</TableCell><TableCell><Badge className="bg-green-100 text-green-800">Disponível</Badge></TableCell><TableCell className="text-green-600 text-xs">OK - 31/10/26</TableCell><TableCell className="text-xs">15/03/2026</TableCell></TableRow>
                  <TableRow><TableCell className="font-bold">XYZ-9876</TableCell><TableCell><Badge variant="outline">HR</Badge></TableCell><TableCell className="text-sm">Maria Logistics</TableCell><TableCell><Badge className="bg-blue-100 text-blue-800">Em Rota</Badge></TableCell><TableCell className="text-green-600 text-xs">OK - 15/12/26</TableCell><TableCell className="text-xs">10/02/2026</TableCell></TableRow>
                  <TableRow><TableCell className="font-bold">GHI-4433</TableCell><TableCell><Badge variant="outline">VUC 3/4</Badge></TableCell><TableCell className="text-sm">Transportes ABC</TableCell><TableCell><Badge className="bg-green-100 text-green-800">Disponível</Badge></TableCell><TableCell className="text-orange-600 text-xs font-bold">Vence em 30d</TableCell><TableCell className="text-xs">20/01/2026</TableCell></TableRow>
                  <TableRow><TableCell className="font-bold">UUV-8833</TableCell><TableCell><Badge variant="outline">Carreta LS</Badge></TableCell><TableCell className="text-sm">-</TableCell><TableCell><Badge className="bg-red-100 text-red-800">Manutenção</Badge></TableCell><TableCell className="text-green-600 text-xs">OK - 20/08/26</TableCell><TableCell className="text-xs">26/03/2026</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- MANUTENCAO --- */}
        <TabsContent value="manutencao" className="pt-2">
           <Card>
              <CardHeader className="flex flex-row justify-between items-center py-4">
                <div><CardTitle>Histórico de Manutenções</CardTitle><CardDescription>Registros preventivos e corretivos com estimativa da próxima parada.</CardDescription></div>
                <Button className="bg-blue-600"><Plus className="w-4 h-4 mr-1"/> Nova OS Oficina</Button>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Veículo / Placa</TableHead><TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead>Custo Oficial</TableHead><TableHead>Próxima Revisão</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell className="font-bold">ABC-1234 (Fiorino)</TableCell>
                       <TableCell><Badge variant="outline" className="border-green-200 text-green-700">Preventiva</Badge></TableCell>
                       <TableCell>15/03/2026</TableCell>
                       <TableCell className="font-medium text-red-600">{fmtFin(850.00)}</TableCell>
                       <TableCell>50.000 Km</TableCell>
                       <TableCell><span className="text-sm font-bold text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Concluído</span></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-bold">XYZ-9876 (HR)</TableCell>
                       <TableCell><Badge variant="outline" className="border-red-200 text-red-700">Corretiva</Badge></TableCell>
                       <TableCell>26/03/2026</TableCell>
                       <TableCell className="font-medium text-red-600">{fmtFin(2100.00)}</TableCell>
                       <TableCell>12/2026</TableCell>
                       <TableCell><span className="text-sm font-bold text-orange-600 flex items-center gap-1"><Wrench className="w-3 h-3"/> Na Oficina</span></TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- ABASTECIMENTO --- */}
        <TabsContent value="abastecimento" className="pt-2">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
             <Card className="border-l-4 border-l-orange-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Gasto em Abastecimento (Mês)</p><p className="text-2xl font-bold mt-1 text-orange-600">{fmtFin(4580.00)}</p></CardContent></Card>
             <Card className="border-l-4 border-l-blue-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Litros Consumidos (Mês)</p><p className="text-2xl font-bold mt-1 text-blue-600">845 L</p></CardContent></Card>
             <Card className="border-l-4 border-l-green-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Média Geral da Frota</p><p className="text-2xl font-bold mt-1 text-green-600">8.2 Km/L</p></CardContent></Card>
           </div>
           <Card>
              <CardHeader className="flex flex-row justify-between items-center py-4">
                <div><CardTitle>Diário de Abastecimento</CardTitle></div>
                <Button variant="outline"><Plus className="w-4 h-4 mr-1"/> Lançar Cupom Fiscal</Button>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo / Placa</TableHead><TableHead>Posto</TableHead><TableHead>Km Momento</TableHead><TableHead>Litros / Combust.</TableHead><TableHead className="text-right">Valor Total</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell>27/03/2026</TableCell><TableCell className="font-bold">ABC-1234</TableCell><TableCell>Posto Ipiranga Rota 2</TableCell>
                       <TableCell>42.100</TableCell><TableCell>55 L (Diesel S10)</TableCell><TableCell className="text-right font-medium text-red-600">{fmtFin(350.00)}</TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell>26/03/2026</TableCell><TableCell className="font-bold">XYZ-9876</TableCell><TableCell>Posto Ale Centro</TableCell>
                       <TableCell>185.320</TableCell><TableCell>42 L (Etanol)</TableCell><TableCell className="text-right font-medium text-red-600">{fmtFin(145.00)}</TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
            </Card>
         </TabsContent>

        {/* --- POSTOS CONVENIADOS --- */}
        <TabsContent value="postos" className="pt-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="border-l-4 border-l-blue-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Postos Ativos</p><p className="text-2xl font-bold mt-1 text-blue-600">{postos.filter(p => p.status === 'ativo').length}</p></CardContent></Card>
            <Card className="border-l-4 border-l-green-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Economia no Mês</p><p className="text-2xl font-bold mt-1 text-green-600">{fmtFin(1245.80)}</p></CardContent></Card>
            <Card className="border-l-4 border-l-orange-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Abastecimentos no Mês</p><p className="text-2xl font-bold mt-1 text-orange-600">{abastecimentos.length}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center py-4">
              <div><CardTitle>Postos Conveniados</CardTitle><CardDescription>Cadastro de parceiros para desconto em combustível</CardDescription></div>
              <Button className="bg-primary" onClick={() => setShowPostoModal(true)}><Plus className="w-4 h-4 mr-1"/> Novo Posto</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Posto</TableHead><TableHead>CNPJ</TableHead><TableHead>Endereço</TableHead><TableHead>Tipo Convênio</TableHead><TableHead>Limite Crédito</TableHead><TableHead>Combustíveis</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {postos.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold">{p.nome}</TableCell>
                      <TableCell className="text-xs font-mono">{p.cnpj}</TableCell>
                      <TableCell className="text-xs max-w-[200px]">{p.endereco}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{p.tipoConvenio === 'desconto' ? 'Desconto %' : p.tipoConvenio === 'tabelado' ? 'Preço Tabelado' : 'Cartão Frota'}</Badge></TableCell>
                      <TableCell className="font-medium">{fmtFin(p.limiteCredito)}</TableCell>
                      <TableCell className="text-xs">{p.combustiveis.slice(0,2).join(', ')}{p.combustiveis.length > 2 && ` +${p.combustiveis.length-2}`}</TableCell>
                      <TableCell><Badge className={p.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center py-4">
              <div><CardTitle>Registro de Abastecimento</CardTitle><CardDescription>Lançamentos por posto conveniado</CardDescription></div>
              <Button variant="outline" onClick={() => setShowAbastecimentoModal(true)}><Plus className="w-4 h-4 mr-1"/> Novo Abastecimento</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Prestador</TableHead><TableHead>OS</TableHead><TableHead>Combustível</TableHead><TableHead className="text-right">Litros</TableHead><TableHead className="text-right">Valor Final</TableHead><TableHead className="text-right">Economia</TableHead></TableRow></TableHeader>
                <TableBody>
                  {abastecimentos.map(a => {
                    const valorSemDesconto = a.litros * a.precoReferencia;
                    const economia = valorSemDesconto - a.valorFinal;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{a.data}</TableCell>
                        <TableCell className="font-bold">{a.veiculo}</TableCell>
                        <TableCell className="text-sm">{a.prestador}</TableCell>
                        <TableCell className="text-xs">{a.os || '-'}</TableCell>
                        <TableCell className="text-sm">{a.combustivel}</TableCell>
                        <TableCell className="text-right font-mono">{a.litros.toFixed(2)} L</TableCell>
                        <TableCell className="text-right font-medium">{fmtFin(a.valorFinal)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">-{fmtFin(economia)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- MULTAS --- */}
        <TabsContent value="multas" className="pt-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Card className="border-l-4 border-l-red-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Total Multas (Mês)</p><p className="text-2xl font-bold mt-1 text-red-600">3</p></CardContent></Card>
            <Card className="border-l-4 border-l-orange-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Valor Total</p><p className="text-2xl font-bold mt-1 text-orange-600">{fmtFin(287.04)}</p></CardContent></Card>
            <Card className="border-l-4 border-l-blue-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">A Pagar</p><p className="text-2xl font-bold mt-1 text-blue-600">1</p></CardContent></Card>
            <Card className="border-l-4 border-l-purple-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Em Recurso</p><p className="text-2xl font-bold mt-1 text-purple-600">1</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center py-4">
              <div><CardTitle>Registro de Multas</CardTitle><CardDescription>Infrações por veículo e prestador</CardDescription></div>
              <Button variant="outline" onClick={() => setShowMultaModal(true)}><Plus className="w-4 h-4 mr-1"/> Registrar Multa</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Prestador</TableHead><TableHead>Descrição</TableHead><TableHead>Infração</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {multas.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{m.data}</TableCell>
                      <TableCell className="font-bold">{m.veiculo}</TableCell>
                      <TableCell className="text-sm">{m.prestador || '-'}</TableCell>
                      <TableCell className="text-sm max-w-[200px]">{m.descricao}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.infracao}</TableCell>
                      <TableCell className="text-right font-medium">{fmtFin(m.valor)}</TableCell>
                      <TableCell>
                        <Badge className={
                          m.status === 'pagar' ? 'bg-red-100 text-red-800' :
                          m.status === 'paga' ? 'bg-green-100 text-green-800' :
                          m.status === 'recorrer' ? 'bg-orange-100 text-orange-800' :
                          'bg-purple-100 text-purple-800'
                        }>
                          {m.status === 'pagar' ? 'A Pagar' : m.status === 'paga' ? 'Paga' : m.status === 'recorrer' ? 'Em Recurso' : 'Recorrida'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- DOCUMENTOS --- */}
        <TabsContent value="documentos" className="pt-2">
           <Card>
              <CardHeader className="py-4">
                <CardTitle>Vencimentos Centralizados e CRLV</CardTitle>
                <CardDescription>Gerencie documentos críticos de cada caminhão ou Fiorino. O sistema te avisa 30 dias antes.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Documento</TableHead><TableHead>Órgão</TableHead><TableHead>Vencimento</TableHead><TableHead>Alerta Padrão</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell className="font-bold">ABC-1234</TableCell>
                       <TableCell>CRLV Exercicio 2026</TableCell><TableCell>Detran-SP</TableCell>
                       <TableCell>31/10/2026</TableCell><TableCell>30/09/2026</TableCell>
                       <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Em dia</Badge></TableCell>
                     </TableRow>
                     <TableRow className="bg-orange-50/50">
                       <TableCell className="font-bold">UUV-8833</TableCell>
                       <TableCell>ANTT Proprietário</TableCell><TableCell>ANTT</TableCell>
                       <TableCell className="text-orange-700 font-bold">15/04/2026</TableCell><TableCell>15/03/2026</TableCell>
                       <TableCell><Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 gap-1"><AlertTriangle className="w-3 h-3"/> Vence em 18d</Badge></TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- SEGUROS --- */}
        <TabsContent value="seguros" className="pt-2">
           <Card>
              <CardHeader className="py-4 justify-between flex flex-row">
                <CardTitle>Apólices e RCTR-C</CardTitle>
                <Button className="bg-blue-600"><Plus className="w-4 h-4 mr-1"/> Adicionar Apólice</Button>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Seguradora</TableHead><TableHead>Apólice</TableHead><TableHead>Vigência</TableHead><TableHead>Cobertura Franquia</TableHead><TableHead>Veículos Protegidos</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell className="font-bold">Casco (Total)</TableCell>
                       <TableCell>Porto Seguro</TableCell>
                       <TableCell>001.2025.AXX.332</TableCell>
                       <TableCell>10/01/2027</TableCell>
                       <TableCell>100% FIPE (R$ 4.500 Franquia)</TableCell>
                       <TableCell>08 Veículos (Frotista)</TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-bold">RCTR-C / RCF-DC</TableCell>
                       <TableCell>Sura Seguros</TableCell>
                       <TableCell>202.2025.RCTR.440</TableCell>
                       <TableCell>30/12/2026</TableCell>
                       <TableCell>R$ 1.500.000 (Sem Franquia em Acidente)</TableCell>
                       <TableCell>Todos da Obra</TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- CUSTOS --- */}
        <TabsContent value="custos" className="pt-2">
           <Card className="max-w-4xl mx-auto">
              <CardHeader className="text-center py-8">
                 <PieChart className="w-16 h-16 mx-auto mb-4 text-purple-600" />
                 <CardTitle className="text-2xl">Módulo de Rentabilidade por Veículo (DRE Frota)</CardTitle>
                 <CardDescription className="text-base max-w-xl mx-auto">Custos aglutinados sobre (Manutenção + Abastecimento + Seguros + Pneus + Depreciação). Isso deduzirá automaticamente as margens da Torre no futuro.</CardDescription>
              </CardHeader>
              <CardContent>
                 <Table>
                   <TableHeader className="bg-slate-50"><TableRow><TableHead>Placa</TableHead><TableHead className="text-right">Combustível</TableHead><TableHead className="text-right">Manutenções</TableHead><TableHead className="text-right">Fixos (Seguro/IPVA)</TableHead><TableHead className="text-right bg-red-50 font-bold">CUSTO TOTAL (Mês)</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow><TableCell className="font-bold text-lg text-slate-700">ABC-1234</TableCell><TableCell className="text-right">{fmtFin(1450.00)}</TableCell><TableCell className="text-right">{fmtFin(850.00)}</TableCell><TableCell className="text-right">{fmtFin(200.00)}</TableCell><TableCell className="text-right bg-red-50 text-red-600 font-black">{fmtFin(2500.00)}</TableCell></TableRow>
                     <TableRow><TableCell className="font-bold text-lg text-slate-700">XYZ-9876</TableCell><TableCell className="text-right">{fmtFin(2100.00)}</TableCell><TableCell className="text-right">{fmtFin(0)}</TableCell><TableCell className="text-right">{fmtFin(200.00)}</TableCell><TableCell className="text-right bg-red-50 text-red-600 font-black">{fmtFin(2300.00)}</TableCell></TableRow>
                     <TableRow><TableCell className="font-bold text-lg text-slate-700">GHI-4433</TableCell><TableCell className="text-right">{fmtFin(900.00)}</TableCell><TableCell className="text-right">{fmtFin(400.00)}</TableCell><TableCell className="text-right">{fmtFin(150.00)}</TableCell><TableCell className="text-right bg-red-50 text-red-600 font-black">{fmtFin(1450.00)}</TableCell></TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL CADASTRO POSTO */}
      <Dialog open={showPostoModal} onOpenChange={setShowPostoModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Cadastrar Posto Conveniado</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2"><Label>Nome do Posto</Label><Input placeholder="Ex: Posto Ipiranga Rota 2" /></div>
            <div className="space-y-2"><Label>Razão Social</Label><Input placeholder="Razão social completa" /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input placeholder="00.000.000/0001-00" /></div>
            <div className="space-y-2"><Label>CEP</Label><Input placeholder="00000-000" /></div>
            <div className="space-y-2 col-span-2"><Label>Endereço</Label><Input placeholder="Endereço completo" /></div>
            <div className="space-y-2"><Label>Tipo de Convênio</Label>
              <Select><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent><SelectItem value="desconto">Desconto %</SelectItem><SelectItem value="tabelado">Preço Tabelado</SelectItem><SelectItem value="cartao">Cartão Frota</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Limite de Crédito (R$)</Label><Input type="number" placeholder="50000" /></div>
            <div className="space-y-2"><Label>Combustíveis</Label><Input placeholder="Diesel S10, Etanol, Gasolina" /></div>
            <div className="space-y-2 col-span-2"><Label>Contato do Responsável</Label><Input placeholder="Nome - Telefone" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowPostoModal(false)}>Cancelar</Button><Button className="bg-primary">Salvar Posto</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL ABASTECIMENTO */}
      <Dialog open={showAbastecimentoModal} onOpenChange={setShowAbastecimentoModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Registrar Abastecimento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="space-y-2"><Label>Posto Conveniado</Label>
              <Select><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{postos.filter(p => p.status === 'ativo').map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.nome}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Veículo</Label><Input placeholder="ABC-1234" /></div>
            <div className="space-y-2"><Label>Prestador</Label><Input placeholder="Nome do prestador" /></div>
            <div className="space-y-2"><Label>OS (opcional)</Label><Input placeholder="OS-000" /></div>
            <div className="space-y-2"><Label>Combustível</Label>
              <Select><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent><SelectItem value="diesel10">Diesel S10</SelectItem><SelectItem value="diesel500">Diesel S500</SelectItem><SelectItem value="etanol">Etanol</SelectItem><SelectItem value="gasolina">Gasolina</SelectItem><SelectItem value="gnv">GNV</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Litros</Label><Input type="number" placeholder="0" /></div>
            <div className="space-y-2"><Label>Preço/Litro</Label><Input type="number" placeholder="0.00" /></div>
            <div className="space-y-2"><Label>Hodômetro (km)</Label><Input type="number" placeholder="0" /></div>
            <div className="space-y-2"><Label>Data</Label><Input type="date" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAbastecimentoModal(false)}>Cancelar</Button><Button className="bg-primary">Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL MULTA */}
      <Dialog open={showMultaModal} onOpenChange={setShowMultaModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Registrar Multa</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2"><Label>Veículo</Label><Input placeholder="Placa" /></div>
            <div className="space-y-2"><Label>Prestador (se aplicável)</Label><Input placeholder="Nome do prestador" /></div>
            <div className="space-y-2"><Label>Data da Infração</Label><Input type="date" /></div>
            <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" placeholder="0.00" /></div>
            <div className="space-y-2 col-span-2"><Label>Descrição da Infração</Label><Input placeholder="Ex: Excesso de velocidade" /></div>
            <div className="space-y-2 col-span-2"><Label>Artigo/Lei</Label><Input placeholder="Ex: Art. 218 - Lei 9503" /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent><SelectItem value="pagar">A Pagar</SelectItem><SelectItem value="recorrer">Em Recurso</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Comprovante</Label><Input type="file" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowMultaModal(false)}>Cancelar</Button><Button className="bg-primary">Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
