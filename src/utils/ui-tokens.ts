/**
 * Shared Tailwind class fragments for app-wide UI parity.
 * Pair with `src/styles/globals.css` tokens and `UI_STYLING_GUIDE.md`.
 */
export const uiSurface = {
	/** Primary card / panel on off-white page background */
	card: "rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
	cardCompact: "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
	/** Dashed empty / error states */
	empty: "rounded-2xl border border-dashed border-border bg-muted/40 text-center",
	/** Inline stat / list row */
	inset: "rounded-xl border border-border bg-card shadow-sm",
} as const;

export const uiControl = {
	/** Primary CTA — prefer `<Button />` when possible */
	primaryButton:
		"inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm shadow-xs transition-[transform,colors,box-shadow] duration-200 hover:bg-primary/90 active:scale-[0.97]",
	/** Secondary / outline emphasis */
	outlineButton:
		"inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 font-semibold text-primary text-sm transition-[transform,colors] duration-200 hover:bg-primary/10 active:scale-[0.97]",
	/** Compact filter pill selected */
	pillSelected: "rounded-xl bg-primary px-3 py-1.5 font-bold text-primary-foreground text-xs shadow-sm",
	pillIdle:
		"rounded-xl bg-muted px-3 py-1.5 font-bold text-muted-foreground text-xs transition-colors duration-200 hover:bg-muted/80",
	/** Search / text field aligned to input primitive */
	searchField:
		"h-10 w-full rounded-xl border-0 bg-muted pr-4 pl-9 text-foreground text-sm outline-none ring-1 ring-border transition-[background-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-ring",
	comboboxTrigger:
		"h-8 min-w-[160px] rounded-xl border border-border bg-card px-3 font-medium text-foreground text-sm shadow-none transition-colors duration-200 hover:bg-muted/60",
} as const;

export const uiTypography = {
	labelCaps: "font-medium text-[10px] text-muted-foreground uppercase tracking-widest",
	sectionLabel: "font-semibold text-muted-foreground text-xs uppercase tracking-wider",
} as const;
