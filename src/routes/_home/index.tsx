import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_home/")({
	component: RouteComponent,
});

function RouteComponent() {
	useEffect(() => {
		window.location.href = "https://polymathai.co";
	}, []);

	return (
		<div className="flex h-screen items-center justify-center">
			<div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
		</div>
	);
}
