import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import TorreControle from "@/pages/TorreControle";
import Comercial from "@/pages/Comercial";
import Operacao from "@/pages/Operacao";
import Cadastros from "@/pages/Cadastros";
import CadastrosPrestadores from "@/pages/CadastrosPrestadores";
import CadastrosClientes from "@/pages/CadastrosClientes";
import CadastrosVeiculos from "@/pages/CadastrosVeiculos";
import CadastrosAuxiliares from "@/pages/CadastrosAuxiliares";
import AnaliseDocumentos from "@/pages/AnaliseDocumentos";
import Financeiro from "@/pages/Financeiro";
import Fiscal from "@/pages/Fiscal";
import Frota from "@/pages/Frota";
import Contratos from "@/pages/Contratos";
import SLA from "@/pages/SLA";
import Relatorios from "@/pages/Relatorios";
import PortalCliente from "@/pages/PortalCliente";
import AppPrestador from "@/pages/AppPrestador";
import Configuracoes from "@/pages/Configuracoes";
import NotFound from "@/pages/NotFound";
import Recrutamento from "@/pages/Recrutamento";
import Biblioteca from "@/pages/Biblioteca";
import Governanca from "@/pages/Governanca";
import IAAutomacoes from "@/pages/IAAutomacoes";
import MonitorIntegracoes from "@/pages/MonitorIntegracoes";
import CadastroPrestador from "@/pages/CadastroPrestador";
import Comunicacao from "@/pages/Comunicacao";
import Tracking from "@/pages/Tracking";
import Combustiveis from "@/pages/Combustiveis";
import Seguros from "@/pages/Seguros";
import Roteirizador from "@/components/Roteirizador";
import DevTesteTMS from "@/pages/DevTesteTMS";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro-prestador" element={<CadastroPrestador />} />
          <Route path="/rastrear/:codigo" element={<Tracking />} />
          <Route path="/t/:codigo" element={<Tracking />} />
          <Route path="/rastrear" element={<Tracking />} />
          <Route path="/portal-cliente" element={<PortalCliente />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/torre-controle" element={<TorreControle />} />
            <Route path="/roteirizador" element={<Roteirizador />} />
            <Route path="/comercial" element={<Comercial />} />
            <Route path="/operacao" element={<Operacao />} />
            <Route path="/cadastros" element={<Cadastros />} />
            <Route path="/cadastros/prestadores" element={<CadastrosPrestadores />} />
            <Route path="/cadastros/prestadores/novo" element={<CadastrosPrestadores />} />
            <Route path="/cadastros/clientes" element={<CadastrosClientes />} />
            <Route path="/cadastros/clientes/novo" element={<CadastrosClientes />} />
            <Route path="/cadastros/veiculos" element={<CadastrosVeiculos />} />
            <Route path="/cadastros/auxiliares" element={<CadastrosAuxiliares />} />
            <Route path="/cadastros/analise-documentos" element={<AnaliseDocumentos />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/fiscal" element={<Fiscal />} />
            <Route path="/frota" element={<Frota />} />
            <Route path="/combustiveis" element={<Combustiveis />} />
            <Route path="/recrutamento" element={<Recrutamento />} />
            <Route path="/contratos" element={<Contratos />} />
            <Route path="/sla" element={<SLA />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/biblioteca" element={<Biblioteca />} />
            <Route path="/governanca" element={<Governanca />} />
            <Route path="/ia-automacoes" element={<IAAutomacoes />} />
            <Route path="/monitor-api" element={<MonitorIntegracoes />} />
            <Route path="/app-prestador" element={<AppPrestador />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/comunicacao" element={<Comunicacao />} />
            <Route path="/seguros" element={<Seguros />} />
            <Route path="/dev-teste" element={<DevTesteTMS />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
