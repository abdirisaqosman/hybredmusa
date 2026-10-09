import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Exercise } from "@hybredmusa/shared";
import { useMe } from "@/api/auth";
import { useExercises, useFinishSession, useSession, useTemplates } from "@/api/workouts";
import { ExerciseLogger } from "@/components/workouts/ExerciseLogger";
import { ExercisePicker } from "@/components/workouts/ExercisePicker";
import { MuscleDiagram } from "@/components/workouts/MuscleDiagram";
import { mergeMuscleMaps, musclesForExercise } from "@/lib/exerciseMuscles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentsCard } from "@/components/CommentsCard";

export function SessionPage() {
  const { sessionId } = useParams({ strict: false }) as { sessionId: string };
  const navigate = useNavigate();
  const me = useMe();
  const session = useSession(sessionId);
  const finish = useFinishSession(sessionId);
  const templates = useTemplates(me.data?.user.id ?? "");
  const library = useExercises();

  const [extra, setExtra] = useState<Exercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notes, setNotes] = useState("");

  if (session.isPending) return <Skeleton className="h-64 w-full" />;
  if (session.isError) return <p className="text-sm text-destructive">{session.error.message}</p>;
  if (!session.data) return null;

  const data = session.data;
  const isOwner = me.data?.user.id === data.clientId;
  const readOnly = !isOwner || Boolean(data.finishedAt);
  const template = templates.data?.items.find((t) => t.id === data.templateId);

  // Exercises from the template, then anything logged or added on the fly.
  const planned = template?.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    exerciseName: e.exerciseName,
    target: { sets: e.targetSets, reps: e.targetReps, weight: e.targetWeight },
  })) ?? [];

  const logged = data.sets.map((set) => ({
    exerciseId: set.exerciseId,
    exerciseName: set.exerciseName,
    target: null,
  }));

  const added = extra.map((exercise) => ({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    target: null,
  }));

  const seen = new Set<string>();
  const exercises = [...planned, ...logged, ...added].filter((item) => {
    if (seen.has(item.exerciseId)) return false;
    seen.add(item.exerciseId);
    return true;
  });

  // Everything this session works, shaded on one body.
  const sessionMuscles = mergeMuscleMaps(
    exercises.map((item) =>
      musclesForExercise(
        item.exerciseId,
        library.data?.items.find((entry) => entry.id === item.exerciseId)?.muscleGroup,
      ),
    ),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {data.templateName ?? "Workout"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.date}
            {data.finishedAt ? " - finished" : " - in progress"}
          </p>
        </div>
        {!readOnly && (
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Add exercise
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add an exercise</DialogTitle>
              </DialogHeader>
              <ExercisePicker
                onPick={(exercise) => {
                  setExtra((prev) => [...prev, exercise]);
                  setPickerOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sessionMuscles.primary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Muscles worked</CardTitle>
          </CardHeader>
          <CardContent>
            <MuscleDiagram
              muscles={sessionMuscles}
              exerciseName={data.templateName ?? "this workout"}
              height={180}
              showLegend
            />
          </CardContent>
        </Card>
      )}

      {exercises.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No exercises yet. Add one to start logging sets.
        </p>
      )}

      {exercises.map((exercise) => (
        <ExerciseLogger
          key={exercise.exerciseId}
          clientId={data.clientId}
          sessionId={data.id}
          exerciseId={exercise.exerciseId}
          exerciseName={exercise.exerciseName}
          target={exercise.target}
          sets={data.sets.filter((set) => set.exerciseId === exercise.exerciseId)}
          readOnly={readOnly}
        />
      ))}

      {data.notes && <p className="text-sm text-muted-foreground">Notes: {data.notes}</p>}

      <CommentsCard clientId={data.clientId} targetType="session" targetRef={data.id} />

      {!readOnly && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Session notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            disabled={finish.isPending}
            onClick={() =>
              finish.mutate(notes.trim() || null, {
                onSuccess: () => {
                  toast.success("Workout finished");
                  navigate({ to: "/workouts" });
                },
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Finish workout
          </Button>
        </div>
      )}
    </div>
  );
}
