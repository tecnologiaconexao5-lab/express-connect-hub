import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Settings, Building2, Users, Table as TableIcon, Link as LinkIcon, Bell, Save, AppWindow, CheckCircle2, Copy, Shield, User, ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Permissao = "ver" | "criar" | "editar" | "excluir" | "aprovar";

interface ModuloPermissao {
  modulo: string;
  ver: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
  aprobar: boolean;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
  unidade: string;
  status: string;
  permissoes: ModuloPermissao[];
}

const modulos: { nome: string; temAprovar: boolean }[] = [
  { nome: "Dashboard Executivo", temAprovar: false },
  { nome: "Dashboard Financeiro", temAprovar: false },
  { nome: "Gestão Comercial", temAprovar: true },
  { nome: "Orçamentos", temAprovar: true },
  { nome: "Tabela de Valores", temAprovar: false },
  { nome: "Ordens de Serviço", temAprovar: true },
  { nome: "Financeiro", temAprovar: true },
  { nome: "Prestadores", temAprovar: true },
  { nome: "Clientes", temAprovar: true },
  { nome: "Relatórios", temAprovar: false },
  { nome: "Configurações", temAprovar: false },
];

const perfisPredefinidos: Record<string, ModuloPermissao[]> = {
  admin: modulos.map(m => ({ modulo: m.nome, ver: true, criar: true, editar: true, excluir: true, aprobar: m.temAprovar })),
  operador: [
    { modulo: "Dashboard Executivo", ver: true, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Dashboard Financeiro", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Gestão Comercial", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Orçamentos", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Tabela de Valores", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Ordens de Serviço", ver: true, criar: true, editar: true, excluir: false, aprobar: true },
    { modulo: "Financeiro", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Prestadores", ver: true, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Clientes", ver: true, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Relatórios", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Configurações", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
  ],
  financeiro: [
    { modulo: "Dashboard Executivo", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Dashboard Financeiro", ver: true, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Gestão Comercial", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Orçamentos", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Tabela de Valores", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Ordens de Serviço", ver: true, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Financeiro", ver: true, criar: true, editar: true, excluir: false, aprobar: true },
    { modulo: "Prestadores", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Clientes", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Relatórios", ver: true, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Configurações", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
  ],
  comercial: [
    { modulo: "Dashboard Executivo", ver: true, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Dashboard Financeiro", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Gestão Comercial", ver: true, criar: true, editar: true, excluir: true, aprobar: true },
    { modulo: "Orçamentos", ver: true, criar: true, editar: true, excluir: true, aprobar: true },
    { modulo: "Tabela de Valores", ver: true, criar: true, editar: true, excluir: true, aprobar: false },
    { modulo: "Ordens de Serviço", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Financeiro", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Prestadores", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Clientes", ver: true, criar: true, editar: true, excluir: true, aprobar: true },
    { modulo: "Relatórios", ver: true, criar: false, editar: false, excluir: false, aprobar: false },
    { modulo: "Configurações", ver: false, criar: false, editar: false, excluir: false, aprobar: false },
  ],
  visualizador: modulos.map(m => ({ modulo: m.nome, ver: true, criar: false, editar: false, excluir: false, aprobar: false })),
};

const usuariosIniciais: Usuario[] = [
  {
    id: "1",
    nome: "Diego Balbino",
    email: "diego@exemplo.com",
    papel: "Admin",
    unidade: "Matriz (SP)",
    status: "Ativo",
    permissoes: modulos.map(m => ({ modulo: m.nome, ver: true, criar: true, editar: true, excluir: true, aprobar: m.temAprovar })),
  },
  {
    id: "2",
    nome: "João Silva",
    email: "joao.op@exemplo.com",
    papel: "Operador",
    unidade: "Matriz (SP)",
    status: "Ativo",
    permissoes: perfisPredefinidos.operador,
  },
  {
    id: "3",
    nome: "Maria Santos",
    email: "maria.fin@exemplo.com",
    papel: "Financeiro",
    unidade: "Filial RJ",
    status: "Ativo",
    permissoes: perfisPredefinidos.financeiro,
  },
  {
    id: "4",
    nome: "Carlos Oliveira",
    email: "carlos.com@exemplo.com",
    papel: "Comercial",
    unidade: "Matriz (SP)",
    status: "Ativo",
    permissoes: perfisPredefinidos.comercial,
  },
];

export default function Configuracoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "empresa";

  const handleTabChange = (val: string) => setSearchParams({ tab: val });
  const [saving, setSaving] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosIniciais);
  const [usuarioEditando, setUsuarioEditando] = useState<string | null>(null);

  const [empresa, setEmpresa] = useState({
    razaoSocial: "Conexão Express Transportes LTDA",
    cnpj: "12.345.678/0001-90", ender: "Av Paulista, 1000 - SP", logo: "", numOS: 1045, numOrc: 420
  });

  const onSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); toast.success("Configurações salvas."); }, 1000);
  };

  const togglePermissao = (usuarioId: string, modulo: string, permissao: Permissao) => {
    setUsuarios(prev => prev.map(u => {
      if (u.id !== usuarioId) return u;
      return {
        ...u,
        permissoes: u.permissoes.map(p => {
          if (p.modulo !== modulo) return p;
          return { ...p, [permissao]: !p[permissao as keyof typeof p] };
        }),
      };
    }));
  };

  const aplicarPerfil = (usuarioId: string, perfil: string) => {
    const novoPerfil = perfisPredefinidos[perfil];
    if (!novoPerfil) return;
    
    setUsuarios(prev => prev.map(u => {
      if (u.id !== usuarioId) return u;
      return { ...u, permissoes: [...novoPerfil] };
    }));
    toast.success(`Perfil ${perfil} aplicado com sucesso.`);
  };

  interface IntegracaoCardProps {
    title: string;
    status: string;
    infos: string;
    children: React.ReactNode;
  }

  const IntegracaoCard = ({ title, status, infos, children }: IntegracaoCardProps) => (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 right-0 py-1 px-3 rounded-bl-xl text-[10px] font-bold uppercase text-white ${status === 'connected' ? 'bg-green-500' : 'bg-slate-500'}`}>
        {status === 'connected' ? 'Conectado' : 'Desconectado'}
      </div>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{infos}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );

  const usuarioAtual = usuarios.find(u => u.id === usuarioEditando);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" /> Painel de Configurações
          </h1>
          <p className="text-muted-foreground">Parâmetros gerais, integrações, usuários e notificações.</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white" disabled={saving} onClick={onSave}><Save className="w-4 h-4 mr-2"/> Salvar Alterações</Button>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="empresa" className="px-5"><Building2 className="w-4 h-4 mr-2"/> Dados Empresa</TabsTrigger>
           <TabsTrigger value="usuarios" className="px-5"><Users className="w-4 h-4 mr-2"/> Usuários e Perfis</TabsTrigger>
           <TabsTrigger value="tabela" className="px-5"><TableIcon className="w-4 h-4 mr-2"/> Tab. de Valores</TabsTrigger>
           <TabsTrigger value="integracoes" className="px-5"><LinkIcon className="w-4 h-4 mr-2"/> Integrações</TabsTrigger>
           <TabsTrigger value="notificacoes" className="px-5"><Bell className="w-4 h-4 mr-2"/> Notificações</TabsTrigger>
        </TabsList>

        {/* --- EMPRESA --- */}
        <TabsContent value="empresa" className="pt-4">
           <Card>
             <CardHeader><CardTitle className="text-lg">Dados Básicos Operacionais</CardTitle></CardHeader>
             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Razão Social</Label><Input value={empresa.razaoSocial} onChange={(e)=>setEmpresa({...empresa, razaoSocial:e.target.value})} /></div>
                <div className="space-y-1"><Label>CNPJ</Label><Input value={empresa.cnpj} onChange={(e)=>setEmpresa({...empresa, cnpj:e.target.value})} /></div>
                <div className="space-y-1 md:col-span-2"><Label>Endereço Matriz</Label><Input value={empresa.ender} onChange={(e)=>setEmpresa({...empresa, ender:e.target.value})} /></div>
                
                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-sm font-semibold mb-4 text-primary">Numeração Automática dos Documentos</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label>Próximo Número OS</Label><Input type="number" value={empresa.numOS} onChange={(e)=>setEmpresa({...empresa, numOS:Number(e.target.value)})} /></div>
                    <div className="space-y-1"><Label>Próximo Número Orçamento</Label><Input type="number" value={empresa.numOrc} onChange={(e)=>setEmpresa({...empresa, numOrc:Number(e.target.value)})} /></div>
                  </div>
                </div>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- USUARIOS E PERFIS --- */}
        <TabsContent value="usuarios" className="pt-4 space-y-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Equipe Conectada</CardTitle>
                  <CardDescription>Gerencie quem tem acesso ao ERP e aos escopos.</CardDescription>
                </div>
                <Button variant="outline" onClick={() => toast("Convite disparado por e-mail via Supabase Auth.")}>Convidar Usuário</Button>
             </CardHeader>
             <CardContent>
               <Table>
                 <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Papel Funcional</TableHead><TableHead>Unidade</TableHead><TableHead>Status</TableHead><TableHead className="w-[100px]">Ações</TableHead></TableRow></TableHeader>
                 <TableBody>
                   {usuarios.map((u) => (
                     <TableRow key={u.id}>
                       <TableCell>
                         <div className="font-medium">{u.nome}</div>
                         <div className="text-xs text-muted-foreground">{u.email}</div>
                       </TableCell>
                       <TableCell><Badge>{u.papel}</Badge></TableCell>
                       <TableCell>{u.unidade}</TableCell>
                       <TableCell><span className="text-xs text-green-600 font-bold">{u.status}</span></TableCell>
                       <TableCell>
                         <Button variant="ghost" size="sm" onClick={() => setUsuarioEditando(usuarioEditando === u.id ? null : u.id)}>
                           <Shield className="w-4 h-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </CardContent>
           </Card>
           
           {/* Controle de Acesso por Módulo */}
           <Card>
             <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Controle de Acesso por Módulo
                  </CardTitle>
                  <CardDescription>Gerencie permissões específicas para cada usuário.</CardDescription>
                </div>
                {usuarioEditando && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Aplicar perfil padrão <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => aplicarPerfil(usuarioEditando, "admin")}>
                        Admin - Acesso total
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => aplicarPerfil(usuarioEditando, "operador")}>
                        Operador - Operação + OS + Escala
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => aplicarPerfil(usuarioEditando, "financeiro")}>
                        Financeiro - Financeiro + Relatórios
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => aplicarPerfil(usuarioEditando, "comercial")}>
                        Comercial - Comercial + Clientes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => aplicarPerfil(usuarioEditando, "visualizador")}>
                        Visualizador - Somente leitura
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
             </CardHeader>
             <CardContent className="overflow-x-auto">
                {usuarioEditando ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
                      <User className="w-5 h-5" />
                      <span className="font-medium">{usuarioAtual?.nome}</span>
                      <Badge variant="outline">{usuarioAtual?.papel}</Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Módulo</TableHead>
                          <TableHead className="text-center w-[80px]">Ver</TableHead>
                          <TableHead className="text-center w-[80px]">Criar</TableHead>
                          <TableHead className="text-center w-[80px]">Editar</TableHead>
                          <TableHead className="text-center w-[80px]">Excluir</TableHead>
                          <TableHead className="text-center w-[80px]">Aprovar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usuarioAtual?.permissoes.map((p) => {
                          const moduloInfo = modulos.find(m => m.nome === p.modulo);
                          return (
                            <TableRow key={p.modulo}>
                              <TableCell className="font-medium">{p.modulo}</TableCell>
                              <TableCell className="text-center">
                                <Checkbox 
                                  checked={p.ver} 
                                  onCheckedChange={() => togglePermissao(usuarioEditando, p.modulo, "ver")} 
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox 
                                  checked={p.criar} 
                                  onCheckedChange={() => togglePermissao(usuarioEditando, p.modulo, "criar")} 
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox 
                                  checked={p.editar} 
                                  onCheckedChange={() => togglePermissao(usuarioEditando, p.modulo, "editar")} 
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox 
                                  checked={p.excluir} 
                                  onCheckedChange={() => togglePermissao(usuarioEditando, p.modulo, "excluir")} 
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                {moduloInfo?.temAprovar ? (
                                  <Checkbox 
                                    checked={p.aprobar} 
                                    onCheckedChange={() => togglePermissao(usuarioEditando, p.modulo, "aprobar")} 
                                  />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Selecione um usuário na tabela acima para editar suas permissões.</p>
                  </div>
                )}
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- TABELA DE VALORES --- */}
        <TabsContent value="tabela" className="pt-4">
           <Card>
             <CardHeader>
                <CardTitle className="text-lg">Tabelas Ativas para Cálculo Automático</CardTitle>
                <CardDescription>Para criar e editar as tabelas e regras de frete e pedágio, utilize o módulo Comercial {">"} Tabela de Valores.</CardDescription>
             </CardHeader>
             <CardContent>
                <div className="text-center py-10 border-dashed border-2 rounded-xl text-muted-foreground bg-muted/10">
                   Você pode mapear regras condicionalmente dentro do módulo Comercial. Suas tabelas cadastradas ativam diretamente os cálculos de viagem e repasse.
                </div>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- INTEGRACOES --- */}
        <TabsContent value="integracoes" className="pt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <IntegracaoCard title="Supabase & Realtime" infos="Banco de dados, auth e storage PWA" status="connected">
                 <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                    <CheckCircle2 className="w-4 h-4"/> Sincronizado dinamicamente via WebSockets.
                 </div>
              </IntegracaoCard>
              <IntegracaoCard title="DreamFlow App Motorista" infos="Sincronia das viagens do App PWA com a Torre" status="disconnected">
                 <div className="space-y-2">
                    <div className="space-y-1"><Label className="text-xs">Chave de API (Secret)</Label><Input type="password" placeholder="df_live_xxxxxxxxxx" /></div>
                    <div className="space-y-1"><Label className="text-xs">Webhook URL</Label><Input placeholder="https://api.supabase.co/..." /></div>
                 </div>
              </IntegracaoCard>
              <IntegracaoCard title="WhatsApp Business" infos="Disparos massivos de status pros clientes API Meta" status="disconnected">
                 <div className="space-y-2">
                    <div className="space-y-1"><Label className="text-xs">Token de Acesso Mínimo</Label><Input type="password" placeholder="EAAB..." /></div>
                 </div>
              </IntegracaoCard>
              <IntegracaoCard title="SEFAZ e Prefeituras Integradas" infos="Emissão autônoma a partir do botão 'Gerar da OS'" status="disconnected">
                 <div className="space-y-2 text-center py-4 bg-muted/20 border-dashed border rounded">
                    <Badge variant="secondary" className="mb-2">Em Breve</Badge>
                    <p className="text-xs text-muted-foreground">Módulo de assinatura A1 / A3 digital a ser homologado na API Sefaz/Cidades correspondente.</p>
                 </div>
              </IntegracaoCard>
              
              <Card className="md:col-span-2 border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AppWindow className="w-5 h-5 text-primary"/> Portal do Cliente White-Label</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Input readOnly value="https://express-hub.web.app/portal-cliente" className="bg-white" />
                    <Button variant="outline" className="shrink-0"><Copy className="w-4 h-4 mr-2"/> Copiar Link</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Os clientes farão login neste endereço exclusivamente com os e-mails liberados lá no /cadastros/clientes.</p>
                </CardContent>
              </Card>
           </div>
        </TabsContent>

        {/* --- NOTIFICAÇÕES --- */}
        <TabsContent value="notificacoes" className="pt-4">
           <Card>
             <CardHeader>
               <CardTitle>Regras do Sino e Notificações</CardTitle>
               <CardDescription>Quais eventos alertarão a Torre via banco Realtime e quais disparam externamente?</CardDescription>
             </CardHeader>
             <CardContent>
                <Table>
                   <TableHeader><TableRow><TableHead>Evento Crítico</TableHead><TableHead className="text-center">Sino (Sistema)</TableHead><TableHead className="text-center">E-Mail (Cliente)</TableHead><TableHead className="text-center">WPP (Motorista)</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell className="font-medium text-sm">Nova OS Caiu no Sistema (Demanda Criada)</TableCell>
                       <TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={false} /></TableCell><TableCell className="text-center"><Switch checked={true} /></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-medium text-sm">Motorista Rejeitou a Oferta da Viagem</TableCell>
                       <TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={false} disabled /></TableCell><TableCell className="text-center"><Switch checked={false} disabled /></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-medium text-sm">Operação Finalizada (Entrega com POD Realizada)</TableCell>
                       <TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={false} /></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-medium text-sm">Ocorrência Grave Submetida (Avaria, Atraso)</TableCell>
                       <TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={false} disabled /></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-medium text-sm">Alerta Docs: Vencimento Hab./CRLV/ANTT próx 7d</TableCell>
                       <TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={false} /></TableCell><TableCell className="text-center"><Switch checked={true} /></TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-medium text-sm">Orçamento foi Aprovado Web pelo Cliente</TableCell>
                       <TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={true} /></TableCell><TableCell className="text-center"><Switch checked={false} disabled /></TableCell>
                     </TableRow>
                   </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
