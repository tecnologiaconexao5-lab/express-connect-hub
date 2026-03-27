import { useState } from "react";
import { Truck } from "lucide-react";
import VeiculosLista from "@/components/veiculos/VeiculosLista";
import VeiculoDetalhe from "@/components/veiculos/VeiculoDetalhe";

const CadastrosVeiculos = () => {
  const [view, setView] = useState<"lista" | "detalhe" | "novo">("lista");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  if (view === "detalhe" || view === "novo") {
    return (
      <div className="animate-fade-in">
        <VeiculoDetalhe
          veiculoId={view === "detalhe" ? selectedId : undefined}
          onBack={() => { setView("lista"); setSelectedId(undefined); }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Truck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cadastros › Veículos</h1>
          <p className="text-sm text-muted-foreground">Gestão da frota própria e frota agregada parceira.</p>
        </div>
      </div>
      <VeiculosLista
        onSelect={(id) => { setSelectedId(id); setView("detalhe"); }}
        onNew={() => setView("novo")}
      />
    </div>
  );
};

export default CadastrosVeiculos;
