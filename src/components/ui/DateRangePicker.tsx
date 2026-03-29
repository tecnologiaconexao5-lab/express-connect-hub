import { useState, useEffect } from "react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subYears, startOfYear, endOfYear, subQuarters, startOfQuarter, endOfQuarter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  className?: string;
  value?: DateRange;
  onChange?: (range: DateRange) => void;
}

const quickOptions = [
  { label: "Hoje", getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: "Ontem", getValue: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
  { label: "Esta semana", getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 0 }), to: endOfWeek(new Date(), { weekStartsOn: 0 }) }) },
  { label: "Semana passada", getValue: () => ({ from: startOfWeek(subDays(new Date(), 7), { weekStartsOn: 0 }), to: endOfWeek(subDays(new Date(), 7), { weekStartsOn: 0 }) }) },
  { label: "Este mês", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Mês passado", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Últimos 30 dias", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "Últimos 90 dias", getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: "Este trimestre", getValue: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }) },
  { label: "Este ano", getValue: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
];

export function DateRangePicker({ className, value, onChange }: DateRangePickerProps) {
  const [dateRange, setDateRange] = useState<DateRange>(value || { from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("Este mês");

  useEffect(() => {
    if (value) {
      setDateRange(value);
    }
  }, [value]);

  const handleSelect = (range: DateRange | undefined) => {
    const newRange = range || { from: undefined, to: undefined };
    setDateRange(newRange);
    setActivePreset("Personalizado");
    if (onChange) {
      onChange(newRange);
    }
  };

  const handlePresetClick = (preset: typeof quickOptions[0]) => {
    const newRange = preset.getValue();
    setDateRange(newRange);
    setActivePreset(preset.label);
    if (onChange) {
      onChange(newRange);
    }
  };

  const clearRange = () => {
    setDateRange({ from: undefined, to: undefined });
    setActivePreset("");
    if (onChange) {
      onChange({ from: undefined, to: undefined });
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal h-9 px-3",
              !dateRange.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.from ? (
              dateRange.to ? (
                <>
                  {formatDate(dateRange.from)} — {formatDate(dateRange.to)}
                </>
              ) : (
                formatDate(dateRange.from)
              )
            ) : (
              <span>Selecione o período</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Quick options sidebar */}
            <div className="border-r bg-muted/20 p-2 min-w-[140px]">
              <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Período</div>
              {quickOptions.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-md transition",
                    activePreset === preset.label
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Calendar */}
            <div className="p-2">
              <Calendar
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={handleSelect}
                numberOfMonths={2}
                locale={ptBR}
              />
            </div>
          </div>
          
          {/* Footer with apply button */}
          <div className="border-t p-2 flex justify-end gap-2">
            {dateRange.from || dateRange.to ? (
              <Button variant="ghost" size="sm" onClick={clearRange}>
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setIsOpen(false)}>
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateRangePicker;
