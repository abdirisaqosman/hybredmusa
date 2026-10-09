import { Outlet } from "@tanstack/react-router";

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <span className="font-semibold tracking-tight">Hybredmusa</span>
          <span className="ml-2 text-xs text-muted-foreground">
            coach and client fitness tracker
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
