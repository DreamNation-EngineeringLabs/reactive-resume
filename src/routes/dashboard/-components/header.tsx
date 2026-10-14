import type { Icon as IconType } from "@phosphor-icons/react";
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
		<div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-3", className)}>
			<div className="flex items-center gap-x-4">
				{/* The mobile sidebar trigger moved to the dashboard layout (routes/dashboard/route.tsx).
				    It lived here, but this header is opt-in per page and the student-facing pages never
				    rendered it — leaving the sidebar unreachable on mobile. Keeping a copy here as well
				    would show two triggers on the pages that do render a header. */}
				{IconComponent && (
					<div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm">
						<IconComponent weight="duotone" className="size-6" />
					</div>
				)}
				<div className="flex flex-col">
					<h1 className="font-bold text-3xl text-foreground tracking-tight">{title}</h1>
					{description && <p className="mt-0.5 text-muted-foreground text-sm">{description}</p>}
				</div>
			</div>
			{children && <div className="flex items-center gap-x-2">{children}</div>}
		</div>
	);
}
