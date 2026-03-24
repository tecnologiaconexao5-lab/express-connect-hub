import { useState } from "react";
import { Database } from "lucide-react";
import PrestadoresLista from "@/components/prestadores/PrestadoresLista";
import PrestadorDetalhe from "@/components/prestadores/PrestadorDetalhe";
import { Prestador } from "@/components/prestadores/types";

const CadastrosPrestadores = () => {
  const [view, setView] = useState<"lista" | "detalhe" | "novo">("lista");
  const [selected, setSelected] = useState<Prestador | undefined>();

  if (view === "detalhe" || view === "novo") {
    return (
      <div className="animate-fade-in">
        <PrestadorDetalhe
          prestador={view === "detalhe" ? selected : undefined}
          onBack={() => { setView("lista"); setSelected(undefined); }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cadastros › Prestadores</h1>
          <p className="text-sm text-muted-foreground">Gestão de parceiros logísticos com documentação, veículos e áreas de atuação.</p>
        </div>
      </div>
      <PrestadoresLista
        onSelect={(p) => { setSelected(p); setView("detalhe"); }}
        onNew={() => setView("novo")}
      />
    </div>
  );
};

export default CadastrosPrestadores;
