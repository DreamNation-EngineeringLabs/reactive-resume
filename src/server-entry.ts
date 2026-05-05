import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { Hono } from "hono";

const ssrHandler = createStartHandler(defaultStreamHandler);

const app = new Hono();

app.use(
	"/resume/*",
	serveStatic({
		root: "./dist/client",
		rewriteRequestPath: (path) => path.replace(/^\/resume/, ""),
	}),
);

app.all("*", (c) => ssrHandler(c.req.raw));

// Only bind a port in the production bundle. In dev, Vite imports this module to get the
// fetch handler and runs its own dev server — calling serve() there would collide with Vite.
if (import.meta.env.PROD) {
	const port = Number.parseInt(process.env.PORT ?? "3000", 10);
	serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
		console.log(`Server listening on http://${info.address}:${info.port}`);
	});
}

export default app;
