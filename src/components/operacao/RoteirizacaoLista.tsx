import { Route, Map as MapIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const RoteirizacaoLista = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Route className="w-16 h-16 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 mb-2">Roteirização</h3>
        <p className="text-sm text-slate-400 max-w-md">
          Utilize o <strong>Roteirizador Web</strong> na aba correspondente dentro da tela de Operação para criar e gerenciar rotas de entrega.
        </p>
      </div>
    </div>
  );
};

export default RoteirizacaoLista;
