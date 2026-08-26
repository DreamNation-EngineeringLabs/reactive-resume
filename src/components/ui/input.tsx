import type * as React from "react";
import { cn } from "@/utils/style";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				// `text-base md:text-sm`: iOS Safari force-zooms the viewport when a focused input renders
				// below 16px and never zooms back out, so every tap on a field left the page magnified.
				// 16px on mobile, 14px from md up. Same pattern textarea.tsx already uses.
				// `h-11` on mobile meets the 44px minimum tap target; h-10 from md up keeps desktop density.
				"h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow,background-color] duration-200 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground hover:bg-secondary/40 focus-visible:border-ring focus-visible:bg-secondary/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:h-10 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
