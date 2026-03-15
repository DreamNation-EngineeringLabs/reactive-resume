import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { ArrowLeftIcon, ReadCvLogoIcon, TargetIcon, UserIcon } from "@phosphor-icons/react";
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

type SidebarItem = {
	icon: React.ReactNode;
	label: MessageDescriptor;
	href: React.ComponentProps<typeof Link>["to"];
};

const appSidebarItems = [
	{
		icon: <ReadCvLogoIcon />,
		label: msg`Resumes`,
		href: "/dashboard/resumes",
	},
	{
		icon: <UserIcon />,
		label: msg`My Info`,
		href: "/dashboard/info",
	},
	{
		icon: <TargetIcon />,
		label: msg`ATS Score`,
		href: "/dashboard/ats-score",
	},
] as const satisfies SidebarItem[];

type SidebarItemListProps = {
	items: readonly SidebarItem[];
};

function SidebarItemList({ items }: SidebarItemListProps) {
	const { i18n } = useLingui();

	return (
		<SidebarMenu>
			{items.map((item) => (
				<SidebarMenuItem key={item.href}>
					<SidebarMenuButton asChild title={i18n.t(item.label)}>
						<Link to={item.href} activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}>
							{item.icon}
							<span className="shrink-0 font-medium text-sm transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
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
		console.log("[Sidebar] Back to App clicked, source URL:", url);
		window.location.href = `${url}/placements`;
	};

	const handleLogoClick = () => {
		const url = getSourceUrl();
		console.log("[Sidebar] Logo clicked, source URL:", url);
		window.location.href = `${url}/placements`;
	};

	return (
		<Sidebar variant="sidebar" collapsible="icon">
			<SidebarHeader className="pb-0">
				<div className="flex items-center justify-between gap-2 px-1 pt-1">
					{/* biome-ignore lint: onClick handles navigation */}
					<button type="button" onClick={handleLogoClick} className={isCollapsed ? "hidden" : ""}>
						<img
							className="my-4 w-48"
							alt="Brand Logo"
							src="/images/polymath_with_logo.png"
							style={{ objectFit: "contain" }}
						/>
					</button>
				</div>
				{!isCollapsed && (
					<p className="mt-1 ml-3 font-semibold text-sidebar-foreground/70 text-sm tracking-wide">Menu</p>
				)}
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel className={isCollapsed ? "" : "sr-only"}>App</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarItemList items={appSidebarItems} />
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild title="Back to App">
									{/* biome-ignore lint: onClick handles navigation */}
									<button type="button" onClick={handleBackClick}>
										<ArrowLeftIcon />
										<span className="shrink-0 font-medium text-sm transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
											Back to App
										</span>
									</button>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarSeparator />

			<SidebarFooter className="gap-y-0">
				<SidebarMenu>
					<SidebarMenuItem>
						<UserDropdownMenu>
							{({ session }) => (
								<SidebarMenuButton className="h-auto gap-x-3 rounded-lg bg-background group-data-[collapsible=icon]:p-1!">
									<Avatar className="size-8 shrink-0 transition-all group-data-[collapsible=icon]:size-6">
										<AvatarImage src={session.user.image ?? undefined} />
										<AvatarFallback className="bg-sidebar-primary/10 font-semibold text-sidebar-primary group-data-[collapsible=icon]:text-[0.5rem]">
											{getInitials(session.user.name)}
										</AvatarFallback>
									</Avatar>

									<div className="transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
										<p className="font-medium text-sm">{session.user.name}</p>
										<p className="text-muted-foreground text-xs">{session.user.email}</p>
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
