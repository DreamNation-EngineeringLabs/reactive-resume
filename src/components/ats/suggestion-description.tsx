import type { Suggestion } from "@/integrations/orpc/services/ats";
import { cn } from "@/utils/style";

export function AtsSuggestionDescription({ suggestion: s, className }: { suggestion: Suggestion; className?: string }) {
	const hasStructure = (s.bodySections?.length ?? 0) > 0;

	return (
		<div className={cn("mt-1 space-y-2 text-muted-foreground text-xs leading-relaxed", className)}>
			{s.description ? (
				<p className={cn(hasStructure ? "text-foreground/90" : "whitespace-pre-wrap")}>{s.description}</p>
			) : null}

			{s.bodySections?.map((sec, i) => (
				<div key={i}>
					{sec.title ? <p className="font-medium text-foreground">{sec.title}</p> : null}
					<ul className="mt-1 list-disc space-y-1 ps-4">
						{sec.items.map((item, j) => (
							<li key={j}>{item}</li>
						))}
					</ul>
				</div>
			))}

			{!hasStructure && s.descriptionBullets && s.descriptionBullets.length > 0 ? (
				<ul className="list-disc space-y-1 ps-4">
					{s.descriptionBullets.map((b, i) => (
						<li key={i}>{b}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
