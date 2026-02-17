import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin, RequestHeadersPlugin, StrictGetMethodPlugin } from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/react-router";
import router from "@/integrations/orpc/router";
import { getLocale } from "@/utils/locale";

const rpcHandler = new RPCHandler(router, {
	plugins: [new BatchHandlerPlugin(), new RequestHeadersPlugin(), new StrictGetMethodPlugin()],
	interceptors: [
		onError((error) => {
			console.error(`ERROR [oRPC]: ${error}`);
		}),
	],
});

async function handler({ request }: { request: Request }) {
	console.log("[RPC Handler] Step 4: Request received", request.method, request.url);
	
	const { response } = await rpcHandler.handle(request, {
		prefix: "/api/rpc",
		context: { locale: await getLocale() },
	});

	if (!response) {
		console.log("[RPC Handler] No response, returning 404");
		return new Response("NOT_FOUND", { status: 404 });
	}

	console.log("[RPC Handler] Response ready, status:", response.status);
	return response;
}

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			ANY: handler,
		},
	},
});
