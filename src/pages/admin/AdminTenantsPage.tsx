import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2, Users, Plus, Search, Edit3, Trash2, CheckCircle2,
  XCircle, AlertCircle, Loader2, Shield, ExternalLink, MailPlus, Copy, CopyCheck
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  listarTenants, criarTenant, atualizarTenant, deletarTenant,
  listarUsuariosTenant, listarTodosUsuarios,
  buscarUsuarioPorEmail,
  vincularUsuario, atualizarVinculo, removerVinculo,
  criarConvite, listarConvites, removerConvite,
  type TenantRow, type TenantUsuarioRow
} from "@/services/adminTenantsService";

const PLANOS = ["starter", "professional", "enterprise"] as const;
const STATUS_TENANT = ["ativo", "inativo", "suspenso", "trial"] as const;
const PAPEIS = ["super_admin", "admin_tenant", "gestor", "operacional", "financeiro", "comercial", "cliente", "prestador", "motorista"] as const;
const STATUS_VINCULO = ["ativo", "inativo", "convidado"] as const;

export default function AdminTenantsPage() {
  const { user: authUser } = useAuth();
  const pode = authUser?.role === "admin" || authUser?.role === "super_admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "empresas";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<TenantRow | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome: "", slug: "", plano: "starter", status: "ativo" as string, documento: "", email_contato: "", telefone_contato: "", logo_url: "", cor_primaria: "#F97316", dominio_customizado: "" });

  const [dialogUsuario, setDialogUsuario] = useState(false);
  const [tenantSelecionado, setTenantSelecionado] = useState("");
  const [formUsuario, setFormUsuario] = useState({ tenant_id: "", user_id: "", user_email: "", papel: "operacional", status: "ativo" as string });
  const [editandoVinculo, setEditandoVinculo] = useState<TenantUsuarioRow | null>(null);
  const [resolvendoEmail, setResolvendoEmail] = useState(false);

  // Convite
  const [convites, setConvites] = useState<any[]>([]);
  const [dialogConvite, setDialogConvite] = useState(false);
  const [formConvite, setFormConvite] = useState({ email: "", papel: "operacional" });
  const [copiado, setCopiado] = useState<string | null>(null);
  const VITE_APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const [t, v] = await Promise.all([listarTenants(), listarTodosUsuarios()]);
      setTenants(t);
      setVinculos(v);
      // Carregar convites do primeiro tenant ativo
      const tenantAtivo = t.find(tn => tn.status === "ativo") || t[0];
      if (tenantAtivo) {
        listarConvites(tenantAtivo.id).then(setConvites).catch(() => {});
      }
    } catch (e: any) {
      toast.error("Erro ao carregar dados: " + e.message);
    }
    setLoading(false);
  }

  const tenantsFiltrados = tenants.filter(t =>
    t.nome.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    (t.documento || "").includes(search)
  );

  function abrirCriar() {
    setEditando(null);
    setForm({ nome: "", slug: "", plano: "starter", status: "ativo", documento: "", email_contato: "", telefone_contato: "", logo_url: "", cor_primaria: "#F97316", dominio_customizado: "" });
    setDialogAberto(true);
  }

  function abrirEditar(t: TenantRow) {
    setEditando(t);
    setForm({
      nome: t.nome, slug: t.slug, plano: t.plano,
      status: t.status, documento: t.documento || "",
      email_contato: t.email_contato || "",
      telefone_contato: t.telefone_contato || "",
      logo_url: t.logo_url || "", cor_primaria: t.cor_primaria || "#F97316",
      dominio_customizado: t.dominio_customizado || ""
    });
    setDialogAberto(true);
  }

  async function salvarTenant() {
    if (!form.nome.trim() || !form.slug.trim()) {
      toast.error("Nome e slug sao obrigatorios");
      return;
    }
    if (form.slug.includes(" ")) {
      toast.error("Slug nao pode conter espacos");
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await atualizarTenant(editando.id, form);
        toast.success("Empresa atualizada");
      } else {
        await criarTenant(form);
        toast.success("Empresa criada");
      }
      setDialogAberto(false);
      await carregarDados();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setSalvando(false);
  }

  async function confirmarDelecao(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await deletarTenant(id);
      toast.success("Empresa excluida");
      await carregarDados();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  async function toggleAtivar(t: TenantRow) {
    const novoStatus = t.status === "ativo" ? "inativo" : "ativo";
    try {
      await atualizarTenant(t.id, { status: novoStatus });
      toast.success(novoStatus === "ativo" ? "Empresa ativada" : "Empresa desativada");
      await carregarDados();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  async function resolverEmailParaUserId() {
    if (!formUsuario.user_email.trim()) return;
    setResolvendoEmail(true);
    try {
      const resultado = await buscarUsuarioPorEmail(formUsuario.user_email.trim());
      if (resultado) {
        setFormUsuario(prev => ({ ...prev, user_id: resultado.id }));
        toast.success("Usuario encontrado: " + resultado.id.substring(0, 12) + "...");
      } else {
        toast.error("Usuario nao encontrado. O usuario precisa fazer login primeiro.");
      }
    } catch (e: any) {
      toast.error("RPC buscar_usuario_por_email nao disponivel. Execute a migration M20.");
    }
    setResolvendoEmail(false);
  }

  function abrirVincular(tenantId: string) {
    setTenantSelecionado(tenantId);
    setEditandoVinculo(null);
    setFormUsuario({ tenant_id: tenantId, user_id: "", user_email: "", papel: "operacional", status: "ativo" });
    setDialogUsuario(true);
  }

  function abrirEditarVinculo(v: any) {
    setTenantSelecionado(v.tenant_id);
    setEditandoVinculo(v);
    setFormUsuario({ tenant_id: v.tenant_id, user_id: v.user_id, user_email: v.email || "", papel: v.papel, status: v.status });
    setDialogUsuario(true);
  }

  async function salvarVinculo() {
    if (!formUsuario.user_id.trim()) {
      toast.error("Informe o user_id ou resolva por email primeiro");
      return;
    }
    setSalvando(true);
    try {
      if (editandoVinculo) {
        await atualizarVinculo(editandoVinculo.id, { papel: formUsuario.papel, status: formUsuario.status });
        toast.success("Vinculo atualizado");
      } else {
        await vincularUsuario({
          tenant_id: formUsuario.tenant_id || tenantSelecionado,
          user_id: formUsuario.user_id.trim(),
          papel: formUsuario.papel,
          status: formUsuario.status
        });
        toast.success("Usuario vinculado");
      }
      setDialogUsuario(false);
      await carregarDados();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setSalvando(false);
  }

  async function confirmarRemoverVinculo(id: string) {
    if (!confirm("Remover este vinculo?")) return;
    try {
      await removerVinculo(id);
      toast.success("Vinculo removido");
      await carregarDados();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  if (!pode) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" /> Acesso Restrito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Voce nao tem permissao para gerenciar empresas.
              Apenas usuarios com perfil <strong>admin</strong> ou papel
              <strong> super_admin</strong>/<strong>admin_tenant</strong> podem acessar esta pagina.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" /> Administracao de Empresas
          </h1>
          <p className="text-muted-foreground">
            Gerencie tenants (empresas), vinculos de usuarios e permissoes.
          </p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-4 justify-start overflow-x-auto flex-wrap">
          <TabsTrigger value="empresas" className="gap-2"><Building2 className="w-4 h-4" /> Empresas</TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2"><Users className="w-4 h-4" /> Usuarios por Empresa</TabsTrigger>
          <TabsTrigger value="convites" className="gap-2"><MailPlus className="w-4 h-4" /> Convites</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Todas as Empresas</CardTitle>
                <CardDescription>{tenants.length} empresa(s) cadastrada(s)</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nome, slug, doc..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button onClick={abrirCriar}><Plus className="w-4 h-4 mr-2" /> Nova Empresa</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[160px]">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantsFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhuma empresa encontrada
                        </TableCell>
                      </TableRow>
                    )}
                    {tenantsFiltrados.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: t.cor_primaria || "#F97316" }}>
                              {t.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{t.nome}</div>
                              {t.email_contato && <div className="text-xs text-muted-foreground">{t.email_contato}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.slug}</code></TableCell>
                        <TableCell className="text-xs">{t.documento || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{t.plano}</Badge></TableCell>
                        <TableCell>
                          <Badge className={t.status === "ativo" ? "bg-green-100 text-green-800" : t.status === "trial" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}>
                            {t.status === "ativo" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => abrirEditar(t)} title="Editar">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleAtivar(t)} title={t.status === "ativo" ? "Desativar" : "Ativar"}>
                              {t.status === "ativo" ? <XCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => confirmarDelecao(t.id, t.nome)} title="Excluir">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="pt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vinculos de Usuarios por Empresa</CardTitle>
              <CardDescription>Gerencie quem tem acesso a cada empresa e qual o papel.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[140px]">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vinculos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum vinculo encontrado
                        </TableCell>
                      </TableRow>
                    )}
                    {vinculos.map((v: any) => {
                      const tenantNome = tenants.find(t => t.id === v.tenant_id)?.nome || v.tenant_id;
                      const cor = v.papel === "super_admin" ? "bg-purple-100 text-purple-800" :
                        v.papel === "admin_tenant" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-800";
                      return (
                        <TableRow key={v.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <span>{tenantNome}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{v.email || "-"}</TableCell>
                          <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{v.user_id.substring(0, 12)}...</code></TableCell>
                          <TableCell><Badge className={cor}>{v.papel}</Badge></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={v.status === "ativo" ? "text-green-700" : "text-amber-700"}>
                              {v.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => abrirEditarVinculo(v)} title="Editar">
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => confirmarRemoverVinculo(v.id)} title="Remover">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vincular Usuario a Empresa</CardTitle>
              <CardDescription>Adicione um usuario a uma empresa definindo seu papel.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-end">
                <div className="space-y-1 flex-1">
                  <Label>Empresa</Label>
                  <Select value={tenantSelecionado} onValueChange={setTenantSelecionado}>
                    <SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                    <SelectContent>
                      {tenants.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => abrirVincular(tenantSelecionado)} disabled={!tenantSelecionado}>
                  <Plus className="w-4 h-4 mr-2" /> Vincular
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="convites" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Convites Pendentes</CardTitle>
                <CardDescription>Convide usuarios para acessar o sistema. O link expira em 7 dias.</CardDescription>
              </div>
              <Button onClick={() => { setFormConvite({ email: "", papel: "operacional" }); setDialogConvite(true); }}>
                <MailPlus className="w-4 h-4 mr-2" /> Convidar Usuario
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Expiracao</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[200px]">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convites.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum convite pendente
                        </TableCell>
                      </TableRow>
                    )}
                    {convites.map((c: any) => {
                      const expirado = new Date(c.expira_em) < new Date();
                      return (
                        <TableRow key={c.id}>
                          <TableCell>{c.email}</TableCell>
                          <TableCell><Badge variant="outline">{c.papel}</Badge></TableCell>
                          <TableCell className="text-xs">
                            {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                            {expirado && <Badge className="ml-2 bg-red-100 text-red-800">Expirado</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge className={c.usado ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                              {c.usado ? "Usado" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm"
                                onClick={() => {
                                  const link = `${VITE_APP_URL}/convite?token=${c.token}`;
                                  navigator.clipboard.writeText(link);
                                  setCopiado(c.id);
                                  setTimeout(() => setCopiado(null), 2000);
                                  toast.success("Link copiado!");
                                }}
                                title="Copiar link de convite">
                                {copiado === c.id ? <CopyCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </Button>
                              {!c.usado && (
                                <Button variant="ghost" size="sm" onClick={() => {
                                  removerConvite(c.id).then(() => {
                                    setConvites(prev => prev.filter(x => x.id !== c.id));
                                    toast.success("Convite removido");
                                  }).catch(() => toast.error("Erro ao remover convite"));
                                }} title="Remover convite">
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Tenant */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            <DialogDescription>
              {editando ? "Altere os dados da empresa" : "Preencha os dados para criar uma nova empresa (tenant)"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Razao social" />
              </div>
              <div className="space-y-1">
                <Label>Slug *</Label>
                <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.replace(/\s/g, "-").toLowerCase() })} placeholder="minha-empresa" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Documento</Label>
                <Input value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} placeholder="CNPJ" />
              </div>
              <div className="space-y-1">
                <Label>Plano</Label>
                <Select value={form.plano} onValueChange={v => setForm({ ...form, plano: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as string })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_TENANT.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cor Primaria</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.cor_primaria} onChange={e => setForm({ ...form, cor_primaria: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" />
                  <Input value={form.cor_primaria} onChange={e => setForm({ ...form, cor_primaria: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email Contato</Label>
              <Input value={form.email_contato} onChange={e => setForm({ ...form, email_contato: e.target.value })} type="email" />
            </div>
            <div className="space-y-1">
              <Label>Telefone Contato</Label>
              <Input value={form.telefone_contato} onChange={e => setForm({ ...form, telefone_contato: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Dominio Customizado</Label>
              <Input value={form.dominio_customizado} onChange={e => setForm({ ...form, dominio_customizado: e.target.value })} placeholder="tms.minhaempresa.com.br" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button onClick={salvarTenant} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editando ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Vinculo */}
      <Dialog open={dialogUsuario} onOpenChange={setDialogUsuario}>
          <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editandoVinculo ? "Editar Vinculo" : "Vincular Usuario"}</DialogTitle>
            <DialogDescription>
              {editandoVinculo ? "Altere papel ou status do vinculo" : "Defina o papel do usuario na empresa"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editandoVinculo && (
              <div className="space-y-1 p-3 border rounded-lg bg-muted/20">
                <Label className="text-xs text-muted-foreground">Resolver por email (se migration M20 aplicada)</Label>
                <div className="flex gap-2">
                  <Input value={formUsuario.user_email} onChange={e => setFormUsuario({ ...formUsuario, user_email: e.target.value })} placeholder="email@exemplo.com" />
                  <Button variant="outline" size="sm" onClick={resolverEmailParaUserId} disabled={resolvendoEmail || !formUsuario.user_email.trim()}>
                    {resolvendoEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Resolver"}
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>User ID *</Label>
              <Input value={formUsuario.user_id} onChange={e => setFormUsuario({ ...formUsuario, user_id: e.target.value })} placeholder="auth.uid()" disabled={!!editandoVinculo} />
              <p className="text-[10px] text-muted-foreground">UUID do usuario em auth.users. Use o campo "Resolver por email" acima se disponivel.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Papel</Label>
                <Select value={formUsuario.papel} onValueChange={v => setFormUsuario({ ...formUsuario, papel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAPEIS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={formUsuario.status} onValueChange={v => setFormUsuario({ ...formUsuario, status: v as string })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_VINCULO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogUsuario(false)}>Cancelar</Button>
            <Button onClick={salvarVinculo} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editandoVinculo ? "Salvar" : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Convite */}
      <Dialog open={dialogConvite} onOpenChange={setDialogConvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Usuario</DialogTitle>
            <DialogDescription>
              O usuario recebera um link para criar conta e ser vinculado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label>Email do Usuario *</Label>
              <Input
                value={formConvite.email}
                onChange={e => setFormConvite({ ...formConvite, email: e.target.value })}
                placeholder="email@exemplo.com"
                type="email"
              />
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={formConvite.papel} onValueChange={v => setFormConvite({ ...formConvite, papel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAPEIS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogConvite(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!formConvite.email.trim()) { toast.error("Informe o email"); return; }
              try {
                const tenantId = tenants.find(t => t.status === "ativo")?.id || tenants[0]?.id;
                if (!tenantId) { toast.error("Nenhuma empresa ativa"); return; }
                setSalvando(true);
                const convite = await criarConvite(tenantId, formConvite.email.trim(), formConvite.papel);
                const link = `${VITE_APP_URL}/convite?token=${convite.token}`;
                setConvites(prev => [...prev, { ...convite, email: formConvite.email.trim(), papel: formConvite.papel, usado: false, expira_em: new Date(Date.now() + 7*86400000).toISOString(), criado_em: new Date().toISOString() }]);
                setDialogConvite(false);
                navigator.clipboard.writeText(link);
                toast.success("Convite criado! Link copiado para area de transferencia.");
              } catch (e: any) {
                toast.error("Erro: " + (e.message || "desconhecido"));
              }
              setSalvando(false);
            }} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
