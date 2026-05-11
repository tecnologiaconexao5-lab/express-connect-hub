const fs = require('fs');

let fileStr = fs.readFileSync('src/components/operacao/RoteirizadorWeb.tsx', 'utf8');

// 1. Add Imports
if (!fileStr.includes("import Papa")) {
  fileStr = fileStr.replace(
    'import { useState } from "react";',
    'import { useState } from "react";\nimport Papa from "papaparse";\nimport * as XLSX from "xlsx";\nimport { toast } from "sonner";'
  );
}

// 2. Add States and Handlers
const stateInjection = `
  const [importedPedidos, setImportedPedidos] = useState<PedidoRoteirizacao[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState("");

  const processImportData = (data: any[]) => {
    const novosPedidos: PedidoRoteirizacao[] = data.map((row, index) => {
      const p = {
        id: "IMP-" + Date.now() + "-" + index,
        numeroPedido: row.numero_pedido || row.numeroPedido || \`SEM-NUM-\${index}\`,
        cliente: row.cliente || "Não informado",
        destinatario: row.destinatario || "Não informado",
        telefone: row.telefone || "",
        cep: (row.cep || "").toString().replace(/\\D/g, ''),
        enderecoCompleto: row.endereco || "",
        bairro: row.bairro || "",
        cidade: row.cidade || "",
        estado: row.estado || "",
        latitude: 0,
        longitude: 0,
        pesoKg: parseFloat(row.peso_kg) || parseFloat(row.peso) || 0,
        quantidadeVolumes: parseInt(row.quantidade_volumes) || parseInt(row.volumes) || 0,
        comprimentoCm: parseFloat(row.comprimento_cm) || 0,
        larguraCm: parseFloat(row.largura_cm) || 0,
        alturaCm: parseFloat(row.altura_cm) || 0,
        cubagemM3: 0,
        tipoCarga: row.tipo_carga || "seco",
        secoOuRefrigerado: (row.seco_ou_refrigerado || "seco").toLowerCase().includes("refri") ? "refrigerado" : "seco",
        temperaturaMinima: parseFloat(row.temperatura_minima) || undefined,
        janelaInicio: row.janela_inicio || "",
        janelaFim: row.janela_fim || "",
        prioridade: (row.prioridade || "normal").toLowerCase(),
        observacoes: row.observacoes || "",
        status: "pendente" as const
      };
      p.cubagemM3 = calcularCubagemPedido(p as any);
      return p as PedidoRoteirizacao;
    });
    setImportedPedidos(novosPedidos);
    setFileError("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setFileError("");
    setImportedPedidos([]);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processImportData(results.data);
          setIsUploading(false);
        },
        error: (err) => {
          setFileError("Erro ao ler CSV: " + err.message);
          setIsUploading(false);
        }
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const wsname = workbook.SheetNames[0];
          const ws = workbook.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          processImportData(data);
        } catch (err: any) {
          setFileError("Erro ao ler Excel: " + err.message);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setFileError("Formato de arquivo não suportado. Use .csv ou .xlsx");
      setIsUploading(false);
    }
    
    e.target.value = '';
  };

  const confirmarImportacao = () => {
    const validos = importedPedidos.filter(p => !validarListaPedidos([p]).some(a => a.tipo === 'erro'));
    if (validos.length === 0) {
      toast.error("Nenhum pedido válido para importar.");
      return;
    }
    if (validos.length < importedPedidos.length) {
      toast.warning(\`Foram ignorados \${importedPedidos.length - validos.length} pedidos inválidos.\`);
    }
    setPedidos(validos);
    setImportedPedidos([]);
    toast.success(\`\${validos.length} pedidos importados com sucesso!\`);
    setActiveTab("visao_geral");
  };

  const limparImportacao = () => {
    setImportedPedidos([]);
    setFileError("");
  };

  const totaisImportados = calcularTotaisPedidos(importedPedidos);
`;

if (!fileStr.includes('handleFileUpload')) {
  fileStr = fileStr.replace('const totais = calcularTotaisPedidos(pedidos);', stateInjection + '\n  const totais = calcularTotaisPedidos(pedidos);');
}

// 3. Replace Importar Tab Content
const regexImportarTab = /<TabsContent value="importar" className="space-y-4">[\s\S]*?(?=<\/TabsContent>)<\/TabsContent>/;

