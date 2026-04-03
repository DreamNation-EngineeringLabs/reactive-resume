import { cn } from "@/utils/style";

type BaseCardProps = React.ComponentProps<"div"> & {
	title: string;
	description: string;
	tags?: string[];
	headerColor?: string;
	accentColor?: string;
	aspectRatio?: string;
	customBg?: string;
	className?: string;
	children?: React.ReactNode;
};

export function BaseCard({
	title,
	description,
	tags,
	headerColor = "bg-primary",
	accentColor = "text-primary",
	aspectRatio = "aspect-[4/5]",
	customBg = "bg-slate-50/50",
	className,
	children,
	...props
}: BaseCardProps) {
	return (
		<div
			{...props}
			className={cn(
				"group tap-active relative flex flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
				className,
			)}
		>
			{/* Preview Content */}
			<div className={cn("relative w-full flex-1 overflow-hidden", aspectRatio, customBg)}>{children}</div>

			{/* Decorative Background Icon */}
			<div
				className={cn(
					"pointer-events-none absolute -right-6 -bottom-6 size-40 rotate-12 opacity-5 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110",
					accentColor,
				)}
			>
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
				</svg>
			</div>

			{/* Footer with Name and Description */}
			<div className="mt-auto border-border border-t p-6">
				<h4 className="mb-1 line-clamp-1 font-black text-lg text-slate-900 tracking-tight">{title}</h4>
				<p className="line-clamp-2 font-medium text-slate-500 text-sm leading-relaxed">{description}</p>
			</div>

			{/* Tags (if any) */}
			{tags && tags.length > 0 && (
				<div className="flex flex-wrap gap-1.5 border-border border-t bg-slate-50/50 px-6 py-4">
					{tags.map((tag) => (
						<span
							key={tag}
							className="rounded-lg bg-primary/10 px-2.5 py-1 font-bold text-[10px] text-primary uppercase tracking-wider"
						>
							{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
