import { Link, Outlet } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/coaches", label: "Coaches" },
  { to: "/admin/errors", label: "Errors" },
  { to: "/admin/audit", label: "Audit log" },
  { to: "/admin/system", label: "System" },
] as const;

export function AdminLayout() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Accounts and aggregates only. Clients' food, workouts and bodyweight stay private.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-2">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: tab.to === "/admin" }}
            className={cn("rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent")}
            activeProps={{ className: "bg-accent font-medium text-foreground" }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
