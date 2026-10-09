import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSetTarget, useTarget } from "@/api/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  ["calories", "Calories"],
  ["proteinG", "Protein g"],
  ["carbsG", "Carbs g"],
  ["fatG", "Fat g"],
] as const;

type Values = Record<(typeof FIELDS)[number][0], string>;

const EMPTY: Values = { calories: "", proteinG: "", carbsG: "", fatG: "" };

export function TargetForm({ clientId }: { clientId: string }) {
  const target = useTarget(clientId);
  const setTarget = useSetTarget(clientId);
  const [values, setValues] = useState<Values>(EMPTY);

  // Prefill with whatever is currently in force, so a change is a small edit.
  useEffect(() => {
    const current = target.data?.target;
    if (!current) return;
    setValues({
      calories: String(current.calories),
      proteinG: String(current.proteinG),
      carbsG: String(current.carbsG),
      fatG: String(current.fatG),
    });
  }, [target.data?.target]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Macro target</CardTitle>
        <CardDescription>
          {target.data?.target
            ? `In force since ${target.data.target.effectiveFrom}. Saving writes a new target from today, past days keep theirs.`
            : "No target set yet."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-5 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setTarget.mutate(
              {
                calories: Number(values.calories),
                proteinG: Number(values.proteinG),
                carbsG: Number(values.carbsG),
                fatG: Number(values.fatG),
              },
              {
                onSuccess: () => toast.success("Target saved"),
                onError: (error) => toast.error(error.message),
              },
            );
          }}
        >
          {FIELDS.map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`target-${key}`}>{label}</Label>
              <Input
                id={`target-${key}`}
                inputMode="numeric"
                required
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
          <Button type="submit" disabled={setTarget.isPending}>
            {setTarget.isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
