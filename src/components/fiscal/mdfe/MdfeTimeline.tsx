import { useEffect, useState } from "react";
import { History, SearchX } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface MdfeTimelineProps {
  mdfeId: string;
}

export default function MdfeTimeline({ mdfeId }: MdfeTimelineProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mdfeId) {
      fetchEvents();
    }
  }, [mdfeId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fiscal_events")
        .select("*")
        .eq("documento_tipo", "MDFE")
        .eq("documento_id", mdfeId)
        .order("data_evento", { ascending: false });

      if (error) {
        console.error("Erro ao buscar eventos do MDF-e:", error);
        return;
      }
      
      setEvents(data || []);
    } catch (err) {
      console.error("Exceção ao buscar eventos:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div>
        <p className="text-sm">Carregando eventos do MDF-e...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200">
        <div className="bg-slate-100 p-3 rounded-full mb-3">
          <SearchX className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">Nenhum evento fiscal registrado para este MDF-e.</p>
        <p className="text-xs mt-1 text-slate-500">Eventos como autorização ou encerramento aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="relative border-l-2 border-slate-200 ml-4">
        {events.map((event, index) => (
          <div key={event.id || index} className="mb-8 ml-6 relative">
            <span className="absolute flex items-center justify-center w-6 h-6 bg-purple-100 rounded-full -left-[35px] ring-4 ring-white">
              <History className="w-3 h-3 text-purple-600" />
            </span>
            <div className="flex flex-col">
              <h3 className="font-semibold text-slate-800 text-sm">
                {event.evento || "Evento Desconhecido"}
              </h3>
              <time className="block mb-2 text-xs font-normal leading-none text-slate-500">
                {event.data_evento ? new Date(event.data_evento).toLocaleString() : "Data não registrada"}
              </time>
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-100 whitespace-pre-wrap font-mono mt-1">
                {event.descricao || "Sem descrição detalhada."}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
