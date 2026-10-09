import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Progress } from "@hybredmusa/shared";
import { useExerciseHistory, useProgress } from "@/api/coach";
import { useExercises } from "@/api/workouts";
import { ChartCard } from "@/components/charts/ChartCard";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { shiftDate, todayIso } from "@/components/DateNav";

const RANGES = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
] as const;

const axis = {
  stroke: "var(--viz-axis)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--popover-foreground)",
    fontSize: "12px",
  },
} as const;

function grid() {
  return <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="3 3" vertical={false} />;
}

export function ProgressCharts({ clientId }: { clientId: string }) {
  const [days, setDays] = useState<number>(90);
  const to = todayIso();
  const from = shiftDate(to, -(days - 1));
  const progress = useProgress(clientId, from, to);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="range" className="text-sm text-muted-foreground">
          Range
        </Label>
        <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
          <SelectTrigger id="range" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((range) => (
              <SelectItem key={range.days} value={String(range.days)}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {progress.isPending && <Skeleton className="h-64 w-full" />}
      {progress.data && <Charts data={progress.data} />}

      <StrengthChart clientId={clientId} />
    </div>
  );
}

function Charts({ data }: { data: Progress }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Calories against target"
        description="Daily intake, with the target that applied on that day."
        empty={data.nutrition.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.nutrition} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            {grid()}
            <XAxis dataKey="date" {...axis} minTickGap={24} />
            <YAxis {...axis} width={44} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              name="Eaten"
              type="monotone"
              dataKey="calories"
              stroke="var(--viz-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              name="Target"
              type="monotone"
              dataKey="targetCalories"
              stroke="var(--viz-2)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Macros"
        description="Protein, carbs and fat per day in grams."
        empty={data.nutrition.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.nutrition} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            {grid()}
            <XAxis dataKey="date" {...axis} minTickGap={24} />
            <YAxis {...axis} width={44} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              name="Protein"
              type="monotone"
              dataKey="proteinG"
              stroke="var(--viz-1)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              name="Carbs"
              type="monotone"
              dataKey="carbsG"
              stroke="var(--viz-2)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              name="Fat"
              type="monotone"
              dataKey="fatG"
              stroke="var(--viz-3)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Bodyweight"
        description="Kilograms, on the days it was logged."
        empty={data.bodyweight.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.bodyweight} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            {grid()}
            <XAxis dataKey="date" {...axis} minTickGap={24} />
            <YAxis {...axis} width={44} domain={["dataMin - 1", "dataMax + 1"]} />
            <Tooltip {...tooltipStyle} />
            <Line
              name="Bodyweight kg"
              type="monotone"
              dataKey="value"
              stroke="var(--viz-1)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Steps" description="Daily step count." empty={data.steps.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.steps} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            {grid()}
            <XAxis dataKey="date" {...axis} minTickGap={24} />
            <YAxis {...axis} width={44} />
            <Tooltip {...tooltipStyle} />
            <Bar name="Steps" dataKey="value" fill="var(--viz-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function StrengthChart({ clientId }: { clientId: string }) {
  const exercises = useExercises();
  const [exerciseId, setExerciseId] = useState("");
  const history = useExerciseHistory(clientId, exerciseId);

  return (
    <ChartCard
      title="Strength over time"
      description="Best set per session, with the estimated one rep max."
    >
      <div className="flex h-full flex-col gap-3">
        <Select value={exerciseId} onValueChange={setExerciseId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Pick an exercise" />
          </SelectTrigger>
          <SelectContent>
            {exercises.data?.items.map((exercise) => (
              <SelectItem key={exercise.id} value={exercise.id}>
                {exercise.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!exerciseId && (
          <p className="flex-1 content-center text-center text-sm text-muted-foreground">
            Pick an exercise to see best set and estimated one rep max per session.
          </p>
        )}

        {exerciseId && history.data?.points.length === 0 && (
          <p className="flex-1 content-center text-center text-sm text-muted-foreground">
            Nothing logged for this exercise yet.
          </p>
        )}

        {history.data && history.data.points.length > 0 && (
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={history.data.points}
                margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
              >
                {grid()}
                <XAxis dataKey="date" {...axis} minTickGap={24} />
                <YAxis {...axis} width={44} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  name="Best set kg"
                  type="monotone"
                  dataKey="bestWeight"
                  stroke="var(--viz-1)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  name="Estimated 1RM kg"
                  type="monotone"
                  dataKey="estimated1rm"
                  stroke="var(--viz-2)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
