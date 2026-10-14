import { useMemo } from "react";
import type z from "zod";
import { pageDimensionsAsMillimeters } from "@/schema/page";
import type { resumeDataSchema } from "@/schema/resume/data";

type UseCssVariablesProps = Pick<z.infer<typeof resumeDataSchema>, "picture" | "metadata">;

/** A grey primary colour (black included) means a black-and-white resume. Colours are stored as `rgba(r, g, b, a)`. */
export const isGreyColor = (rgba: string) => {
	const [r, g, b] = rgba.match(/[\d.]+/g) ?? [];
	return r !== undefined && r === g && g === b;
};

/**
 * Colours for the blocks templates fill with the primary colour (sidebars, header bands) and the text on them.
 * In colour these are the primary and background colours, as always. In black and white a filled block would be a
 * solid black slab, so it becomes a light grey with normal text instead; `tint` is the base for the `/20` washes.
 */
const fillColors = ({ primary, text, background }: UseCssVariablesProps["metadata"]["design"]["colors"]) =>
	isGreyColor(primary)
		? {
				"--page-fill-color": `color-mix(in srgb, ${text} 8%, transparent)`,
				"--page-on-fill-color": text,
				"--page-tint-color": `color-mix(in srgb, ${text} 25%, transparent)`,
			}
		: { "--page-fill-color": primary, "--page-on-fill-color": background, "--page-tint-color": primary };

export const useCSSVariables = ({ picture, metadata }: UseCssVariablesProps) => {
	const fontWeightStyles = useMemo(() => {
		const lowestBodyFontWeight = Math.min(...metadata.typography.body.fontWeights.map(Number));
		const lowestHeadingFontWeight = Math.min(...metadata.typography.heading.fontWeights.map(Number));

		const highestBodyFontWeight = Math.max(...metadata.typography.body.fontWeights.map(Number));
		const highestHeadingFontWeight = Math.max(...metadata.typography.heading.fontWeights.map(Number));

		return { lowestBodyFontWeight, lowestHeadingFontWeight, highestBodyFontWeight, highestHeadingFontWeight };
	}, [metadata.typography.body.fontWeights, metadata.typography.heading.fontWeights]);

	return {
		"--picture-border-radius": `${picture.borderRadius}pt`,
		"--page-width": pageDimensionsAsMillimeters[metadata.page.format].width,
		"--page-height": pageDimensionsAsMillimeters[metadata.page.format].height,
		"--page-sidebar-width": `${metadata.layout.sidebarWidth}%`,
		"--page-text-color": metadata.design.colors.text,
		"--page-primary-color": metadata.design.colors.primary,
		"--page-background-color": metadata.design.colors.background,
		...fillColors(metadata.design.colors),
		"--page-body-font-family": `'${metadata.typography.body.fontFamily}', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
		"--page-body-font-weight": fontWeightStyles.lowestBodyFontWeight,
		"--page-body-font-weight-bold": fontWeightStyles.highestBodyFontWeight,
		"--page-body-font-size": metadata.typography.body.fontSize,
		"--page-body-line-height": metadata.typography.body.lineHeight,
		"--page-heading-font-family": `'${metadata.typography.heading.fontFamily}', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
		"--page-heading-font-weight": fontWeightStyles.lowestHeadingFontWeight,
		"--page-heading-font-weight-bold": fontWeightStyles.highestHeadingFontWeight,
		"--page-heading-font-size": metadata.typography.heading.fontSize,
		"--page-heading-line-height": metadata.typography.heading.lineHeight,
		"--page-margin-x": `${metadata.page.marginX}pt`,
		"--page-margin-y": `${metadata.page.marginY}pt`,
		"--page-gap-x": `${metadata.page.gapX}pt`,
		"--page-gap-y": `${metadata.page.gapY}pt`,
	} as React.CSSProperties;
};
