import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminOverview } from "@/api/admin";
import { ChartCard } from "@/components/charts/ChartCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminOverviewPage() {
  const overview = useAdminOverview();

  if (overview.isPending) return <Skeleton className="h-64 w-full" />;
  if (overview.isError) return <p className="text-sm text-destructive">{overview.error.message}</p>;
  if (!overview.data) return null;

  const data = overview.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Users" value={data.users.total} hint={`${data.users.disabled} disabled`} />
        <Stat label="Coaches" value={data.users.coaches} />
        <Stat label="Clients" value={data.users.clients} />
        <Stat label="Admins" value={data.users.admins} />
        <Stat
          label="Links"
          value={data.links.active}
          hint={`${data.links.pendingInvites} invites pending`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active today" value={data.activeUsers.daily} />
        <Stat label="Active this week" value={data.activeUsers.weekly} />
        <Stat label="Active this month" value={data.activeUsers.monthly} />
      </div>

      <ChartCard
        title="Signups per day"
        description="Last 30 days."
        empty={data.signupsPerDay.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.signupsPerDay} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--viz-axis)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--viz-axis)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--popover-foreground)",
                fontSize: "12px",
              }}
            />
            <Bar name="Signups" dataKey="count" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usage</CardTitle>
            <CardDescription>Entries written by clients.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            {(
              [
                ["Food", data.usage.today.foodEntries, data.usage.last7Days.foodEntries],
                ["Workouts", data.usage.today.workoutSessions, data.usage.last7Days.workoutSessions],
                ["Steps", data.usage.today.stepEntries, data.usage.last7Days.stepEntries],
              ] as const
            ).map(([label, today, week]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="tabular-nums">{today} today</p>
                <p className="text-xs text-muted-foreground tabular-nums">{week} in 7 days</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Errors</CardTitle>
            <CardDescription>Server faults and failed food source calls.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tabular-nums">{data.errorsLast24h}</p>
            <p className="text-xs text-muted-foreground">in the last 24 hours</p>
            <Link to="/admin/errors" className="mt-2 inline-block text-sm underline">
              See the error list
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
