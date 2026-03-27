import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Database, MapPin, Building2, Store, CreditCard, List } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenericCrud, FieldConfig } from "@/components/auxiliares/GenericCrud";

const TABELAS_AUXILIARES = [
  { id: "tipos_operacao", title: "Tipos de Operação" },
  { id: "tipos_carga", title: "Tipos de Carga" },
  { id: "motivos_ocorrencia", title: "Motivos de Ocorrência" },
  { id: "motivos_cancelamento", title: "Motivos de Cancelamento" },
  { id: "prioridades", title: "Prioridades" }
];

const CONFIG = {
  regioes: {
    nome: "Regiões",
    tabela: "regioes",
    campos: [
      { name: "codigo", label: "Código", required: true },
      { name: "nome", label: "Nome da Região", required: true },
      { name: "uf", label: "UF" },
      { name: "cidades", label: "Cidades/Praças", type: "textarea" },
      { name: "faixa_cep", label: "Faixa de CEP" },
      { name: "tipo_operacao", label: "Tipo Operação Predominante" },
      { name: "status", label: "Status", type: "select", options: [{value: "Ativo", label: "Ativo"}, {value: "Inativo", label: "Inativo"}], required: true }
    ] as FieldConfig[]
  },
  filiais: {
    nome: "Filiais",
    tabela: "filiais",
    campos: [
      { name: "nome", label: "Nome da Filial", required: true },
      { name: "cnpj", label: "CNPJ", required: true },
      { name: "endereco", label: "Endereço Completo", type: "textarea" },
      { name: "responsavel", label: "Responsável" },
      { name: "contato", label: "Contato" },
      { name: "status", label: "Status", type: "select", options: [{value: "Ativo", label: "Ativo"}, {value: "Inativo", label: "Inativo"}], required: true }
    ] as FieldConfig[]
  },
  unidades: {
    nome: "Unidades",
    tabela: "unidades",
    campos: [
      { name: "nome", label: "Nome da Unidade", required: true },
      { name: "filial_vinculada", label: "Filial Vinculada" },
      { name: "endereco", label: "Endereço", type: "textarea" },
      { name: "contato", label: "Contato" },
      { name: "status", label: "Status", type: "select", options: [{value: "Ativo", label: "Ativo"}, {value: "Inativo", label: "Inativo"}], required: true }
    ] as FieldConfig[]
  },
  centros_custo: {
    nome: "Centros de Custo",
    tabela: "centros_custo",
    campos: [
      { name: "codigo", label: "Código", required: true },
      { name: "nome", label: "Nome", required: true },
      { name: "descricao", label: "Descrição", type: "textarea" },
      { name: "unidade", label: "Unidade Vínculada" },
      { name: "status", label: "Status", type: "select", options: [{value: "Ativo", label: "Ativo"}, {value: "Inativo", label: "Inativo"}], required: true }
    ] as FieldConfig[]
  }
};

const CadastrosAuxiliares = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "regioes";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val });
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cadastros Auxiliares</h1>
          <p className="text-sm text-muted-foreground">Gestão de tabelas de apoio, estrutura organizacional e parâmetros operacionais.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="bg-muted/60 mb-6 flex flex-wrap h-auto p-1">
          <TabsTrigger value="regioes" className="gap-2 py-2"><MapPin className="w-4 h-4"/> Regiões</TabsTrigger>
          <TabsTrigger value="filiais" className="gap-2 py-2"><Building2 className="w-4 h-4"/> Filiais</TabsTrigger>
          <TabsTrigger value="unidades" className="gap-2 py-2"><Store className="w-4 h-4"/> Unidades</TabsTrigger>
          <TabsTrigger value="centros-custo" className="gap-2 py-2"><CreditCard className="w-4 h-4"/> Centros de Custo</TabsTrigger>
          <TabsTrigger value="tabelas" className="gap-2 py-2"><List className="w-4 h-4"/> Tabelas Auxiliares</TabsTrigger>
        </TabsList>

        <TabsContent value="regioes" className="mt-0">
          <GenericCrud tableName={CONFIG.regioes.tabela} title={CONFIG.regioes.nome} fields={CONFIG.regioes.campos} searchFields={["nome", "codigo"]} />
        </TabsContent>

        <TabsContent value="filiais" className="mt-0">
          <GenericCrud tableName={CONFIG.filiais.tabela} title={CONFIG.filiais.nome} fields={CONFIG.filiais.campos} searchFields={["nome", "cnpj"]} />
        </TabsContent>

        <TabsContent value="unidades" className="mt-0">
          <GenericCrud tableName={CONFIG.unidades.tabela} title={CONFIG.unidades.nome} fields={CONFIG.unidades.campos} searchFields={["nome", "filial_vinculada"]} />
        </TabsContent>

        <TabsContent value="centros-custo" className="mt-0">
          <GenericCrud tableName={CONFIG.centros_custo.tabela} title={CONFIG.centros_custo.nome} fields={CONFIG.centros_custo.campos} searchFields={["nome", "codigo"]} />
        </TabsContent>

        <TabsContent value="tabelas" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {TABELAS_AUXILIARES.map(tabela => (
              <div key={tabela.id} className="p-6 rounded-lg border bg-card">
                <h3 className="text-lg font-medium mb-4">{tabela.title}</h3>
                <GenericCrud 
                  tableName={tabela.id} 
                  title={tabela.title} 
                  fields={[
                    { name: "nome", label: "Nome/Descrição", required: true },
                    { name: "status", label: "Status", type: "select", options: [{value: "Ativo", label: "Ativo"}, {value: "Inativo", label: "Inativo"}], required: true }
                  ]}
                  searchFields={["nome"]}
                />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CadastrosAuxiliares;
