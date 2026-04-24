import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DollarSign, Calendar, Users, Truck, FileCheck, FileX, RefreshCw, Download, Plus, Search, Filter, Eye, Edit, Check, X, Clock, CreditCard, Landmark, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface Prestador {
  id: string;
  nome_completo: string;
  cpf_cnpj: string;
  tipo_parceiro: string;
  status: string;
}

interface OS {
  id: string;
  numero: string;
  prestador?: string;
  custo_prestador?: number;
  pedagio?: number;
  adicionais?: number;
  valor_descontos?: number;
  status: string;
  data?: string;
  tipo_operacao?: string;
  veiculo_tipo?: string;
}

interface PagamentoItem {
  id: string;
  pagamento_id: string;
  os_id: string;
  os_numero: string;
  valor_servico: number;
  pedagio: number;
  adicional: number;
  valor_reembolso: number;
  valor_bonus: number;
  valor_desconto: number;
  status: string;
}

interface Pagamento {
  id: string;
  prestador_id: string;
  prestador_nome: string;
  prestador_documento: string;
  quantidade_os: number;
  valor_servicos: number;
  valor_reembolsos: number;
  valor_bonus: number;
  valor_descontos: number;
  valor_adiantamentos: number;
  valor_liquido: number;
  status: string;
  periodo_inicio: string;
  periodo_fim: string;
  data_programada_pagamento?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  confirmado: "bg-blue-100 text-blue-800",
  processando: "bg-purple-100 text-purple-800",
  pago: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800"
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  processando: "Processando",
  pago: "Pago",
  cancelado: "Cancelado"
};

