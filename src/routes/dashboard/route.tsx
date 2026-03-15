import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getSourceUrl } from "@/utils/source-url";
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
		const mainAppUrl = getSourceUrl();

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
		<div className="flex h-screen bg-sidebar">
			<SidebarProvider open={sidebarState} onOpenChange={handleSidebarOpenChange}>
				<DashboardSidebar />

				<div className="flex flex-1 flex-col overflow-hidden p-2 ps-0">
					<main className="@container flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 md:p-6">
						<div className="mx-auto h-full w-full max-w-400">
							<Outlet />
						</div>
					</main>
				</div>
			</SidebarProvider>
		</div>
	);
}
