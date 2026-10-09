import { useState } from "react";
import type { Exercise } from "@hybredmusa/shared";
import { useExercises } from "@/api/workouts";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function ExercisePicker({ onPick }: { onPick: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState("");
  const exercises = useExercises(query);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {exercises.isPending && <Skeleton className="h-40 w-full" />}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {exercises.data?.items.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => onPick(exercise)}
            className="flex w-full items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-accent"
          >
            <span>{exercise.name}</span>
            <span className="text-xs text-muted-foreground">
              {exercise.muscleGroup} - {exercise.equipment}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
