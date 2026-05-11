import type { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
	ArrowLeft,
	BarChart3,
	Building2,
	Check,
	ChevronsLeft,
	ChevronsRight,
	FileText,
	Inbox,
	LineChart,
	ListChecks,
	LogOut,
	Target,
	User,
	Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
	useSidebarState,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { authClient } from "@/integrations/auth/client";
import type { AuthSession } from "@/integrations/auth/types";
import { orpc } from "@/integrations/orpc/client";
import { dlog } from "@/utils/debug";
import { getPlacementsUrl } from "@/utils/source-url";
import { getOrganisationUnits, getTenantId, getUserRole } from "@/utils/sso-context";
import { getInitials } from "@/utils/string";
import { cn } from "@/utils/style";

type SidebarItem = {
	icon: React.ReactNode;
	label: MessageDescriptor;
	href: React.ComponentProps<typeof Link>["to"];
	search?: Record<string, string>;
	iconBg: string;
	iconColor: string;
	roles?: string[];
};

const appSidebarItems: SidebarItem[] = [
	{
		icon: <FileText strokeWidth={2} />,
		label: msg`Resumes`,
		href: "/dashboard/resumes",
		iconBg: "bg-indigo-50",
		iconColor: "text-indigo-600",
	},
	{
		icon: <User strokeWidth={2} />,
		label: msg`My Info`,
		href: "/dashboard/info",
		iconBg: "bg-violet-50",
		iconColor: "text-violet-600",
	},
	{
		icon: <Target strokeWidth={2} />,
		label: msg`ATS Analysis`,
		href: "/dashboard/ats-score",
		iconBg: "bg-emerald-50",
		iconColor: "text-emerald-600",
	},
];

const learnerSidebarItems: SidebarItem[] = [
	{
		icon: <LineChart strokeWidth={2} />,
		label: msg`Feedback Summary`,
		href: "/dashboard/feedback",
		iconBg: "bg-sky-50",
		iconColor: "text-sky-600",
	},
];

function staffDashboardItems(role: string): SidebarItem[] {
	const baseHref =
		role === "INSTRUCTOR"
			? "/dashboard/faculty"
			: role === "PLACEMENT_OFFICER"
				? "/dashboard/placement-officer"
				: "/dashboard/admin";

	const items: SidebarItem[] = [
		{
			icon: <BarChart3 strokeWidth={2} />,
			label: msg`Overview`,
			href: baseHref,
			search: { tab: "overview" },
			iconBg: "bg-indigo-50",
			iconColor: "text-indigo-600",
		},
	];

	// Faculty and Placement Officer get a dedicated Inbox
	if (role === "INSTRUCTOR" || role === "PLACEMENT_OFFICER") {
		items.push({
			icon: <Inbox strokeWidth={2} />,
			label: msg`Inbox`,
			href: baseHref,
			search: { tab: "inbox" },
			iconBg: "bg-rose-50",
			iconColor: "text-rose-600",
		});
	}

	items.push(
		{
			icon: <Building2 strokeWidth={2} />,
			label: msg`Sections`,
			href: baseHref,
			search: { tab: "sections" },
			iconBg: "bg-blue-50",
			iconColor: "text-blue-600",
		},
		{
			icon: <Users strokeWidth={2} />,
			label: msg`Students`,
			href: baseHref,
			search: { tab: "students" },
			iconBg: "bg-violet-50",
			iconColor: "text-violet-600",
		},
		{
			icon: <ListChecks strokeWidth={2} />,
			label: msg`Checklists`,
			href: baseHref,
			search: { tab: "checklists" },
			iconBg: "bg-amber-50",
			iconColor: "text-amber-600",
		},
	);

	return items;
}

type SidebarItemListProps = {
	items: SidebarItem[];
};

function SidebarItemList({ items }: SidebarItemListProps) {
	return (
		<SidebarMenu>
			{items.map((item) => (
				<SidebarItemRow key={`${item.href as string}-${item.search?.tab ?? ""}`} item={item} />
			))}
		</SidebarMenu>
	);
}

function SidebarItemRow({ item }: { item: SidebarItem }) {
	const { i18n } = useLingui();
	const { state } = useSidebarState();
	const isCollapsed = state === "collapsed";
	const routerState = useRouterState();

	const isPathMatch = routerState.location.pathname.startsWith(item.href as string);
	const itemTab = item.search?.tab;
	const currentTab = (routerState.location.search as any)?.tab;
	const isActive = itemTab ? isPathMatch && itemTab === currentTab : isPathMatch;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				title={i18n.t(item.label)}
				className={cn(
					"h-11",
					isActive &&
						"bg-primary font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 focus-visible:bg-primary/90",
				)}
			>
				<Link
					to={item.href}
					// biome-ignore lint: search params vary per route
					search={item.search as any}
					className="group/navitem tap-active flex items-center gap-x-3 rounded-xl px-2 py-2 outline-none transition-all duration-300 active:scale-[0.98]"
				>
					<div
						className={cn(
							"flex shrink-0 items-center justify-center transition-all duration-300",
							"group-active/navitem:scale-90",
							!isCollapsed &&
								cn("h-9 w-9 rounded-xl", item.iconBg, item.iconColor, isActive && "bg-white/20 text-white"),
							isCollapsed && cn("size-4", isActive ? item.iconColor : "text-slate-400"),
						)}
					>
						<div className={cn(isCollapsed ? "size-full" : "size-5", "[&_svg]:size-full")}>{item.icon}</div>
					</div>

					<span
						className={cn(
							"shrink-0 font-medium text-sm transition-[margin,opacity] duration-300 ease-in-out",
							isCollapsed && "sr-only",
							isActive ? "font-bold text-white" : "text-slate-600",
						)}
					>
						{i18n.t(item.label)}
					</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function OrgUnitSwitcher({
	activeUnitId,
	onUnitChange,
}: {
	activeUnitId: string | null;
	onUnitChange: (unitId: string) => void;
}) {
	const role = getUserRole();
	const orgUnits = getOrganisationUnits();
	const tenantId = getTenantId();

	// Hide for students - they don't need to switch sections
	if (role === "LEARNER") return null;

	// For PO/Admin, fetch all sections from DB
	const shouldFetchAll = role === "PLACEMENT_OFFICER" || role === "ADMIN";
	const { data: sectionsData } = useQuery(
		orpc.resume.dashboard.sectionsList.queryOptions({
			input: {
				sectionIds: shouldFetchAll ? undefined : orgUnits.length > 0 ? orgUnits : undefined,
				tenantId: tenantId ?? "default",
			},
		}),
	);

	const sections = sectionsData?.sections ?? [];

	// Group sections by package
	const groupedSections = useMemo(() => {
		const groups: Record<string, { id: string; name: string; sections: typeof sections }> = {};

		for (const section of sections) {
			const pkgName = section.packageName || t`General`;
			const pkgId = section.packageId || "general";
			if (!groups[pkgId]) groups[pkgId] = { id: pkgId, name: pkgName, sections: [] };
			groups[pkgId].sections.push(section);
		}

		return Object.values(groups);
	}, [sections]);

	if (sections.length === 0) return null;

	return (
		<div className="space-y-3 py-2">
			<div className="px-2">
				<p className="font-semibold text-[10px] text-slate-400 uppercase tracking-widest">{t`Entity`}</p>
			</div>
			<div className="space-y-1">
				{groupedSections.map((group) => (
					<div key={group.id} className="space-y-1">
						{group.sections.map((section) => (
							<button
								key={section.id}
								type="button"
								onClick={() => onUnitChange(section.id)}
								className={cn(
									"group tap-active flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-300",
									activeUnitId === section.id
										? "bg-primary font-bold text-white shadow-md shadow-primary/20"
										: "text-slate-600 hover:bg-white/50",
								)}
							>
								<div className="flex items-center gap-3">
									<Building2
										strokeWidth={2}
										className={cn("size-4", activeUnitId === section.id ? "text-white" : "text-slate-400")}
									/>
									<span className="truncate">{section.name}</span>
								</div>
								{activeUnitId === section.id && (
									<div className="rounded-full bg-white/20 p-0.5">
										<Check strokeWidth={3} className="size-3 text-white" />
									</div>
								)}
							</button>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

export function DashboardSidebar() {
	const { state, toggleSidebar } = useSidebarState();
	const isCollapsed = state === "collapsed";
	const isMobile = useIsMobile();
	// Read the session from router context (populated by root beforeLoad via server-side getSession).
	// Better Auth's client `useSession()` hits /resume/api/auth/get-session, which can return null behind
	// Firebase Hosting → Cloud Run when cookies don't ride along on that path — that's why the profile
	// card was disappearing in deployed envs even though SSR had a valid session.
	const { session } = useRouteContext({ strict: false }) as { session: AuthSession | null };

	const handleLogout = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					window.location.reload();
				},
			},
		});
	};

	// Read role from localStorage after hydration (avoids SSR mismatch)
	const [role, setRole] = useState<string | null>(null);
	useEffect(() => {
		const r = getUserRole();
		setRole(r ? r.toUpperCase() : null);
		dlog("sidebar", "role:hydrated-from-localstorage", { role: r ?? null });
	}, []);

	dlog("sidebar", "render", {
		hasSession: !!session?.user,
		userEmail: session?.user?.email ?? null,
		role,
		isCollapsed,
		isMobile,
	});

	// Build dashboard nav items based on role
	const filteredDashboardItems = useMemo(() => {
		if (!role) return [];
		if (role === "LEARNER") return learnerSidebarItems;
		if (role === "INSTRUCTOR" || role === "PLACEMENT_OFFICER" || role === "ADMIN") return staffDashboardItems(role);
		return [];
	}, [role]);

	const handleBackClick = () => {
		window.location.href = getPlacementsUrl();
	};

	const handleLogoClick = () => {
		window.location.href = getPlacementsUrl();
	};

	const showMySpace = role === "LEARNER" || !role;

	return (
		<Sidebar variant="sidebar" collapsible="icon">
			<SidebarHeader className="pb-2">
				<div className={cn("flex items-center gap-2 px-2 pt-2", isCollapsed ? "justify-center" : "justify-between")}>
					<button type="button" onClick={handleLogoClick} className={isCollapsed ? "hidden" : ""}>
						<img
							className="my-3 w-40"
							alt="Brand Logo"
							src={`${import.meta.env.BASE_URL}images/polymath_with_logo.png`}
							style={{ objectFit: "contain" }}
						/>
					</button>
					<button
						type="button"
						onClick={toggleSidebar}
						title={isCollapsed ? t`Expand sidebar` : t`Collapse sidebar`}
						aria-label={isCollapsed ? t`Expand sidebar` : t`Collapse sidebar`}
						className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white/70 text-slate-500 shadow-sm transition-colors hover:border-primary/30 hover:bg-white hover:text-primary"
					>
						{isCollapsed ? (
							<ChevronsRight strokeWidth={2} className="size-4" />
						) : (
							<ChevronsLeft strokeWidth={2} className="size-4" />
						)}
					</button>
				</div>
			</SidebarHeader>

			<SidebarContent className="gap-y-1 px-2">
				{showMySpace && (
					<SidebarGroup className="p-0">
						<SidebarGroupLabel
							className={cn(
								"mb-1 px-2 font-semibold text-slate-400 text-xs uppercase tracking-widest",
								isCollapsed && "sr-only",
							)}
						>
							{t`My Space`}
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarItemList items={appSidebarItems} />
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				{filteredDashboardItems.length > 0 && (
					<SidebarGroup className="p-0">
						<SidebarGroupLabel
							className={cn(
								"mb-1 px-2 font-semibold text-slate-400 text-xs uppercase tracking-widest",
								isCollapsed && "sr-only",
							)}
						>
							{t`Menu`}
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarItemList items={filteredDashboardItems} />
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				<SidebarGroup className="mt-auto p-0">
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild title={t`Back to App`}>
									<button
										type="button"
										onClick={handleBackClick}
										className="tap-active flex w-full items-center gap-x-3 rounded-xl px-2 py-2 transition-all duration-300 hover:bg-white/50 active:scale-[0.98]"
									>
										<div
											className={cn(
												"flex shrink-0 items-center justify-center transition-all duration-200",
												isCollapsed ? "size-4 text-slate-400" : "h-8 w-8 rounded-xl bg-primary/10 text-primary",
											)}
										>
											<ArrowLeft strokeWidth={2} className={isCollapsed ? "size-full" : "size-4"} />
										</div>
										<span
											className={cn(
												"shrink-0 font-medium text-slate-700 text-sm transition-[margin,opacity] duration-300 ease-in-out",
												isCollapsed && "sr-only",
											)}
										>
											{t`Back to App`}
										</span>
									</button>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarSeparator className="mx-2" />

			<SidebarFooter className="px-2 pb-3">
				<SidebarMenu>
					<SidebarMenuItem>
						{session?.user && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton className="tap-active h-auto gap-x-3 rounded-xl border border-black/5 bg-white/50 p-2 transition-all duration-300 hover:bg-white group-data-[collapsible=icon]:p-1!">
										<Avatar className="size-8 shrink-0 transition-all group-data-[collapsible=icon]:size-7">
											<AvatarImage src={session.user.image ?? undefined} />
											<AvatarFallback className="rounded-xl bg-primary/10 font-bold text-primary text-xs group-data-[collapsible=icon]:text-[0.5rem]">
												{getInitials(session.user.name)}
											</AvatarFallback>
										</Avatar>

										<div
											className={cn(
												"min-w-0 flex-1 text-left transition-[margin,opacity] duration-300 ease-in-out",
												isCollapsed && "-ms-8 opacity-0",
											)}
										>
											<p className="truncate font-bold text-slate-900 text-sm">{session.user.name}</p>
											<p className="truncate text-slate-500 text-xs">{session.user.email}</p>
										</div>
									</SidebarMenuButton>
								</DropdownMenuTrigger>

								<DropdownMenuContent
									className="w-80 overflow-hidden rounded-2xl p-0 shadow-2xl shadow-indigo-100/50"
									side={isMobile ? "bottom" : "right"}
									align="end"
									sideOffset={4}
								>
									<div className="border-slate-100 border-b p-4">
										<div className="flex items-center gap-3 text-left">
											<Avatar className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600">
												<AvatarImage src={session.user.image ?? undefined} alt={session.user.name} />
												<AvatarFallback className="rounded-xl font-bold">
													{getInitials(session.user.name)}
												</AvatarFallback>
											</Avatar>
											<div className="grid flex-1 leading-tight">
												<span className="truncate font-bold text-slate-900">{session.user.name}</span>
												<span className="truncate text-slate-400 text-xs">{session.user.email}</span>
											</div>
										</div>
									</div>

									<div className="border-slate-100 border-b p-2">
										<OrgUnitSwitcher activeUnitId={getOrganisationUnits()[0] ?? null} onUnitChange={() => {}} />
									</div>

									<div className="p-2">
										<DropdownMenuItem
											onClick={handleLogout}
											className="flex cursor-pointer items-center gap-3 rounded-xl py-2.5 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:bg-rose-50 focus:text-rose-600"
										>
											<LogOut strokeWidth={2} className="size-4" />
											<span className="font-semibold">{t`Logout`}</span>
										</DropdownMenuItem>
									</div>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
