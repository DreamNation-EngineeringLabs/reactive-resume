import { cn } from "@/utils/style";

type BaseCardProps = React.ComponentProps<"div"> & {
	title: string;
	description: string;
	tags?: string[];
	headerColor?: string;
	accentColor?: string;
	aspectRatio?: string;
	className?: string;
	children?: React.ReactNode;
};

export function BaseCard({
	title,
	description,
	tags,
	headerColor = "bg-slate-700",
	accentColor = "text-slate-700",
	aspectRatio = "aspect-[3/4]",
	className,
	children,
	...props
}: BaseCardProps) {
	return (
		<div
			{...props}
			className={cn(
				"group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]",
				className,
			)}
		>
			{/* Preview Content */}
			<div className={cn("relative w-full flex-1 overflow-hidden bg-slate-50", aspectRatio)}>{children}</div>

			{/* Decorative Background Icon */}
			<div className={cn("pointer-events-none absolute -right-4 -bottom-4 size-24 rotate-12 opacity-5", accentColor)}>
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
				</svg>
			</div>

			{/* Footer with Name and Description */}
			<div className="border-t border-slate-100 px-5 py-3">
				<h4 className="truncate font-semibold text-slate-900 text-sm">{title}</h4>
				<p className="mt-1 text-slate-400 text-xs">{description}</p>
			</div>

			{/* Tags (if any) */}
			{tags && tags.length > 0 && (
				<div className="flex flex-wrap gap-1 border-t border-slate-100 bg-slate-50 px-4 py-2">
					{tags.map((tag) => (
						<span key={tag} className="rounded-lg bg-slate-200 px-2 py-0.5 text-slate-600 text-xs font-medium">
							{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
