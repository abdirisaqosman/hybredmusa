import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { WorkoutTemplate } from "@hybredmusa/shared";
import { useDeleteTemplate, useSaveTemplate, useTemplates } from "@/api/workouts";
import { ExercisePicker } from "@/components/workouts/ExercisePicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface Row {
  exerciseId: string;
  exerciseName: string;
  targetSets: string;
  targetReps: string;
  targetWeight: string;
  restSeconds: string;
}

function toRows(template: WorkoutTemplate): Row[] {
  return template.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    targetSets: exercise.targetSets?.toString() ?? "",
    targetReps: exercise.targetReps?.toString() ?? "",
    targetWeight: exercise.targetWeight?.toString() ?? "",
    restSeconds: exercise.restSeconds?.toString() ?? "",
  }));
}

export function TemplatesCard({ clientId }: { clientId: string }) {
  const templates = useTemplates(clientId);
  const deleteTemplate = useDeleteTemplate(clientId);
  const [editing, setEditing] = useState<WorkoutTemplate | "new" | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Workout templates</CardTitle>
          <CardDescription>The plan. Editing one never changes a logged session.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          New template
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {templates.isPending && <Skeleton className="h-20 w-full" />}
        {templates.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No templates yet.</p>
        )}
        {templates.data?.items.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setEditing(template)}
            >
              <p className="truncate text-sm font-medium">{template.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {template.exercises.map((e) => e.exerciseName).join(", ")}
              </p>
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${template.name}`}
              onClick={() =>
                deleteTemplate.mutate(template.id, {
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </CardContent>

      <TemplateDialog
        clientId={clientId}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </Card>
  );
}

function TemplateDialog({
  clientId,
  editing,
  onClose,
}: {
  clientId: string;
  editing: WorkoutTemplate | "new" | null;
  onClose: () => void;
}) {
  const save = useSaveTemplate(clientId);
  const existing = editing && editing !== "new" ? editing : null;

  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the template being edited once per open.
  const key = existing?.id ?? (editing === "new" ? "new" : null);
  if (key && loadedFor !== key) {
    setLoadedFor(key);
    setName(existing?.name ?? "");
    setRows(existing ? toRows(existing) : []);
  }
  if (!key && loadedFor !== null) setLoadedFor(null);

  const update = (index: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>Set the targets. The client logs what they actually do.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (rows.length === 0) {
              toast.error("Add at least one exercise");
              return;
            }
            save.mutate(
              {
                templateId: existing?.id,
                name,
                exercises: rows.map((row) => ({
                  exerciseId: row.exerciseId,
                  targetSets: numberOrNull(row.targetSets),
                  targetReps: numberOrNull(row.targetReps),
                  targetWeight: numberOrNull(row.targetWeight),
                  restSeconds: numberOrNull(row.restSeconds),
                })),
              },
              {
                onSuccess: () => {
                  toast.success("Template saved");
                  onClose();
                },
                onError: (error) => toast.error(error.message),
              },
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={`${row.exerciseId}-${index}`} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{row.exerciseName}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.exerciseName}`}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["targetSets", "Sets"],
                      ["targetReps", "Reps"],
                      ["targetWeight", "Weight kg"],
                      ["restSeconds", "Rest s"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs" htmlFor={`${field}-${index}`}>
                        {label}
                      </Label>
                      <Input
                        id={`${field}-${index}`}
                        inputMode="decimal"
                        value={row[field]}
                        onChange={(e) => update(index, field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Add an exercise</p>
            <ExercisePicker
              onPick={(exercise) =>
                setRows((prev) => [
                  ...prev,
                  {
                    exerciseId: exercise.id,
                    exerciseName: exercise.name,
                    targetSets: "3",
                    targetReps: "10",
                    targetWeight: "",
                    restSeconds: "90",
                  },
                ])
              }
            />
          </div>

          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save template"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
