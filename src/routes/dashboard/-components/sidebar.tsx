import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
	ArrowLeftIcon,
	ChartBarIcon,
	ChartLineIcon,
	ChartPieIcon,
	ClipboardTextIcon,
	ReadCvLogoIcon,
	TargetIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { UserDropdownMenu } from "@/components/user/dropdown-menu";
import { getSourceUrl } from "@/utils/source-url";
import { getInitials } from "@/utils/string";
import { cn } from "@/utils/style";

type SidebarItem = {
	icon: React.ReactNode;
	label: MessageDescriptor;
	href: React.ComponentProps<typeof Link>["to"];
	iconBg: string;
	iconColor: string;
};

const appSidebarItems = [
	{
		icon: <ReadCvLogoIcon weight="duotone" />,
		label: msg`Resumes`,
		href: "/dashboard/resumes",
		iconBg: "bg-indigo-50",
		iconColor: "text-indigo-600",
	},
	{
		icon: <UserIcon weight="duotone" />,
		label: msg`My Info`,
		href: "/dashboard/info",
		iconBg: "bg-violet-50",
		iconColor: "text-violet-600",
	},
	{
		icon: <TargetIcon weight="duotone" />,
		label: msg`ATS Score`,
		href: "/dashboard/ats-score",
		iconBg: "bg-emerald-50",
		iconColor: "text-emerald-600",
	},
] as const satisfies SidebarItem[];

const dashboardSidebarItems = [
	{
		icon: <ChartLineIcon weight="duotone" />,
		label: msg`Feedback Summary`,
		href: "/dashboard/feedback",
		iconBg: "bg-sky-50",
		iconColor: "text-sky-600",
	},
	{
		icon: <ClipboardTextIcon weight="duotone" />,
		label: msg`Faculty Dashboard`,
		href: "/dashboard/faculty",
		iconBg: "bg-amber-50",
		iconColor: "text-amber-600",
	},
	{
		icon: <ChartBarIcon weight="duotone" />,
		label: msg`Admin Metrics`,
		href: "/dashboard/admin",
		iconBg: "bg-rose-50",
		iconColor: "text-rose-600",
	},
	{
		icon: <ChartPieIcon weight="duotone" />,
		label: msg`PO Dashboard`,
		href: "/dashboard/placement-officer",
		iconBg: "bg-orange-50",
		iconColor: "text-orange-600",
	},
] as const satisfies SidebarItem[];

type SidebarItemListProps = {
	items: readonly SidebarItem[];
};

function SidebarItemList({ items }: SidebarItemListProps) {
	const { i18n } = useLingui();
	const { state } = useSidebarState();
	const isCollapsed = state === "collapsed";

	return (
		<SidebarMenu>
			{items.map((item) => (
				<SidebarMenuItem key={item.href}>
					<SidebarMenuButton asChild title={i18n.t(item.label)}>
						<Link
							to={item.href}
							className="group/navitem flex items-center gap-x-3 rounded-xl px-2 py-2 transition-all hover:bg-slate-100 active:scale-[0.98]"
							activeProps={{ className: "bg-slate-100 font-semibold" }}
						>
							<div
								className={cn(
									"flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
									item.iconBg,
									item.iconColor,
								)}
							>
								{item.icon}
							</div>
							<span
								className={cn(
									"shrink-0 text-sm text-slate-700 transition-[margin,opacity] duration-200 ease-in-out",
									isCollapsed && "-ms-8 opacity-0",
								)}
							>
								{i18n.t(item.label)}
							</span>
						</Link>
					</SidebarMenuButton>
				</SidebarMenuItem>
			))}
		</SidebarMenu>
	);
}

export function DashboardSidebar() {
	const { state } = useSidebarState();
	const isCollapsed = state === "collapsed";

	const handleBackClick = () => {
		const url = getSourceUrl();
		window.location.href = `${url}/placements`;
	};

	const handleLogoClick = () => {
		const url = getSourceUrl();
		window.location.href = `${url}/placements`;
	};

	return (
		<Sidebar variant="sidebar" collapsible="icon">
			<SidebarHeader className="pb-2">
				<div className="flex items-center gap-2 px-2 pt-2">
					{/* biome-ignore lint: onClick handles navigation */}
					<button type="button" onClick={handleLogoClick} className={isCollapsed ? "hidden" : ""}>
						<img
							className="my-3 w-40"
							alt="Brand Logo"
							src="/images/polymath_with_logo.png"
							style={{ objectFit: "contain" }}
						/>
					</button>
				</div>

				{!isCollapsed && (
					<p className="px-3 pb-1 font-semibold text-slate-400 text-xs uppercase tracking-widest">
						Navigation
					</p>
				)}
			</SidebarHeader>

			<SidebarContent className="gap-y-1 px-2">
				<SidebarGroup className="p-0">
					<SidebarGroupLabel
						className={cn(
							"mb-1 px-2 font-semibold text-slate-400 text-xs uppercase tracking-widest",
							isCollapsed && "sr-only",
						)}
					>
						My Space
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarItemList items={appSidebarItems} />
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup className="p-0">
					<SidebarGroupLabel
						className={cn(
							"mb-1 mt-3 px-2 font-semibold text-slate-400 text-xs uppercase tracking-widest",
							isCollapsed && "sr-only",
						)}
					>
						Dashboards
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarItemList items={dashboardSidebarItems} />
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup className="p-0 mt-auto">
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild title="Back to App">
									{/* biome-ignore lint: onClick handles navigation */}
									<button
										type="button"
										onClick={handleBackClick}
										className="flex w-full items-center gap-x-3 rounded-xl px-2 py-2 transition-all hover:bg-slate-100 active:scale-[0.98]"
									>
										<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
											<ArrowLeftIcon weight="duotone" />
										</div>
										<span
											className={cn(
												"shrink-0 text-sm text-slate-600 transition-[margin,opacity] duration-200 ease-in-out",
												isCollapsed && "-ms-8 opacity-0",
											)}
										>
											Back to App
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
						<UserDropdownMenu>
							{({ session }) => (
								<SidebarMenuButton className="h-auto gap-x-3 rounded-xl bg-slate-50 p-2 hover:bg-slate-100 group-data-[collapsible=icon]:p-1!">
									<Avatar className="size-8 shrink-0 transition-all group-data-[collapsible=icon]:size-7">
										<AvatarImage src={session.user.image ?? undefined} />
										<AvatarFallback className="rounded-xl bg-indigo-100 font-semibold text-indigo-600 text-xs group-data-[collapsible=icon]:text-[0.5rem]">
											{getInitials(session.user.name)}
										</AvatarFallback>
									</Avatar>

									<div
										className={cn(
											"min-w-0 flex-1 transition-[margin,opacity] duration-200 ease-in-out",
											isCollapsed && "-ms-8 opacity-0",
										)}
									>
										<p className="truncate font-semibold text-slate-900 text-sm">{session.user.name}</p>
										<p className="truncate text-slate-500 text-xs">{session.user.email}</p>
									</div>
								</SidebarMenuButton>
							)}
						</UserDropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
