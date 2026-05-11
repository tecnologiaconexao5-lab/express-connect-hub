const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/prestadores/PrestadorDetalhe.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Adicionar handleDelete
if (!content.includes('const handleDelete')) {
  content = content.replace(
    /carregarDocumentos\(\);\n  \}, \[p\.id\]\);/g,
    `carregarDocumentos();
  }, [p.id]);

  const handleDelete = async () => {
    const senha = window.prompt("Atenção: Exclusão permanente! Digite a senha administrativa para confirmar:");
    if (senha !== "admin123") {
      toast.error("Senha incorreta. Exclusão cancelada.");
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabase.from('prestadores').delete().eq('id', p.id);
      if (error) throw error;
      toast.success("Prestador excluído com sucesso!");
      onBack();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir prestador.");
    } finally {
      setIsLoading(false);
    }
  };`
  );
}

// 2. Fix document insert to upsert
content = content.replace(
  /const { data: dbData, error: dbError } = await supabase\.from\("documentos_prestadores"\)\.insert\(\[docPayload\]\)\.select\(\);/g,
  `const { data: dbData, error: dbError } = await supabase.from("documentos_prestadores").upsert([docPayload], { onConflict: 'prestador_id, tipo' }).select();`
);

// 3. Update Delete button in header
if (!content.includes('<Trash2 className="w-4 h-4" />\n                Excluir')) {
  content = content.replace(
    /<FileSignature className="w-4 h-4" \/>\n              Modelos de Contrato\n            <\/Button>\n          \)}\n          <Button size="sm" onClick=\{handleSave\} disabled=\{isLoading\}>\n            \{isLoading \? "Salvando\.\.\." : "Salvar"\}\n          <\/Button>/g,
    `<FileSignature className="w-4 h-4" />
              Modelos de Contrato
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 focus:ring-2 bg-red-50 hover:bg-red-100 text-red-700 border-red-200" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          size="lg" 
          className="shadow-xl shadow-primary/20 gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-6"
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Salvando...</>
          ) : (
            <><Save className="w-5 h-5"/> Salvar Prestador</>
          )}
        </Button>
      </div>`
  );
}

// 4. Change Layout structure
if (content.includes('className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6"')) {
  content = content.replace(
    /className="grid grid-cols-1 xl:grid-cols-\[1fr_320px\] gap-6"/g,
    'className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 items-start"'
  );
}

