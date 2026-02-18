import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
	ArrowLeftIcon,
	ReadCvLogoIcon,
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
import { env } from "@/utils/env";
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
	const mainAppUrl = env.VITE_MAIN_APP_URL ?? "http://localhost:3000";
	const isCollapsed = state === "collapsed";

	return (
		<Sidebar variant="sidebar" collapsible="icon">
			<SidebarHeader className="pb-0">
				<div className="flex justify-between items-center px-1 gap-2 pt-1">
					<a href={`${mainAppUrl}/placements`} className={isCollapsed ? "hidden" : ""}>
						<img
							className="w-48 my-4"
							alt="Brand Logo"
							src="/images/polymath_with_logo.png"
							style={{ objectFit: "contain" }}
						/>
					</a>
				</div>
				{!isCollapsed && (
					<p className="text-sm font-semibold text-sidebar-foreground/70 tracking-wide ml-3 mt-1">Menu</p>
				)}
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel className={isCollapsed ? "" : "sr-only"}>
						App
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarItemList items={appSidebarItems} />
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild title="Back to App">
									<a href={`${mainAppUrl}/placements`}>
										<ArrowLeftIcon />
										<span className="shrink-0 font-medium text-sm transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
											Back to App
										</span>
									</a>
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
								<SidebarMenuButton className="h-auto gap-x-3 bg-background rounded-lg group-data-[collapsible=icon]:p-1!">
									<Avatar className="size-8 shrink-0 transition-all group-data-[collapsible=icon]:size-6">
										<AvatarImage src={session.user.image ?? undefined} />
										<AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary font-semibold group-data-[collapsible=icon]:text-[0.5rem]">
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
