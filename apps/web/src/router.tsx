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
import { SignupPage } from "@/pages/SignupPage";
import { CoachClientDetailPage } from "@/pages/coach/ClientDetailPage";
import { CoachClientsPage } from "@/pages/coach/ClientsPage";

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

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([loginRoute, signupRoute]),
  authedRoute.addChildren([
    dashboardRoute,
    diaryRoute,
    coachClientsRoute,
    coachClientDetailRoute,
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
