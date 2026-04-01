import type { Icon as IconType } from "@phosphor-icons/react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/utils/style";

type Props = {
	title: string;
	description?: string;
	icon?: IconType;
	className?: string;
	children?: React.ReactNode;
};

export function DashboardHeader({ title, description, icon: IconComponent, className, children }: Props) {
	return (
		<div className={cn("flex items-center justify-between gap-x-4", className)}>
			<div className="flex items-center gap-x-3">
				<SidebarTrigger className="shrink-0 md:hidden" />
				{IconComponent && (
					<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<IconComponent weight="duotone" className="size-6" />
					</div>
				)}
				<div className="flex flex-col">
					<h1 className="font-black text-slate-900 text-3xl tracking-tight">{title}</h1>
					{description && <p className="text-slate-500 font-medium text-sm mt-1">{description}</p>}
				</div>
			</div>
			{children && <div className="flex items-center gap-x-2">{children}</div>}
		</div>
	);
}
