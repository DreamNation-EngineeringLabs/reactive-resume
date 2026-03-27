import type { Icon as IconType } from "@phosphor-icons/react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/utils/style";

type Props = {
	title: string;
	icon: IconType;
	className?: string;
	children?: React.ReactNode;
};

export function DashboardHeader({ title, icon: IconComponent, className, children }: Props) {
	return (
		<div className={cn("flex items-center justify-between gap-x-4", className)}>
			<div className="flex items-center gap-x-3">
				<SidebarTrigger className="shrink-0 md:hidden" />
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
					<IconComponent weight="duotone" className="size-5" />
				</div>
				<h1 className="font-semibold text-xl tracking-tight text-slate-900">{title}</h1>
			</div>
			{children && <div className="flex items-center gap-x-2">{children}</div>}
		</div>
	);
}
