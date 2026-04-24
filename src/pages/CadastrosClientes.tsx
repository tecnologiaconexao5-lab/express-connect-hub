import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Users } from "lucide-react";
import ClientesLista from "@/components/clientes/ClientesLista";
import ClienteDetalhe from "@/components/clientes/ClienteDetalhe";

const CadastrosClientes = () => {
  const [searchParams] = useSearchParams();
  const isNovo = searchParams.get("novo") === "true";
  const [view, setView] = useState<"lista" | "detalhe" | "novo">("lista");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    if (isNovo) {
      setView("novo");
    }
  }, [isNovo]);

  if (view === "detalhe" || view === "novo") {
    return (
      <div className="animate-fade-in">
        <ClienteDetalhe
          clienteId={view === "detalhe" ? selectedId : undefined}
          onBack={() => { setView("lista"); setSelectedId(undefined); }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cadastros › Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestão da base de clientes e contratantes.</p>
        </div>
      </div>
      <ClientesLista
        onSelect={(id) => { setSelectedId(id); setView("detalhe"); }}
        onNew={() => setView("novo")}
      />
    </div>
  );
};

export default CadastrosClientes;
