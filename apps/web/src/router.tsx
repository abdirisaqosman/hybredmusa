import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { ensureMe } from "@/api/auth";
import { AppLayout } from "@/components/AppLayout";
import { AuthLayout } from "@/components/AuthLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { DiaryPage } from "@/pages/DiaryPage";
import { LoginPage } from "@/pages/LoginPage";
import { MetricsPage } from "@/pages/MetricsPage";
import { SessionPage } from "@/pages/SessionPage";
import { SignupPage } from "@/pages/SignupPage";
import { WorkoutsPage } from "@/pages/WorkoutsPage";
import { CoachClientDetailPage } from "@/pages/coach/ClientDetailPage";
import { CoachClientsPage } from "@/pages/coach/ClientsPage";
import { AdminAuditPage } from "@/pages/admin/AuditPage";
import { AdminCoachesPage } from "@/pages/admin/CoachesPage";
import { AdminErrorsPage } from "@/pages/admin/ErrorsPage";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminOverviewPage } from "@/pages/admin/OverviewPage";
import { AdminSystemPage } from "@/pages/admin/SystemPage";
import { AdminUserDetailPage } from "@/pages/admin/UserDetailPage";
import { AdminUsersPage } from "@/pages/admin/UsersPage";

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

/** Signed out area. Anyone already signed in is sent to the dashboard. */
const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public",
  component: AuthLayout,
  beforeLoad: async ({ context }) => {
    if (await ensureMe(context.queryClient)) throw redirect({ to: "/" });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/login",
  component: LoginPage,
});

const signupRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/signup",
  component: SignupPage,
});

/** Everything behind a session. The API enforces this too. */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authed",
  component: AppLayout,
  beforeLoad: async ({ context, location }) => {
    const me = await ensureMe(context.queryClient);
    if (!me) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { me };
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/",
  component: DashboardPage,
});

const diaryRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/diary",
  component: DiaryPage,
  beforeLoad: ({ context: { me } }) => {
    if (me?.user.role !== "client") throw redirect({ to: "/" });
  },
});

const workoutsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/workouts",
  component: WorkoutsPage,
  beforeLoad: ({ context: { me } }) => {
    if (me?.user.role !== "client") throw redirect({ to: "/" });
  },
});

const sessionRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/workouts/$sessionId",
  component: SessionPage,
});

const metricsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/metrics",
  component: MetricsPage,
  beforeLoad: ({ context: { me } }) => {
    if (me?.user.role !== "client") throw redirect({ to: "/" });
  },
});

const coachClientsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/coach/clients",
  component: CoachClientsPage,
  beforeLoad: ({ context: { me } }) => {
    if (me?.user.role !== "coach") throw redirect({ to: "/" });
  },
});

const coachClientDetailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/coach/clients/$clientId",
  component: CoachClientDetailPage,
  beforeLoad: ({ context: { me } }) => {
    if (me?.user.role !== "coach") throw redirect({ to: "/" });
  },
});

/** The API refuses admin routes for everyone else. This only hides the pages. */
const adminRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/admin",
  component: AdminLayout,
  beforeLoad: ({ context: { me } }) => {
    if (me?.user.role !== "admin") throw redirect({ to: "/" });
  },
});

const adminOverviewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: AdminOverviewPage,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/users",
  component: AdminUsersPage,
});

const adminUserDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/users/$userId",
  component: AdminUserDetailPage,
});

const adminCoachesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/coaches",
  component: AdminCoachesPage,
});

const adminErrorsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/errors",
  component: AdminErrorsPage,
});

const adminAuditRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/audit",
  component: AdminAuditPage,
});

const adminSystemRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/system",
  component: AdminSystemPage,
});

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([loginRoute, signupRoute]),
  authedRoute.addChildren([
    dashboardRoute,
    diaryRoute,
    workoutsRoute,
    sessionRoute,
    metricsRoute,
    coachClientsRoute,
    coachClientDetailRoute,
    adminRoute.addChildren([
      adminOverviewRoute,
      adminUsersRoute,
      adminUserDetailRoute,
      adminCoachesRoute,
      adminErrorsRoute,
      adminAuditRoute,
      adminSystemRoute,
    ]),
  ]),
]);

export function buildRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}
