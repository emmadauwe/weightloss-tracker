import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DateField({
  label,
  value,
  onChange,
  fromYear,
  toYear,
}: {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  fromYear?: number;
  toYear?: number;
}) {
  const selected = value ? parseISO(value) : undefined;
  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={`h-9 w-full min-w-0 justify-start px-3 text-left font-normal shadow-sm ${!selected ? "text-muted-foreground" : ""}`}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 truncate">
              {selected ? format(selected, "d MMM yyyy", { locale: nl }) : "Kies datum"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : undefined)}
            defaultMonth={selected}
            locale={nl}
            captionLayout={fromYear || toYear ? "dropdown" : undefined}
            startMonth={fromYear ? new Date(fromYear, 0, 1) : undefined}
            endMonth={toYear ? new Date(toYear, 11, 31) : undefined}
            initialFocus
            className="pointer-events-auto p-3"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
