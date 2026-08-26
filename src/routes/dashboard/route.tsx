import { Trans } from "@lingui/react/macro";
import { createFileRoute, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { dlog } from "@/utils/debug";
import { getPlacementsUrl, redirectToPlacements } from "@/utils/source-url";
import { getDashboardSidebarServerFn, setDashboardSidebarServerFn } from "./-components/functions";
import { DashboardSidebar } from "./-components/sidebar";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		dlog("route:dashboard", "beforeLoad:start", {
			hasSession: !!context.session,
			userEmail: context.session?.user?.email ?? null,
			ssoOnly: context.flags?.ssoOnly ?? false,
		});
		if (!context.session) {
			dlog("route:dashboard", "beforeLoad:no-session:redirect", {
				ssoOnly: context.flags?.ssoOnly ?? false,
			});
			// In SSO-only mode, redirect back to the main application instead of the login page
			if (context.flags.ssoOnly) {
				redirectToPlacements();
			}
			throw redirect({ to: "/auth/login", replace: true });
		}
		dlog("route:dashboard", "beforeLoad:session-ok", { userEmail: context.session.user.email });
		return { session: context.session };
	},
	loader: async () => {
		const sidebarState = await getDashboardSidebarServerFn();
		dlog("route:dashboard", "loader:sidebar-cookie", { sidebarState });
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

	dlog("route:dashboard", "render", {
		pathname: location.pathname,
		search: location.search,
		isReviewPage,
		sidebarState,
	});

	// Optimistic local state: UI flips instantly on toggle; cookie + loader catch up in the background.
	// Without this, the controlled `open` prop waits for setDashboardSidebarServerFn → router.invalidate() →
	// loader re-run — a multi-hundred-ms round-trip behind Firebase Hosting → Cloud Run that makes the
	// toggle button feel broken.
	const [openOptimistic, setOpenOptimistic] = useState(sidebarState);

	useEffect(() => {
		setOpenOptimistic(sidebarState);
	}, [sidebarState]);

	const handleSidebarOpenChange = (open: boolean) => {
		setOpenOptimistic(open);
		setDashboardSidebarServerFn({ data: open }).then(() => {
			router.invalidate();
		});
	};

	useEffect(() => {
		const placementsUrl = getPlacementsUrl();
		window.history.pushState({ resumeApp: true }, "");
		const handlePopState = () => {
			window.location.href = placementsUrl;
		};
		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, []);

	return (
		<div className="flex h-screen bg-background">
			<SidebarProvider open={isReviewPage ? false : openOptimistic} onOpenChange={handleSidebarOpenChange}>
				<DashboardSidebar />

				<div className="flex flex-1 flex-col overflow-hidden p-0">
					{/*
						Mobile-only app bar. This is the ONLY way to reach the sidebar on a phone, so it has
						to live in the layout rather than in DashboardHeader.

						DashboardHeader is rendered per-page, and the three pages a student actually uses —
						resumes, info, ats-score — never rendered it. On mobile the sidebar is an off-canvas
						Sheet, so with no trigger anywhere on the landing page, My Info, ATS Analysis and
						Feedback Summary were completely unreachable: no menu button and no links to them.

						Kept on review pages too. `SidebarProvider open` only drives the desktop column; the
						mobile Sheet has its own `openMobile` state, so forcing `open={false}` for review
						mode does not disable this.
					*/}
					<div className="flex h-14 flex-none items-center gap-2 border-b bg-background px-2 md:hidden">
						<SidebarTrigger className="size-11" />
						<span className="truncate font-semibold text-sm">
							<Trans>Resume Builder</Trans>
						</span>
					</div>

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
