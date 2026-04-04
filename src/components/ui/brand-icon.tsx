import { cn } from "@/utils/style";

type Props = React.ComponentProps<"img"> & {
	variant?: "logo" | "icon";
};

export function BrandIcon({ variant: _variant = "logo", className, ...props }: Props) {
	return (
		<img
			src={`${import.meta.env.BASE_URL}images/polymath_with_logo.png`}
			alt="Polymath"
			className={cn("h-10 w-auto object-contain", className)}
			{...props}
		/>
	);
}
