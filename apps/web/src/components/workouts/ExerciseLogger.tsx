import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { SessionSet } from "@hybredmusa/shared";
import { useDeleteSet, useLogSet, usePreviousPerformance } from "@/api/workouts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  clientId: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  target: { sets: number | null; reps: number | null; weight: number | null } | null;
  sets: SessionSet[];
  readOnly?: boolean;
}

export function ExerciseLogger({
  clientId,
  sessionId,
  exerciseId,
  exerciseName,
  target,
  sets,
  readOnly = false,
}: Props) {
  const previous = usePreviousPerformance(clientId, exerciseId, sessionId);
  const logSet = useLogSet(sessionId);
  const deleteSet = useDeleteSet(sessionId);

  const lastSet = sets.at(-1) ?? previous.data?.previous?.sets.at(-1);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");

  const repsValue = reps === "" ? (target?.reps ?? lastSet?.reps ?? 8) : Number(reps);
  const weightValue = weight === "" ? (target?.weight ?? lastSet?.weight ?? 0) : Number(weight);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{exerciseName}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {target?.sets || target?.reps
            ? `Target ${target.sets ?? "-"} x ${target.reps ?? "-"}${
                target.weight ? ` @ ${target.weight} kg` : ""
              }`
            : "No target set"}
        </p>
        {previous.data?.previous && (
          <p className="text-xs text-muted-foreground">
            Last time ({previous.data.previous.date}):{" "}
            {previous.data.previous.sets
              .map((set) => `${set.reps} x ${set.weight} kg`)
              .join(", ")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {sets.map((set) => (
          <div key={set.id} className="flex items-center gap-3 border-b pb-1 text-sm last:border-b-0">
            <span className="w-6 text-muted-foreground tabular-nums">{set.setNumber}</span>
            <span className="tabular-nums">
              {set.reps} reps x {set.weight} kg
            </span>
            {set.rpe !== null && (
              <span className="text-xs text-muted-foreground">RPE {set.rpe}</span>
            )}
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label={`Delete set ${set.setNumber}`}
                onClick={() => deleteSet.mutate(set.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}

        {!readOnly && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              logSet.mutate(
                { exerciseId, reps: repsValue, weight: weightValue },
                {
                  onSuccess: () => {
                    setReps("");
                    setWeight("");
                  },
                  onError: (error) => toast.error(error.message),
                },
              );
            }}
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor={`reps-${exerciseId}`} className="text-xs">
                Reps
              </Label>
              <Input
                id={`reps-${exerciseId}`}
                inputMode="numeric"
                placeholder={String(repsValue)}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor={`weight-${exerciseId}`} className="text-xs">
                Weight kg
              </Label>
              <Input
                id={`weight-${exerciseId}`}
                inputMode="decimal"
                placeholder={String(weightValue)}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={logSet.isPending}>
              Log set
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
