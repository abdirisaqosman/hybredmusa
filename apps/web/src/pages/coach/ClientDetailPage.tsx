import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useCoachClients, useDiary } from "@/api/nutrition";
import { DateNav, todayIso } from "@/components/DateNav";
import { DiaryView } from "@/components/diary/DiaryView";
import { TargetForm } from "@/components/coach/TargetForm";
import { Skeleton } from "@/components/ui/skeleton";

export function CoachClientDetailPage() {
  const { clientId } = useParams({ strict: false }) as { clientId: string };
  const [date, setDate] = useState(todayIso());
  const clients = useCoachClients();
  const diary = useDiary(clientId, date);
  const client = clients.data?.items.find((c) => c.id === clientId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{client?.name ?? "Client"}</h1>
          <p className="text-sm text-muted-foreground">{client?.email}</p>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>

      <TargetForm clientId={clientId} />

      {diary.isPending && <Skeleton className="h-64 w-full" />}
      {diary.isError && <p className="text-sm text-destructive">{diary.error.message}</p>}
      {diary.data && <DiaryView diary={diary.data} canEdit={false} />}
    </div>
  );
}
