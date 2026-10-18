// @deprecated - NUNCA importado. Root '/' redireciona para '/login' em App.tsx:110.
// Mantido apenas para compatibilidade. Remover na próxima limpeza.
import { Navigate } from "react-router-dom";

const Index = () => <Navigate to="/dashboard" replace />;

export default Index;
