import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import TorreControle from "@/pages/TorreControle";
import Comercial from "@/pages/Comercial";
import Operacao from "@/pages/Operacao";
import Cadastros from "@/pages/Cadastros";
import CadastrosPrestadores from "@/pages/CadastrosPrestadores";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/torre-controle" element={<TorreControle />} />
            <Route path="/comercial" element={<Comercial />} />
            <Route path="/operacao" element={<Operacao />} />
            <Route path="/cadastros" element={<Cadastros />} />
            <Route path="/cadastros/prestadores" element={<CadastrosPrestadores />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/fiscal" element={<Fiscal />} />
            <Route path="/frota" element={<Frota />} />
            <Route path="/contratos" element={<Contratos />} />
            <Route path="/sla" element={<SLA />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/portal-cliente" element={<PortalCliente />} />
            <Route path="/app-prestador" element={<AppPrestador />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