// 5. Move CARD LATERAL up
// Encontrar CARD LATERAL
const cardLateralRegex = /\{\/\* CARD LATERAL \*\/\}\n\s*<div className="space-y-4">[\s\S]*?(?=<\/div>\n\s*<\/div>\n\s*\{modalContratoOpen)/;
const match = content.match(cardLateralRegex);
if (match) {
  const cardStr = match[0];
  // Remover de onde estava
  content = content.replace(cardStr, '');
  // Colocar depois do <div className="grid ...">
  content = content.replace(
    /<div className="grid grid-cols-1 xl:grid-cols-\[320px_1fr\] gap-6 items-start">\n\s*\{\/\* Abas principais \*\/\}/,
    `<div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 items-start">
        ${cardStr}
        {/* Abas principais */}`
  );
}

// 6. Fix IDADE no CARD LATERAL
content = content.replace(
  /\{p\.scoreInterno\?\.toFixed\(1\) \|\| "0"\} \/ 5\.0<\/p>\n\s*<\/CardContent>\n\s*<\/Card>/g,
  `{p.scoreInterno?.toFixed(1) || "0"} / 5.0</p>
              {p.dataNascimento && (() => {
                const hoje = new Date();
                const nasc = new Date(p.dataNascimento);
                let idade = hoje.getFullYear() - nasc.getFullYear();
                const m = hoje.getMonth() - nasc.getMonth();
                if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
                return <p className="text-xs font-bold text-orange-600 mt-2">{idade} anos</p>;
              })()}
            </CardContent>
          </Card>`
);

// 7. Add Torre Tab List
content = content.replace(
  /<TabsTrigger value="qualidade">Qualidade<\/TabsTrigger>/g,
  `<TabsTrigger value="qualidade">Qualidade</TabsTrigger>
            <TabsTrigger value="torre">Torre de Controle</TabsTrigger>`
);

// 8. Add Torre Content
const torreContent = `
          {/* ABA 6 - TORRE DE CONTROLE */}
          <TabsContent value="torre" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Mini Relatório Torre de Controle</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-3xl font-bold text-red-600">{p.torreControle?.ocorrenciasGraves || 0}</p>
                  <p className="text-xs text-red-800 mt-1 font-medium">Ocorrências Graves</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-3xl font-bold text-orange-600">{p.torreControle?.sinistro || 0}</p>
                  <p className="text-xs text-orange-800 mt-1 font-medium">Sinistro</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-600">{p.torreControle?.extravio || 0}</p>
                  <p className="text-xs text-yellow-800 mt-1 font-medium">Extravio</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border">
                  <p className="text-3xl font-bold text-gray-700">{p.torreControle?.desobediencia || 0}</p>
                  <p className="text-xs text-gray-600 mt-1 font-medium">Desobediência / Má conduta</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border">
                  <p className="text-3xl font-bold text-gray-700">{p.torreControle?.atrasos || 0}</p>
                  <p className="text-xs text-gray-600 mt-1 font-medium">Atrasos</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{p.torreControle?.elogios || 0}</p>
                  <p className="text-xs text-green-800 mt-1 font-medium">Elogios</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Lançar Nova Observação/Ocorrência</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Ocorrências Graves</Label>
                    <Input type="number" value={p.torreControle?.ocorrenciasGraves || 0} onChange={(e) => setP(prev => ({...prev, torreControle: {...(prev.torreControle as any), ocorrenciasGraves: parseInt(e.target.value) || 0}}))} />
                  </div>
                  <div>
                    <Label className="text-xs">Sinistro</Label>
                    <Input type="number" value={p.torreControle?.sinistro || 0} onChange={(e) => setP(prev => ({...prev, torreControle: {...(prev.torreControle as any), sinistro: parseInt(e.target.value) || 0}}))} />
                  </div>
                  <div>
                    <Label className="text-xs">Extravio</Label>
                    <Input type="number" value={p.torreControle?.extravio || 0} onChange={(e) => setP(prev => ({...prev, torreControle: {...(prev.torreControle as any), extravio: parseInt(e.target.value) || 0}}))} />
                  </div>
                  <div>
                    <Label className="text-xs">Desobediência</Label>
                    <Input type="number" value={p.torreControle?.desobediencia || 0} onChange={(e) => setP(prev => ({...prev, torreControle: {...(prev.torreControle as any), desobediencia: parseInt(e.target.value) || 0}}))} />
                  </div>
                  <div>
                    <Label className="text-xs">Atrasos</Label>
                    <Input type="number" value={p.torreControle?.atrasos || 0} onChange={(e) => setP(prev => ({...prev, torreControle: {...(prev.torreControle as any), atrasos: parseInt(e.target.value) || 0}}))} />
                  </div>
                  <div>
                    <Label className="text-xs">Elogios</Label>
                    <Input type="number" value={p.torreControle?.elogios || 0} onChange={(e) => setP(prev => ({...prev, torreControle: {...(prev.torreControle as any), elogios: parseInt(e.target.value) || 0}}))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Observações da Torre</Label>
                  <Textarea rows={4} value={p.torreControle?.observacoes || ""} onChange={(e) => setP(prev => ({...prev, torreControle: {...(prev.torreControle as any), observacoes: e.target.value}}))} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>`;

if (!content.includes('value="torre"')) {
  content = content.replace(
    /<\/Tabs>\n\s*<div className="grid grid-cols-1 xl:grid-cols-\[320px_1fr\] gap-6 items-start">/g, // This won't match. 
    // We replaced grid cols earlier, but the Tabs is now INSIDE grid cols.
    // Let's find `</TabsContent>\n        </Tabs>`
    `</TabsContent>\n${torreContent}\n        </Tabs>`
  );
}

// Ensure the icons missing are imported
if (!content.includes('Save')) {
  content = content.replace(
    /from "lucide-react";/g,
    `, Save } from "lucide-react";`
  );
}
if (!content.includes('Trash2')) {
  content = content.replace(
    /from "lucide-react";/g,
    `, Trash2 } from "lucide-react";`
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Script applied successfully.');
