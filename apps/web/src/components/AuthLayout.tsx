import { Outlet } from "@tanstack/react-router";

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-10 text-foreground">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">Hybredmusa</h1>
        <p className="text-sm text-muted-foreground">Coach and client fitness tracker</p>
      </div>
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  );
}
