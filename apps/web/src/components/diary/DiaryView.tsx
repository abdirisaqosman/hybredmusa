import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { Diary } from "@hybredmusa/shared";
import { useDeleteFoodLog } from "@/api/nutrition";
import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { MacroSummary } from "@/components/diary/MacroSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

interface Props {
  diary: Diary;
  /** A coach reading a client's day sees the entries but cannot change them. */
  canEdit: boolean;
}

export function DiaryView({ diary, canEdit }: Props) {
  const deleteLog = useDeleteFoodLog(diary.clientId, diary.date);

  return (
    <div className="space-y-4">
      <MacroSummary diary={diary} />

      {diary.meals.map((group) => (
        <Card key={group.meal}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div>
              <CardTitle className="text-base">{MEAL_LABELS[group.meal]}</CardTitle>
              <p className="text-xs text-muted-foreground tabular-nums">
                {group.totals.calories} kcal, P {group.totals.proteinG} C {group.totals.carbsG} F{" "}
                {group.totals.fatG}
              </p>
            </div>
            {canEdit && (
              <AddFoodDialog clientId={diary.clientId} date={diary.date} meal={group.meal} />
            )}
          </CardHeader>
          <CardContent className="space-y-1">
            {group.entries.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing logged.</p>
            )}
            {group.entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{entry.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {entry.grams > 0 ? `${entry.grams} g, ` : ""}
                    {entry.calories} kcal
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    P {entry.proteinG} C {entry.carbsG} F {entry.fatG}
                  </span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${entry.name}`}
                      onClick={() =>
                        deleteLog.mutate(entry.id, {
                          onError: (error) => toast.error(error.message),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
