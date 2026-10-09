import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { HomePage } from "@/pages/HomePage";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
