import { createFileRoute, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getSourceUrl } from "@/utils/source-url";
import { getDashboardSidebarServerFn, setDashboardSidebarServerFn } from "./-components/functions";
import { DashboardSidebar } from "./-components/sidebar";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		if (!context.session) {
			// In SSO-only mode, redirect back to the main application instead of the login page
			if (context.flags.ssoOnly) {
				throw redirect({
					href: `${process.env.VITE_MAIN_APP_URL ?? "http://localhost:3000"}/placements`,
					replace: true,
				});
			}
			throw redirect({ to: "/auth/login", replace: true });
		}
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
	const { location } = useRouterState();

	// Collapse sidebar automatically in review/ats-score-detail mode to maximise preview space
	const isFullBleedPage =
		location.pathname.includes("/dashboard/review/") || /\/dashboard\/ats-score\/[^/]+/.test(location.pathname);

	const isReviewPage = isFullBleedPage;

	const handleSidebarOpenChange = (open: boolean) => {
		setDashboardSidebarServerFn({ data: open }).then(() => {
			router.invalidate();
		});
	};

	useEffect(() => {
		const mainAppUrl = getSourceUrl();
		window.history.pushState({ resumeApp: true }, "");
		const handlePopState = () => {
			window.location.href = `${mainAppUrl}/placements`;
		};
		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, []);

	return (
		<div className="flex h-screen bg-background">
			<SidebarProvider open={isReviewPage ? false : sidebarState} onOpenChange={handleSidebarOpenChange}>
				<DashboardSidebar />

				<div className="flex flex-1 flex-col overflow-hidden p-0">
					<main className="@container flex-1 overflow-hidden bg-background">
						{isReviewPage ? (
							/* Review mode: full bleed, no max-width, no padding — the page handles its own layout */
							<div className="h-full w-full overflow-hidden">
								<Outlet />
							</div>
						) : (
							<div className="mx-auto h-full w-full max-w-[1600px] overflow-y-auto p-10 md:p-12">
								<Outlet />
							</div>
						)}
					</main>
				</div>
			</SidebarProvider>
		</div>
	);
}