const newImportarTab = `<TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Pedidos por Planilha</CardTitle>
              <CardDescription>
                Faça upload de uma planilha CSV ou Excel com os pedidos a serem roteirizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {importedPedidos.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center relative hover:bg-slate-50 transition-colors">
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    Arraste a planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Formatos aceitos: .csv, .xlsx, .xls
                  </p>
                  <Button variant="outline" className="pointer-events-none">
                    {isUploading ? 'Processando...' : 'Selecionar Arquivo'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 border rounded-lg">
                    <div>
                      <h4 className="font-bold text-slate-800">Preview da Importação</h4>
                      <p className="text-sm text-slate-500">{importedPedidos.length} linhas processadas</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={limparImportacao}>Limpar</Button>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={confirmarImportacao}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmar Importação
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total Pedidos</p>
                      <p className="text-xl font-bold">{totaisImportados.totalPedidos}</p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Válidos</p>
                      <p className="text-xl font-bold text-green-600">
                        {importedPedidos.filter(p => !validarListaPedidos([p]).some(a => a.tipo === 'erro')).length}
                      </p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Inválidos (Bloqueados)</p>
                      <p className="text-xl font-bold text-red-600">
                        {importedPedidos.filter(p => validarListaPedidos([p]).some(a => a.tipo === 'erro')).length}
                      </p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Cubagem / Peso</p>
                      <p className="text-sm font-bold text-blue-600">
                        {totaisImportados.cubagemTotalM3.toFixed(2)}m³ / {totaisImportados.pesoTotalKg.toFixed(0)}kg
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border rounded-lg max-h-[400px]">
                    <Table>
                      <TableHeader className="bg-slate-100 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Nº Pedido</TableHead>
                          <TableHead>Destinatário</TableHead>
                          <TableHead>CEP</TableHead>
                          <TableHead>Cidade/UF</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>Cubagem</TableHead>
                          <TableHead>Alertas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importedPedidos.map((pedido, i) => {
                          const validacoes = validarListaPedidos([pedido]);
                          const erros = validacoes.filter(a => a.tipo === 'erro');
                          const avisos = validacoes.filter(a => a.tipo === 'aviso');
                          const statusColor = erros.length > 0 ? "bg-red-100 text-red-800" : avisos.length > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";
                          const statusLabel = erros.length > 0 ? "Inválido" : avisos.length > 0 ? "Alerta" : "Válido";
                          
                          return (
                            <TableRow key={i} className={erros.length > 0 ? "bg-red-50/50" : ""}>
                              <TableCell><Badge variant="outline" className={statusColor}>{statusLabel}</Badge></TableCell>
                              <TableCell className="font-medium text-xs">{pedido.numeroPedido}</TableCell>
                              <TableCell className="text-xs">{pedido.destinatario}</TableCell>
                              <TableCell className="text-xs font-mono">{pedido.cep || '-'}</TableCell>
                              <TableCell className="text-xs">{pedido.cidade}/{pedido.estado}</TableCell>
                              <TableCell className="text-xs">{pedido.pesoKg}kg</TableCell>
                              <TableCell className="text-xs">{calcularCubagemPedido(pedido).toFixed(3)}m³</TableCell>
                              <TableCell className="text-xs max-w-xs truncate text-red-600">
                                {erros.length > 0 ? erros[0].mensagem : (avisos.length > 0 ? avisos[0].mensagem : "-")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {fileError && <p className="text-red-500 mt-4 text-sm font-bold text-center">{fileError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modelo da Planilha</CardTitle>
              <CardDescription>Baixe o modelo para preenchimento correto</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={downloadModeloPlanilha}>
                <Download className="w-4 h-4 mr-2" />
                Baixar Modelo CSV
              </Button>
              <div className="mt-4 overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {CABECALHO_PLANILHA.map(cab => (
                        <TableHead key={cab} className="text-xs whitespace-nowrap">{cab}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      {CABECALHO_PLANILHA.map((cab, idx) => (
                        <TableCell key={idx} className="text-xs text-muted-foreground whitespace-nowrap">exemplo</TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>`;

fileStr = fileStr.replace(regexImportarTab, newImportarTab);

fs.writeFileSync('src/components/operacao/RoteirizadorWeb.tsx', fileStr);
console.log('Roteirizador Import Update Done');
