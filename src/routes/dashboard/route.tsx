import { useEffect } from "react";
import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { env } from "@/utils/env";
import { getDashboardSidebarServerFn, setDashboardSidebarServerFn } from "./-components/functions";
import { DashboardSidebar } from "./-components/sidebar";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
		return { session: context.session };
	},
	loader: async () => {
		const sidebarState = await getDashboardSidebarServerFn();
		return { sidebarState };
	},
});

function RouteComponent() {
	const router = useRouter();
	const { sidebarState } = Route.useLoaderData();

	const handleSidebarOpenChange = (open: boolean) => {
		setDashboardSidebarServerFn({ data: open }).then(() => {
			router.invalidate();
		});
	};

	// Handle browser back button to redirect to main app
	useEffect(() => {
		const mainAppUrl = env.VITE_MAIN_APP_URL ?? "http://localhost:3000";
		
		// Push a state to enable back button detection
		window.history.pushState({ resumeApp: true }, "");

		const handlePopState = () => {
			// If user presses back button, redirect to main app placements page
			window.location.href = `${mainAppUrl}/placements`;
		};

		window.addEventListener("popstate", handlePopState);

		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, []);

	return (
		<div className="bg-sidebar h-screen flex">
			<SidebarProvider 
				open={sidebarState} 
				onOpenChange={handleSidebarOpenChange}
			>
				<DashboardSidebar />

				<div className="flex-1 flex flex-col overflow-hidden p-2 ps-0">
					<main className="@container flex-1 overflow-y-auto bg-white rounded-lg border border-slate-200 p-2 md:p-6">
					<div className="h-full w-full mx-auto max-w-400">
						<Outlet />
						</div>
					</main>
				</div>
			</SidebarProvider>
		</div>
	);
}
