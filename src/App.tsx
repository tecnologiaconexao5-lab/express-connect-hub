import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createRoutesFromElements, Route, Navigate, RouterProvider } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import AppLayout from "@/components/AppLayout";
import { Suspense, lazy, useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { eventProcessorWorker } from "@/services/eventBus/eventProcessorWorker";

// Eager: paginas criticas que todo usuario ve
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";

// Lazy: demais paginas carregadas sob demanda
const TorreControle = lazy(() => import("@/pages/TorreControle"));
const Comercial = lazy(() => import("@/pages/Comercial"));
const Operacao = lazy(() => import("@/pages/Operacao"));
const OsMobile = lazy(() => import("@/pages/OsMobile"));
const Cadastros = lazy(() => import("@/pages/Cadastros"));
const CadastrosPrestadores = lazy(() => import("@/pages/CadastrosPrestadores"));
const CadastrosClientes = lazy(() => import("@/pages/CadastrosClientes"));
const CadastrosFornecedores = lazy(() => import("@/pages/CadastrosFornecedores"));
const CadastrosVeiculos = lazy(() => import("@/pages/CadastrosVeiculos"));
const CadastrosAuxiliares = lazy(() => import("@/pages/CadastrosAuxiliares"));
const AnaliseDocumentos = lazy(() => import("@/pages/AnaliseDocumentos"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));
const Fiscal = lazy(() => import("@/pages/Fiscal"));
const Frota = lazy(() => import("@/pages/Frota"));
const Contratos = lazy(() => import("@/pages/Contratos"));
const SLA = lazy(() => import("@/pages/SLA"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const PortalCliente = lazy(() => import("@/pages/PortalCliente"));
const AppPrestador = lazy(() => import("@/pages/AppPrestador"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const Recrutamento = lazy(() => import("@/pages/Recrutamento"));
const Biblioteca = lazy(() => import("@/pages/Biblioteca"));
const Governanca = lazy(() => import("@/pages/Governanca"));
const IAAutomacoes = lazy(() => import("@/pages/IAAutomacoes"));
const IaAutomacao = lazy(() => import("@/pages/IaAutomacao"));
const CentralIA = lazy(() => import("@/pages/CentralIA"));
const RoboRecrutamentoMonitor = lazy(() => import("@/pages/RoboRecrutamentoMonitor"));
const MonitorIntegracoes = lazy(() => import("@/pages/MonitorIntegracoes"));
const CadastroPrestador = lazy(() => import("@/pages/CadastroPrestador"));
const PortalPrestador = lazy(() => import("@/pages/PortalPrestador"));
const WhatsAppCRM = lazy(() => import("@/pages/WhatsAppCRM"));
const BancoTalentos = lazy(() => import("@/pages/BancoTalentos"));
const Comunicacao = lazy(() => import("@/pages/Comunicacao"));
const Tracking = lazy(() => import("@/pages/Tracking"));
const Combustiveis = lazy(() => import("@/pages/Combustiveis"));
const Seguros = lazy(() => import("@/pages/Seguros"));
const Roteirizador = lazy(() => import("@/components/Roteirizador"));
const IntegracoesTMS = lazy(() => import("@/pages/IntegracoesTMS"));
const MensagensWhatsApp = lazy(() => import("@/pages/MensagensWhatsApp"));
const TesteInteligencia = lazy(() => import("@/pages/TesteInteligencia"));
const ZohoCallback = lazy(() => import("@/pages/ZohoCallback"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AdminTenantsPage = lazy(() => import("@/pages/admin/AdminTenantsPage"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const ConectoresDashboard = lazy(() => import("@/pages/admin/ConectoresDashboard"));
const CentralComunicacao = lazy(() => import("@/pages/CentralComunicacao"));
const RastreamentoPublico = lazy(() => import("@/pages/RastreamentoPublico"));
const PedidoRapido = lazy(() => import("@/pages/PedidoRapido"));
const ControlePatio = lazy(() => import("@/pages/ControlePatio"));
const Comprovantes = lazy(() => import("@/pages/Comprovantes"));
// MISSÃO COTACAO-EXPRESS — fluxo publico de cotacao em 2 fases
const CotacaoExpress = lazy(() => import("@/pages/CotacaoExpress"));
const CotacaoExpressDetalhes = lazy(() => import("@/pages/CotacaoExpressDetalhes"));

import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";

const PageLoader = () => (
  <ProgressiveBlocksLoader size="page" />
);

const Lazy = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<PageLoader />}>{children}</Suspense>;

// Data router (React Router 6) — habilita useBlocker em useFormExitGuard.
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
            <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<Lazy><ForgotPassword /></Lazy>} />
          <Route path="/reset-password" element={<Lazy><ResetPassword /></Lazy>} />
            <Route path="/cadastro-prestador" element={<CadastroPrestador />} />
          <Route path="/rastrear/:codigo" element={<Tracking />} />
          <Route path="/t/:codigo" element={<Tracking />} />
          <Route path="/rastrear" element={<Tracking />} />
          <Route path="/rastreamento/:token" element={<Lazy><RastreamentoPublico /></Lazy>} />
          {/* MISSÃO CRIACAO-PORTAL-PEDIDO-RAPIDO-WHATSAPP — rota pública (link WhatsApp) */}
          <Route path="/pedido-rapido" element={<Lazy><PedidoRapido /></Lazy>} />
          <Route path="/c" element={<Lazy><PedidoRapido /></Lazy>} />
          {/* MISSÃO COTACAO-EXPRESS — rota publica (link do site/WhatsApp) */}
          <Route path="/cotacao-express" element={<Lazy><CotacaoExpress /></Lazy>} />
          <Route path="/cotacao-express/detalhes/:id" element={<Lazy><CotacaoExpressDetalhes /></Lazy>} />
          <Route path="/portal-cliente" element={<Lazy><PortalCliente /></Lazy>} />
          <Route path="/portal-prestador" element={<PortalPrestador />} />
          <Route path="/zoho/callback" element={<ZohoCallback />} />
          <Route path="/convite" element={<Lazy><AcceptInvite /></Lazy>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/torre-controle" element={<Lazy><TorreControle /></Lazy>} />
            <Route path="/roteirizador" element={<Lazy><Roteirizador /></Lazy>} />
            <Route path="/comercial" element={<Lazy><Comercial /></Lazy>} />
            <Route path="/operacao" element={<Lazy><Operacao /></Lazy>} />
            <Route path="/cadastros" element={<Lazy><Cadastros /></Lazy>} />
            <Route path="/cadastros/prestadores" element={<Lazy><CadastrosPrestadores /></Lazy>} />
            <Route path="/cadastros/prestadores/novo" element={<Lazy><CadastrosPrestadores /></Lazy>} />
            <Route path="/cadastros/fornecedores" element={<Lazy><CadastrosFornecedores /></Lazy>} />
            <Route path="/cadastros/fornecedores/novo" element={<Lazy><CadastrosFornecedores /></Lazy>} />
            <Route path="/cadastros/clientes" element={<Lazy><CadastrosClientes /></Lazy>} />
            <Route path="/cadastros/clientes/novo" element={<Lazy><CadastrosClientes /></Lazy>} />
            <Route path="/cadastros/veiculos" element={<Lazy><CadastrosVeiculos /></Lazy>} />
            <Route path="/cadastros/auxiliares" element={<Lazy><CadastrosAuxiliares /></Lazy>} />
            <Route path="/cadastros/analise-documentos" element={<Lazy><AnaliseDocumentos /></Lazy>} />
            <Route path="/financeiro" element={<Lazy><Financeiro /></Lazy>} />
            <Route path="/fiscal" element={<Lazy><Fiscal /></Lazy>} />
            <Route path="/frota" element={<Lazy><Frota /></Lazy>} />
            <Route path="/combustiveis" element={<Lazy><Combustiveis /></Lazy>} />
            <Route path="/recrutamento" element={<Lazy><Recrutamento /></Lazy>} />
          <Route path="/recrutamento/whatsapp-crm" element={<Lazy><WhatsAppCRM /></Lazy>} />
          <Route path="/recrutamento/banco-talentos" element={<Lazy><BancoTalentos /></Lazy>} />
            <Route path="/contratos" element={<Lazy><Contratos /></Lazy>} />
            <Route path="/sla" element={<Lazy><SLA /></Lazy>} />
            <Route path="/relatorios" element={<Lazy><Relatorios /></Lazy>} />
            <Route path="/biblioteca" element={<Lazy><Biblioteca /></Lazy>} />
            <Route path="/governanca" element={<Lazy><Governanca /></Lazy>} />
            <Route path="/ia-automacoes" element={<Lazy><IAAutomacoes /></Lazy>} />
            <Route path="/ia-central-automacao" element={<Lazy><IaAutomacao /></Lazy>} />
            <Route path="/central-ia" element={<Lazy><CentralIA /></Lazy>} />
            <Route path="/admin/tenants" element={<Lazy><AdminTenantsPage /></Lazy>} />
            <Route path="/admin/conectores" element={<Lazy><ConectoresDashboard /></Lazy>} />
            <Route path="/robo-recrutamento-monitor" element={<Lazy><RoboRecrutamentoMonitor /></Lazy>} />
            <Route path="/monitor-api" element={<Lazy><MonitorIntegracoes /></Lazy>} />
            <Route path="/app-prestador" element={<Lazy><AppPrestador /></Lazy>} />
            <Route path="/configuracoes" element={<Lazy><Configuracoes /></Lazy>} />
            <Route path="/comunicacao" element={<Lazy><Comunicacao /></Lazy>} />
            <Route path="/seguros" element={<Lazy><Seguros /></Lazy>} />
            <Route path="/inteligencia" element={<TesteInteligencia />} />
            <Route path="/integracoes" element={<IntegracoesTMS />} />
            <Route path="/mensagens-whatsapp" element={<MensagensWhatsApp />} />
            <Route path="/central-comunicacao" element={<Lazy><CentralComunicacao /></Lazy>} />
            <Route path="/controle-patio" element={<Lazy><ControlePatio /></Lazy>} />
            <Route path="/os-mobile" element={<Lazy><OsMobile /></Lazy>} />
            <Route path="/comprovantes" element={<Lazy><Comprovantes /></Lazy>} />
          </Route>
          <Route path="*" element={<NotFound />} />

    </>,
  ),
);

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    eventProcessorWorker.iniciar(10000);
    return () => eventProcessorWorker.parar();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TenantProvider>
    <ErrorBoundary>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<PageLoader />}>
            <RouterProvider router={router} />
          </Suspense>
        </ThemeProvider>
      </TooltipProvider>
    </ErrorBoundary>
    </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
