import type { Diary } from "@hybredmusa/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const MACROS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
] as const;

export function MacroSummary({ diary }: { diary: Diary }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {diary.targets ? "Today against target" : "Today"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {MACROS.map(({ key, label, unit }) => {
          const eaten = diary.totals[key];
          const target = diary.targets ? diary.targets[key] : null;
          const percent = target ? Math.min(100, Math.round((eaten / target) * 100)) : 0;

          return (
            <div key={key} className="space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">
                {eaten}
                {target !== null && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {target}
                  </span>
                )}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
              </p>
              {target !== null && <Progress value={percent} className="h-1.5" />}
              {diary.remaining && (
                <p className="text-xs text-muted-foreground">
                  {diary.remaining[key] >= 0
                    ? `${diary.remaining[key]} left`
                    : `${Math.abs(diary.remaining[key])} over`}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
