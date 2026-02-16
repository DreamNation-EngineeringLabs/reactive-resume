import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/style";

type BaseCardProps = React.ComponentProps<"div"> & {
	title: string;
	description: string;
	tags?: string[];
	className?: string;
	children?: React.ReactNode;
};

export function BaseCard({ title, description, tags, className, children, ...props }: BaseCardProps) {
	return (
		<div
			{...props}
			className={cn(
				"relative flex aspect-page size-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md",
				className,
			)}
		>
			<div className="relative flex-1 overflow-hidden rounded-lg bg-slate-50">
				{children}
			</div>

			<div className="mt-3 flex w-full flex-col space-y-1">
				<h3 className="truncate font-bold text-base text-slate-900">{title}</h3>
				<p className="truncate text-xs text-slate-500">{description}</p>

				<div className={cn("mt-2 hidden flex-wrap items-center gap-1", tags && tags.length > 0 && "flex")}>
					{tags?.map((tag) => (
						<Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100">
							{tag}
						</Badge>
					))}
				</div>
			</div>
		</div>
	);
}
