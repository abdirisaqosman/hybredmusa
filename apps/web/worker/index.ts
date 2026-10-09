interface Env {
  API: Fetcher;
  ASSETS: Fetcher;
}

/**
 * The web Worker is a pure client. It forwards /api/* to the api Worker over
 * the service binding, so the browser only ever talks to one origin, and
 * serves the React SPA for everything else.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return env.API.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
