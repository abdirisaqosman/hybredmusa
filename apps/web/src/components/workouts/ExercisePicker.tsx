import { useState } from "react";
import type { Exercise } from "@hybredmusa/shared";
import { useExercises } from "@/api/workouts";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MuscleDiagram } from "@/components/workouts/MuscleDiagram";
import { musclesForExercise } from "@/lib/exerciseMuscles";

export function ExercisePicker({ onPick }: { onPick: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Exercise | null>(null);
  const exercises = useExercises(query);

  // The diagram follows whichever row the pointer or keyboard is on, falling back to the first row
  // so the panel is never empty.
  const shown = preview ?? exercises.data?.items[0] ?? null;
  const muscles = shown ? musclesForExercise(shown.id, shown.muscleGroup) : null;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {exercises.isPending && <Skeleton className="h-40 w-full" />}
      <div className="flex gap-3">
        <div className="max-h-64 flex-1 space-y-1 overflow-y-auto">
          {exercises.data?.items.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => onPick(exercise)}
              onMouseEnter={() => setPreview(exercise)}
              onFocus={() => setPreview(exercise)}
              className="flex w-full items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-accent"
            >
              <span>{exercise.name}</span>
              <span className="text-xs text-muted-foreground">
                {exercise.muscleGroup} - {exercise.equipment}
              </span>
            </button>
          ))}
        </div>
        {shown && muscles && (
          <div className="hidden w-36 shrink-0 sm:block">
            <div className="sticky top-0 space-y-1">
              <MuscleDiagram
                muscles={muscles}
                exerciseName={shown.name}
                height={128}
                showLegend
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
