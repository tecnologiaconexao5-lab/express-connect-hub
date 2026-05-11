import { LucideIcon, FileText, Image, File, FileSignature, Camera, X, Eye, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Document {
  id: string;
  type: "comprovante" | "assinatura" | "foto" | "xml" | "cte" | "pdf";
  url?: string;
  label: string;
  thumbnailUrl?: string;
}

interface PortalDocumentPreviewProps {
  documents: Document[];
  onDownload?: (doc: Document) => void;
  onView?: (doc: Document) => void;
}

const typeConfig: Record<string, { icon: LucideIcon; color: string; bgColor: string; label: string }> = {
  comprovante: { icon: Camera, color: "text-emerald-600", bgColor: "bg-emerald-50", label: "Comprovante" },
  assinatura: { icon: FileSignature, color: "text-[#F97316]", bgColor: "bg-[#F97316]/10", label: "Assinatura" },
  foto: { icon: Image, color: "text-blue-600", bgColor: "bg-blue-50", label: "Foto" },
  xml: { icon: FileText, color: "text-amber-600", bgColor: "bg-amber-50", label: "XML" },
  cte: { icon: File, color: "text-orange-600", bgColor: "bg-orange-50", label: "CT-e" },
  pdf: { icon: FileText, color: "text-red-600", bgColor: "bg-red-50", label: "PDF" },
};

export function PortalDocumentPreview({ documents, onDownload, onView }: PortalDocumentPreviewProps) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  if (!documents || documents.length === 0) {
    return (
      <Card className="bg-white border-[#E5E7EB] border-dashed rounded-2xl">
        <CardContent className="p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-[#64748B]" />
          </div>
          <p className="text-sm text-[#475569] mb-1">Nenhum documento disponível</p>
          <p className="text-xs text-[#64748B]">Documentos aparecerão aqui quando disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const groupedDocs = documents.reduce((acc, doc) => {
    if (!acc[doc.type]) acc[doc.type] = [];
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <>
      <div className="space-y-4">
        {Object.entries(groupedDocs).map(([type, docs]) => {
          const config = typeConfig[type] || typeConfig.pdf;
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <config.icon className={`w-4 h-4 ${config.color}`} />
                <span className="text-xs font-medium text-[#475569]">{config.label}</span>
                <span className="text-xs text-[#64748B]">({docs.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="relative group bg-white border border-[#E5E7EB] rounded-xl p-2 hover:border-[#D1D5DB] transition-colors cursor-pointer"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className={`w-full aspect-video rounded ${config.bgColor} flex items-center justify-center`}>
                      {doc.thumbnailUrl ? (
                        <img
                          src={doc.thumbnailUrl}
                          alt={doc.label}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <config.icon className={`w-6 h-6 ${config.color}`} />
                      )}
                    </div>
                    <p className="text-[10px] text-[#475569] mt-1 truncate">{doc.label}</p>
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 bg-white/90 hover:bg-white shadow-sm border border-[#E5E7EB]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDoc(doc);
                        }}
                      >
                        <Eye className="w-3 h-3 text-[#475569]" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl bg-white border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-[#111827] flex items-center gap-2">
              {selectedDoc && (
                <>
                  {selectedDoc.type === "comprovante" && <Camera className="w-5 h-5 text-emerald-600" />}
                  {selectedDoc.type === "assinatura" && <FileSignature className="w-5 h-5 text-[#F97316]" />}
                  {selectedDoc.type === "foto" && <Image className="w-5 h-5 text-blue-600" />}
                  {selectedDoc.type === "xml" && <FileText className="w-5 h-5 text-amber-600" />}
                  {selectedDoc.type === "cte" && <File className="w-5 h-5 text-orange-600" />}
                  {selectedDoc.type === "pdf" && <FileText className="w-5 h-5 text-red-600" />}
                  {selectedDoc.label}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            {selectedDoc?.url ? (
              selectedDoc.type === "xml" || selectedDoc.type === "pdf" || selectedDoc.type === "cte" ? (
                <div className="w-full h-[400px] flex items-center justify-center bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg">
                  <iframe
                    src={selectedDoc.url}
                    className="w-full h-full rounded"
                    title={selectedDoc.label}
                  />
                </div>
              ) : (
                <img
                  src={selectedDoc.url}
                  alt={selectedDoc.label}
                  className="max-w-full max-h-[400px] rounded"
                />
              )
            ) : (
              <div className="w-full h-[200px] flex items-center justify-center bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg">
                <p className="text-[#64748B]">Documento não disponível</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            {selectedDoc?.url && (
              <>
                <Button
                  variant="outline"
                  className="bg-white border-[#E5E7EB] text-[#475569]"
                  onClick={() => window.open(selectedDoc.url, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir
                </Button>
                <Button
                  className="bg-[#F97316] hover:bg-[#EA580C] text-white"
                  onClick={() => onDownload?.(selectedDoc)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
