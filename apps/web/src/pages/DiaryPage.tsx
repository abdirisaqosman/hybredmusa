import { useState } from "react";
import { useMe } from "@/api/auth";
import { useDiary } from "@/api/nutrition";
import { DateNav, todayIso } from "@/components/DateNav";
import { DiaryView } from "@/components/diary/DiaryView";
import { Skeleton } from "@/components/ui/skeleton";

export function DiaryPage() {
  const me = useMe();
  const [date, setDate] = useState(todayIso());
  const clientId = me.data?.user.id ?? "";
  const diary = useDiary(clientId, date);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Diary</h1>
        <DateNav date={date} onChange={setDate} />
      </div>

      {diary.isPending && <Skeleton className="h-64 w-full" />}
      {diary.isError && <p className="text-sm text-destructive">{diary.error.message}</p>}
      {diary.data && <DiaryView diary={diary.data} canEdit />}
    </div>
  );
}
