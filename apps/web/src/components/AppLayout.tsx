import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useLogout, useMe } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINK_CLASS = "text-sm text-muted-foreground hover:text-foreground";

export function AppLayout() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const role = me.data?.user.role;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link to="/" className="font-semibold tracking-tight">
            Hybredmusa
          </Link>

          <nav className="flex items-center gap-4">
            {role === "client" && (
              <Link
                to="/workouts"
                className={cn(LINK_CLASS)}
                activeProps={{ className: "text-sm font-medium text-foreground" }}
              >
                Workouts
              </Link>
            )}
            {role === "client" && (
              <Link
                to="/diary"
                className={cn(LINK_CLASS)}
                activeProps={{ className: "text-sm font-medium text-foreground" }}
              >
                Diary
              </Link>
            )}
            {role === "client" && (
              <Link
                to="/metrics"
                className={cn(LINK_CLASS)}
                activeProps={{ className: "text-sm font-medium text-foreground" }}
              >
                Steps
              </Link>
            )}
            {role === "coach" && (
              <Link
                to="/coach/clients"
                className={cn(LINK_CLASS)}
                activeProps={{ className: "text-sm font-medium text-foreground" }}
              >
                Clients
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {me.data && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {me.data.user.name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Sign out"
              disabled={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, { onSuccess: () => navigate({ to: "/login" }) })
              }
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