export default function PagamentoPrestadores() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [aba, setAba] = useState(searchParams.get("aba") || "listagem");

  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [oss, setOss] = useState<OS[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filtroPeriodo, setFiltroPeriodo] = useState("semana");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [selectedPrestador, setSelectedPrestador] = useState<Prestador | null>(null);
  const [showDetalhe, setShowDetalhe] = useState(false);
  const [showFechamento, setShowFechamento] = useState(false);

  const [valoresAjustados, setValoresAjustados] = useState<Record<string, {
    reembolso: number;
    bonus: number;
    desconto: number;
  }>({});

  useEffect(() => {
    const now = new Date();
    const inicio = new Date(now);
    inicio.setDate(inicio.getDate() - 7);
    setDataInicio(inicio.toISOString().split("T")[0]);
    setDataFim(now.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    fetchPrestadores();
    fetchOss();
    fetchPagamentos();
  }, [dataInicio, dataFim]);

  const fetchPrestadores = async () => {
    try {
      const { data, error } = await supabase
        .from("prestadores")
        .select("id, nome_completo, cpf_cnpj, tipo_parceiro, status")
        .eq("status", "ativo")
        .order("nome_completo");

      if (error) throw error;
      setPrestadores(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar prestadores:", e);
    }
  };

  const fetchOss = async () => {
    if (!dataInicio || !dataFim) return;
    try {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, prestador, custo_prestador, pedagio, adicionais, descontos, status, data, tipo_operacao, veiculo_tipo")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .in("status", ["finalizada", "concluida"])
        .order("data", { ascending: false });

      if (error) throw error;
      setOss(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar OS:", e);
    }
  };

  const fetchPagamentos = async () => {
    try {
      const { data, error } = await supabase
        .from("pagamentos_prestadores")
        .select("*")
        .order("periodo_inicio", { ascending: false });

      if (error && e.code !== "42P01") throw error;
      setPagamentos(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar pagamentos:", e);
    }
  };

  const ossAgrupadas = useMemo(() => {
    const grupos: Record<string, OS[]> = {};
    oss.forEach(os => {
      const key = os.prestador || "sem_prestador";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(os);
    });
    return grupos;
  }, [oss]);

  consttotaisPorPrestador = useMemo(() => {
    consttotais: Record<string, {
      quantidade: number;
      servicos: number;
      pedagio: number;
      adicionais: number;
      descontos: number;
      liquido: number;
    }> = {};

    Object.entries(ossAgrupadas).forEach(([prestador, osList]) => {
      const ajustados = valoresAjustados[prestador] || { reembolso: 0, bonus: 0, desconto: 0 };
      const totals = {
        quantidade: osList.length,
        servicos: osList.reduce((sum, os) => sum + (os.custo_prestador || 0), 0),
        pedagio: osList.reduce((sum, os) => sum + (os.pedagio || 0), 0),
        adicionais: osList.reduce((sum, os) => sum + (os.adicionais || 0), 0),
        descontos: osList.reduce((sum, os) => sum + (os.descontos || 0), 0),
        liquido: 0
      };
      totals.liquido = totals.servicos + totals.pedagio + totals.adicionais + ajustados.reembolso + ajustados.bonus - totals.descontos - ajustados.desconto;
      totais[prestador] = totals;
    });

    return totais;
  }, [ossAgrupadas, valoresAjustados]);

  const handleAbrirDetalhe = (prestador: string) => {
    const p = prestadores.find(pr => pr.nome_completo === prestador);
    setSelectedPrestador(p || null);
    setShowDetalhe(true);
  };

  const handleGerarFechamento = async () => {
    if (!selectedPrestador || Object.keys(totaisPorPrestador[selectedPrestador.nome_completo] || {}).length === 0) {
      toast.error("Selecione um prestador com serviços no período");
      return;
    }

    const total = totaisPorPrestador[selectedPrestador.nome_completo];
    const osDoPrestador = ossAgrupadas[selectedPrestador.nome_completo] || [];
    const ajustes = valoresAjustados[selectedPrestador.nome_completo] || { reembolso: 0, bonus: 0, desconto: 0 };

    try {
      const { data: pagamento, error } = await supabase
        .from("pagamentos_prestadores")
        .insert([{
          prestador_id: selectedPrestador.id,
          prestador_nome: selectedPrestador.nome_completo,
          prestador_documento: selectedPrestador.cpf_cnpj,
          periodo_inicio: dataInicio,
          periodo_fim: dataFim,
          quantidade_os: total.quantidade,
          valor_servicos: total.servicos,
          valor_reembolsos: ajustes.reembolso,
          valor_bonus: ajustes.bonus,
          valor_descontos: total.descontos + ajustes.desconto,
          valor_adiantamentos: 0,
          valor_liquido: total.liquido,
          status: "pendente"
        }])
        .select()
        .single();

      if (error) throw error;

      const itens = osDoPrestador.map(os => ({
        pagamento_id: pagamento.id,
        os_id: os.id,
        os_numero: os.numero,
        valor_servico: os.custo_prestador || 0,
        pedagio: os.pedagio || 0,
        adicional: os.adicionais || 0,
        status: "pendente"
      }));

      if (itens.length > 0) {
        const { error: erroItens } = await supabase
          .from("pagamentos_prestadores_itens")
          .insert(itens);

        if (erroItens) throw erroItens;
      }

      toast.success(`Fechamento gerado para ${selectedPrestador.nome_completo}`);
      setShowFechamento(false);
      setShowDetalhe(false);
      fetchPagamentos();
    } catch (e: any) {
      console.error("Erro ao gerar fechamento:", e);
      toast.error(`Erro: ${e.message}`);
    }
  };

  const handleAtualizarAjuste = (prestador: string, tipo: "reembolso" | "bonus" | "desconto", valor: number) => {
    setValoresAjustados(prev => ({
      ...prev,
      [prestador]: {
        ...(prev[prestador] || { reembolso: 0, bonus: 0, desconto: 0 }),
        [tipo]: valor
      }
    }));
  };

  const handleConfirmarPagamento = async (pagamentoId: string) => {
    try {
      const { error } = await supabase
        .from("pagamentos_prestadores")
        .update({ status: "pago", data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("id", pagamentoId);

      if (error) throw error;
      toast.success("Pagamento confirmado!");
      fetchPagamentos();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const totalGeral = useMemo(() => {
    return Object.values(totaisPorPrestador).reduce((acc, t) => acc + t.liquido, 0);
  }, [totaisPorPrestador]);

  const totalOS = useMemo(() => {
    return oss.length;
  }, [oss]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" />
            Pagamento de Prestadores
          </h2>
          <p className="text-muted-foreground">Fechamento e pagamento de prestadores por período</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Última semana</SelectItem>
                  <SelectItem value="quinzena">Última quincena</SelectItem>
                  <SelectItem value="mes">Último mês</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={() => { fetchOss(); fetchPagamentos(); }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Total OS do período</p>
              <p className="text-2xl font-bold">{totalOS}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Prestadores comOS</p>
              <p className="text-2xl font-bold">{Object.keys(ossAgrupadas).length}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <p className="text-xs text-orange-600">Total a pagar</p>
              <p className="text-2xl font-bold text-orange-600">
                {totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-xs text-green-600">Pagamentos confirmados</p>
              <p className="text-2xl font-bold text-green-600">{pagamentos.filter(p => p.status === "pago").length}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestador</TableHead>
                <TableHead>Qtd OS</TableHead>
                <TableHead>Valor Serviços</TableHead>
                <TableHead>Pedágio/Adicional</TableHead>
                <TableHead>Ajustes</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(totaisPorPrestador).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma OS encontrada no período selecionado
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(totaisPorPrestador).map(([prestador, total]) => (
                  <TableRow key={prestador}>
                    <TableCell className="font-medium">{prestador}</TableCell>
                    <TableCell>{total.quantidade}</TableCell>
                    <TableCell>{total.servicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>{(total.pedagio + total.adicionais).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>
                      <span className="text-green-600">+{((valoresAjustados[prestador]?.reembolso || 0) + (valoresAjustados[prestador]?.bonus || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      <span className="text-red-600"> -{((valoresAjustados[prestador]?.desconto || 0) + total.descontos).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </TableCell>
                    <TableCell className="font-bold text-orange-600">{total.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleAbrirDetalhe(prestador)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagamentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fechamentos Anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Prestador</TableHead>
                  <TableHead>Qtd OS</TableHead>
                  <TableHead>Valor Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.periodo_inicio} a {p.periodo_fim}</TableCell>
                    <TableCell>{p.prestador_nome}</TableCell>
                    <TableCell>{p.quantidade_os}</TableCell>
                    <TableCell className="font-medium">{p.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "pendente" && (
                        <Button size="sm" onClick={() => handleConfirmarPagamento(p.id)}>
                          <Check className="w-4 h-4 mr-1" /> Confirmar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDetalhe} onOpenChange={setShowDetalhe}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Fechamento</DialogTitle>
          </DialogHeader>
          {selectedPrestador && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Prestador</Label>
                  <p className="font-medium">{selectedPrestador.nome_completo}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
                  <p className="font-medium">{selectedPrestador.cpf_cnpj}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ajustes Manuais</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Reembolso</Label>
                    <Input
                      type="number"
                      value={valoresAjustados[selectedPrestador.nome_completo]?.reembolso || 0}
                      onChange={e => handleAtualizarAjuste(selectedPrestador.nome_completo, "reembolso", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bônus</Label>
                    <Input
                      type="number"
                      value={valoresAjustados[selectedPrestador.nome_completo]?.bonus || 0}
                      onChange={e => handleAtualizarAjuste(selectedPrestador.nome_completo, "bonus", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Desconto</Label>
                    <Input
                      type="number"
                      value={valoresAjustados[selectedPrestador.nome_completo]?.desconto || 0}
                      onChange={e => handleAtualizarAjuste(selectedPrestador.nome_completo, "desconto", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Pedágio</TableHead>
                      <TableHead>Adicional</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ossAgrupadas[selectedPrestador.nome_completo] || []).slice(0, 10).map(os => (
                      <TableRow key={os.id}>
                        <TableCell className="font-mono">{os.numero}</TableCell>
                        <TableCell>{(os.custo_prestador || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                        <TableCell>{(os.pedagio || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                        <TableCell>{(os.adicionais || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetalhe(false)}>Fechar</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => { setShowFechamento(true); }}>
              <Check className="w-4 h-4 mr-2" /> Gerar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFechamento} onOpenChange={setShowFechamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Fechamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Confirma o fechamento para <strong>{selectedPrestador?.nome_completo}</strong>?</p>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p>Quantidade de OS: <strong>{totaisPorPrestador[selectedPrestador?.nome_completo || ""]?.quantidade || 0}</strong></p>
              <p>Valor líquido: <strong className="text-orange-600 text-lg">
                {(totaisPorPrestador[selectedPrestador?.nome_completo || ""]?.liquido || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFechamento(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleGerarFechamento}>
              <Check className="w-4 h-4 mr-2" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}