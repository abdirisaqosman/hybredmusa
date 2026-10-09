import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const DAY = 86_400_000;

export function shiftDate(date: string, days: number) {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY)
    .toISOString()
    .slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function DateNav({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const isToday = date === todayIso();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous day"
        onClick={() => onChange(shiftDate(date, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-28 text-center text-sm font-medium tabular-nums">
        {isToday ? "Today" : date}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next day"
        disabled={isToday}
        onClick={() => onChange(shiftDate(date, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
