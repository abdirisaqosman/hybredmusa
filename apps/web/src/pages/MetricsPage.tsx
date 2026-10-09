import { useState } from "react";
import { toast } from "sonner";
import { useMe } from "@/api/auth";
import { useMetrics, useSaveMetric } from "@/api/metrics";
import { shiftDate, todayIso } from "@/components/DateNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function MetricsPage() {
  const me = useMe();
  const clientId = me.data?.user.id ?? "";
  const today = todayIso();
  const metrics = useMetrics(clientId, shiftDate(today, -29), today);
  const save = useSaveMetric(clientId);

  const [date, setDate] = useState(today);
  const [steps, setSteps] = useState("");
  const [bodyweight, setBodyweight] = useState("");

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Steps and bodyweight</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log a day</CardTitle>
          <CardDescription>Leave a field empty to keep what is already saved.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-4 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!steps && !bodyweight) {
                toast.error("Enter steps, bodyweight, or both");
                return;
              }
              save.mutate(
                {
                  date,
                  ...(steps ? { steps: Number(steps) } : {}),
                  ...(bodyweight ? { bodyweightKg: Number(bodyweight) } : {}),
                },
                {
                  onSuccess: () => {
                    setSteps("");
                    setBodyweight("");
                    toast.success("Saved");
                  },
                  onError: (error) => toast.error(error.message),
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="metric-date">Date</Label>
              <Input
                id="metric-date"
                type="date"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric-steps">Steps</Label>
              <Input
                id="metric-steps"
                inputMode="numeric"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric-weight">Bodyweight kg</Label>
              <Input
                id="metric-weight"
                inputMode="decimal"
                value={bodyweight}
                onChange={(e) => setBodyweight(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.isPending && <Skeleton className="h-32 w-full" />}
          {metrics.data?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          )}
          {metrics.data && metrics.data.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Bodyweight</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...metrics.data.items].reverse().map((item) => (
                  <TableRow key={item.date}>
                    <TableCell className="tabular-nums">{item.date}</TableCell>
                    <TableCell className="tabular-nums">{item.steps ?? "-"}</TableCell>
                    <TableCell className="tabular-nums">
                      {item.bodyweightKg !== null ? `${item.bodyweightKg} kg` : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.stepsSource ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
