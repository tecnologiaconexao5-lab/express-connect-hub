import { useState, useEffect } from "react";
import { Search, Plus, Filter, Edit, Trash2, AlertCircle, Eye, Phone, Calendar, Package, Copy, X, MessageSquare, Mail, FileText, Calculator, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// ──────────────────────────────────────────────────────────────────────────────
// Tipo interno (aceita tanto snake_case do Supabase quanto camelCase do form)
// ──────────────────────────────────────────────────────────────────────────────
interface ClienteRow {
  id: string;
  razao_social?: string;
  razaoSocial?: string;
  nome_fantasia?: string;
  nomeFantasia?: string;
  cnpj?: string;
  ie?: string;
  segmento?: string;
  porte?: string;
  status?: string;
  contato_principal?: string;
  contatoPrincipal?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  logo?: string;
  num_os_mes?: number;
  numOsMes?: number;
  data_cadastro?: string;
  ultima_operacao?: string;
  responsavel_operacional?: string;
  responsavel_financeiro?: string;
  responsavel_comercial?: string;
  observacoes?: string;
  origem_comercial?: string;
  exige_agendamento?: boolean;
  exige_sla?: boolean;
  exige_portal?: boolean;
  aceita_api?: boolean;
  [key: string]: unknown;
}

// Mapeador local: snake_case Supabase → valores normalizados para a UI
const mapRow = (row: ClienteRow) => ({
  id: row.id,
  razaoSocial:            row.razao_social       || row.razaoSocial       || "",
  nomeFantasia:           row.nome_fantasia      || row.nomeFantasia      || "",
  cnpj:                   row.cnpj               || "",
  ie:                     row.ie,
  segmento:               row.segmento,
  porte:                  row.porte,
  // Normaliza status: "ativo" → "Ativo", "Ativo" → "Ativo"
  status: (() => {
    const s = (row.status || "ativo").toLowerCase();
    return s === "ativo" ? "Ativo" : s === "inativo" ? "Inativo" : row.status || "Ativo";
  })(),
  contatoPrincipal:       row.contato_principal  || row.contatoPrincipal  || "",
  telefone:               row.telefone           || "",
  whatsapp:               row.whatsapp           || "",
  email:                  row.email              || "",
  cidade:                 row.cidade,
  uf:                     row.uf,
  logo:                   row.logo,
  numOsMes:               row.num_os_mes         ?? row.numOsMes          ?? 0,
  dataCadastro:           row.data_cadastro      || null,
  ultimaOperacao:        row.ultima_operacao    || null,
  responsavelOperacional: row.responsavel_operacional || row.responsavel_operacional || "",
  responsavelFinanceiro:  row.responsavel_financeiro  || "",
  responsavelComercial:   row.responsavel_comercial   || "",
  observacoes:            row.observacoes,
  origemComercial:        row.origem_comercial   || "",
  exigeAgendamento:       row.exige_agendamento  ?? false,
  exigeSla:               row.exige_sla          ?? false,
  exigePortal:            row.exige_portal       ?? false,
  aceitaApi:              row.aceita_api         ?? false,
});

type ClienteMapped = ReturnType<typeof mapRow>;

interface Props {
  onSelect: (id: string) => void;
  onNew: () => void;
}

const ClientesLista = ({ onSelect, onNew }: Props) => {
  const [busca, setBusca]                         = useState("");
  const [clientes, setClientes]                   = useState<ClienteMapped[]>([]);
  const [isLoading, setIsLoading]                 = useState(false);
  const [adminPassword, setAdminPassword]         = useState("");
  const [showDeleteDialog, setShowDeleteDialog]   = useState(false);
  const [selectedCliente, setSelectedCliente]     = useState<ClienteMapped | null>(null);
  const [showQuickView, setShowQuickView]         = useState(false);
  const [quickViewCliente, setQuickViewCliente]   = useState<ClienteMapped | null>(null);

  useEffect(() => {
    fetchClientes();
  }, []);

  // ── FETCH ──────────────────────────────────────────────────────────────────
  const fetchClientes = async () => {
    try {
      setIsLoading(true);
      console.log("[ClientesLista] Buscando clientes...");
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("razao_social");

      if (error) {
        console.error("[ClientesLista] Erro fetch:", error.message, error.code);
        throw error;
      }

      const qtdeRecebida = data?.length ?? 0;
      console.log("[ClientesLista] Registros recebidos:", qtdeRecebida);

      if (qtdeRecebida === 0 && clientes.length > 0) {
        console.log("[ClientesLista] Lista ficou vazia após fetch - mantendo anterior");
      }

      // Mapear snake_case → camelCase normalizado
      const mapped = (data || []).map(row => mapRow(row as ClienteRow));
      setClientes(mapped);
      console.log("[ClientesLista] Lista atualizada:", mapped.length);
    } catch (err) {
      console.error("[ClientesLista] Catch fetch:", err);
      toast.error("Erro ao carregar clientes. Lista mantida.");
      // NÃO sobrescreve clientes em caso de erro - mantém a lista anterior
    } finally {
      setIsLoading(false);
    }
  };

  // ── BUSCA (multi-campo) ────────────────────────────────────────────────────
  const filtered = clientes.filter((c) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      String(c.razaoSocial  || "").toLowerCase().includes(q) ||
      String(c.nomeFantasia || "").toLowerCase().includes(q) ||
      String(c.cnpj         || "").toLowerCase().includes(q) ||
      String(c.email        || "").toLowerCase().includes(q) ||
      String(c.telefone     || "").toLowerCase().includes(q)
    );
  });

  // ── ABRIR DIALOG DE EXCLUSÃO ───────────────────────────────────────────────
  const openDeleteDialog = (cliente: ClienteMapped) => {
    setSelectedCliente(cliente);
    setAdminPassword("");
    setShowDeleteDialog(true);
  };

  // ── CONFIRMAR EXCLUSÃO (segura) ────────────────────────────────────────────
  const confirmDelete = async () => {
    const qtdeAntes = clientes.length;
    console.log("[DELETE CLIENTE] Quantidade antes:", qtdeAntes);

    // PROTEÇÃO 1: id obrigatório
    if (!selectedCliente?.id) {
      toast.error("ID do cliente não encontrado. Exclusão cancelada.");
      setShowDeleteDialog(false);
      return;
    }

    // PROTEÇÃO 2: senha admin
    if (adminPassword !== "admin123") {
      toast.error("Senha de administrador incorreta!");
      return;
    }

    const clienteId = selectedCliente.id;
    const razao = selectedCliente.razaoSocial || selectedCliente.nomeFantasia || 'SEM_NOME';
    console.log("[DELETE CLIENTE] Tentando excluir id:", clienteId, "| razão:", razao);

    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteId);

      if (error) {
        console.error("[DELETE CLIENTE] Erro Supabase:", error.message, error.code);
        throw error;
      }

      console.log("[DELETE CLIENTE] Excluído com sucesso no banco:", clienteId);
      toast.success(`Cliente "${razao}" excluído.`);

      // Limpa busca após exclusão para evitar.confusão visual
      console.log("[DELETE CLIENTE] Limpando busca...");
      setBusca("");

      // NÃO altera state manualmente - deixa fetchClientes() atualizar
      console.log("[DELETE CLIENTE] Recarregando lista...");
      await fetchClientes();

      console.log("[DELETE CLIENTE] Quantidade após fetch:", clientes.length);
    } catch (err: any) {
      console.error("[DELETE CLIENTE] Catch:", err?.message || err);
      toast.error("Erro ao excluir cliente. Lista inalterada.");
      // NÃO modifica state em caso de erro
    } finally {
      setShowDeleteDialog(false);
      setAdminPassword("");
      setSelectedCliente(null);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            {busca.trim()
              ? `${filtered.length} resultado(s) para "${busca}"`
              : `${clientes.length} cliente(s) cadastrado(s)`}
          </p>
        </div>
        <Button onClick={onNew} className="gap-2 bg-primary">
          <Plus className="w-4 h-4" /> Cadastrar Cliente
        </Button>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por razão social, CNPJ, e-mail ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="w-4 h-4" /> Filtros
        </Button>
      </div>

{/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="min-w-[200px]">Razão Social / Nome Fantasia</TableHead>
                <TableHead>CNPJ/CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Localidade</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Data Cadastro</TableHead>
                <TableHead>Última OS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  // Razão social com fallback
                  const razao = c.razaoSocial || c.nomeFantasia || "Sem razão social";
                  // Localidade
                  const localidade = c.cidade && c.uf ? `${c.cidade}/${c.uf}` : c.cidade || "—";
                  // Status badge color
                  const isAtivo = c.status?.toLowerCase() === "ativo";
                  
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelect(c.id)}
                    >
                      <TableCell>
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                            {(c.razaoSocial || c.nomeFantasia || "?").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{razao}</div>
                        {c.nomeFantasia && c.nomeFantasia !== razao && (
                          <div className="text-xs text-muted-foreground">{c.nomeFantasia}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {c.cnpj || "—"}
                          {c.cnpj && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(c.cnpj);
                                toast.success("CNPJ copiado!");
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {c.telefone || "—"}
                          {c.telefone && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(c.telefone);
                                toast.success("Telefone copiado!");
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {c.email || "—"}
                          {c.email && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(c.email);
                                toast.success("E-mail copiado!");
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{c.responsavelOperacional || c.responsavelComercial || "—"}</TableCell>
                      <TableCell>{localidade}</TableCell>
                      <TableCell>{c.segmento || "—"}</TableCell>
                       <TableCell>
                        {c.dataCadastro && !isNaN(new Date(c.dataCadastro).getTime())
                          ? new Date(c.dataCadastro).toLocaleDateString("pt-BR") 
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="w-3 h-3 text-muted-foreground" />
                          {c.ultimaOperacao || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={isAtivo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                          {c.status || "Ativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickViewCliente(c);
                              setShowQuickView(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(c.id);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteDialog(c);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Visualização Rápida */}
      <Dialog open={showQuickView} onOpenChange={setShowQuickView}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" /> Detalhes do Cliente
            </DialogTitle>
          </DialogHeader>
          {quickViewCliente && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {quickViewCliente.logo ? (
                  <img src={quickViewCliente.logo} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="text-xl">{(quickViewCliente.razaoSocial || quickViewCliente.nomeFantasia || "C").charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{quickViewCliente.razaoSocial || quickViewCliente.nomeFantasia}</h3>
                  {quickViewCliente.nomeFantasia && quickViewCliente.nomeFantasia !== (quickViewCliente.razaoSocial || "") && (
                    <p className="text-sm text-muted-foreground">{quickViewCliente.nomeFantasia}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={quickViewCliente.status === "Ativo" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}>
                      {quickViewCliente.status || "Ativo"}
                    </Badge>
                    {quickViewCliente.segmento && <Badge variant="outline">{quickViewCliente.segmento}</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowQuickView(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Razão Social</p>
                  <p className="font-medium">{quickViewCliente.razaoSocial || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Nome Fantasia</p>
                  <p className="font-medium">{quickViewCliente.nomeFantasia || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">CNPJ/CPF</p>
                  <div className="flex items-center gap-1">
                    <p className="font-mono">{quickViewCliente.cnpj || "—"}</p>
                    {quickViewCliente.cnpj && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(quickViewCliente.cnpj);
                          toast.success("CNPJ copiado!");
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Telefone</p>
                  <div className="flex items-center gap-1">
                    <p className="font-medium">{quickViewCliente.telefone || "—"}</p>
                    {quickViewCliente.telefone && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(quickViewCliente.telefone);
                          toast.success("Telefone copiado!");
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">E-mail</p>
                  <div className="flex items-center gap-1">
                    <p className="font-medium">{quickViewCliente.email || "—"}</p>
                    {quickViewCliente.email && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(quickViewCliente.email);
                          toast.success("E-mail copiado!");
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Endereço Completo com CEP</p>
                  <div className="flex items-center gap-1">
                    <p className="font-medium">
                      {quickViewCliente.cidade && quickViewCliente.uf 
                        ? `${quickViewCliente.cidade}/${quickViewCliente.uf}` 
                        : quickViewCliente.cidade || "—"}
                    </p>
                    {(quickViewCliente.cidade || quickViewCliente.uf) && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => {
                          const endereco = `${quickViewCliente.cidade || ""}${quickViewCliente.uf ? `/${quickViewCliente.uf}` : ""}`;
                          navigator.clipboard.writeText(endereco);
                          toast.success("Endereço copiado!");
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Responsável Operacional</p>
                  <p className="font-medium">{quickViewCliente.responsavelOperacional || quickViewCliente.responsavelComercial || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Segmento</p>
                  <p className="font-medium">{quickViewCliente.segmento || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Data Cadastro</p>
                  <p className="font-medium">
                    {quickViewCliente.dataCadastro 
                      ? new Date(quickViewCliente.dataCadastro).toLocaleDateString("pt-BR") 
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Última OS</p>
                  <p className="font-medium">{quickViewCliente.ultimaOperacao || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Quantidade OS</p>
                  <p className="font-bold text-lg">{quickViewCliente.numOsMes ?? 0}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Observações</p>
                  <p className="font-medium text-sm">{quickViewCliente.observacoes || "—"}</p>
                </div>
              </div>

              <Separator />

              {/* Botão Copiar Resumo */}
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => {
                  const resumo = `
Cliente: ${quickViewCliente.razaoSocial || quickViewCliente.nomeFantasia || "—"}
CNPJ: ${quickViewCliente.cnpj || "—"}
Telefone: ${quickViewCliente.telefone || "—"}
E-mail: ${quickViewCliente.email || "—"}
Endereço: ${quickViewCliente.cidade || ""}${quickViewCliente.uf ? `/${quickViewCliente.uf}` : ""}
Segmento: ${quickViewCliente.segmento || "—"}
Status: ${quickViewCliente.status || "Ativo"}
                  `.trim();
                  navigator.clipboard.writeText(resumo);
                  toast.success("Resumo copiado!");
                }}
              >
                <Copy className="w-4 h-4" />
                Copiar Resumo do Cliente
              </Button>

              {/* Ações Rápidas */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => {
                    const msg = `Olá! Entrando em contato em nome do cliente ${quickViewCliente.razaoSocial || quickViewCliente.nomeFantasia}. Como podemos ajudar?`;
                    window.open(`https://wa.me/${quickViewCliente.telefone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => {
                    window.open(`mailto:${quickViewCliente.email}`, '_blank');
                  }}
                >
                  <Mail className="w-4 h-4" />
                  E-mail
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => {
                    toast.info("Funcionalidade: Criar OS para este cliente");
                  }}
                >
                  <FileText className="w-4 h-4" />
                  Criar OS
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => {
                    toast.info("Funcionalidade: Criar Orçamento");
                  }}
                >
                  <Calculator className="w-4 h-4" />
                  Orçamento
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2 col-span-2"
                  onClick={() => {
                    toast.info("Funcionalidade: Ver Financeiro");
                  }}
                >
                  <DollarSign className="w-4 h-4" />
                  Ver Financeiro
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" /> Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedCliente?.razaoSocial || selectedCliente?.nomeFantasia}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <Label htmlFor="adminPassword">Senha de Administrador</Label>
            <Input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
              placeholder="Digite a senha admin"
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAdminPassword(""); setSelectedCliente(null); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Excluir Cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientesLista;
