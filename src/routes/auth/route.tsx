import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { BrandIcon } from "@/components/ui/brand-icon";
import { AuthLayoutContext } from "./-components/auth-layout-context";

export const Route = createFileRoute("/auth")({
	component: RouteComponent,
});

function RouteComponent() {
	const [isChildLoading, setIsChildLoading] = useState(true);

	return (
		<AuthLayoutContext.Provider value={{ setIsChildLoading }}>
			{isChildLoading && <LoadingScreen />}
			<div
				className="mx-auto flex h-svh w-dvw max-w-sm flex-col justify-center space-y-6 px-4 xs:px-0"
				style={isChildLoading ? { visibility: "hidden", position: "absolute" } : undefined}
			>
				<BrandIcon className="mb-4 size-20 self-center" />
				<Outlet />
			</div>
		</AuthLayoutContext.Provider>
	);
}
