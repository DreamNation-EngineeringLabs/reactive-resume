import { t } from "@lingui/core/macro";
import { CaretDownIcon, ListChecksIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { uiSurface } from "@/utils/ui-tokens";

type ChecklistsTabProps = {
	tenantId: string;
	onCreateNew: () => void;
};

export function ChecklistsTab({ tenantId, onCreateNew }: ChecklistsTabProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const { data: checklists, isLoading } = useQuery(orpc.resume.checklists.list.queryOptions({ input: { tenantId } }));

	if (isLoading) {
		return (
			<div className="space-y-3">
				{[...Array(3)].map((_, i) => (
					<Skeleton key={i} className="h-16 w-full rounded-2xl" />
				))}
			</div>
		);
	}

	if (!checklists || checklists.length === 0) {
		return (
			<div className={cn("flex flex-col items-center justify-center py-16", uiSurface.empty)}>
				<ListChecksIcon weight="duotone" className="mb-4 size-12 text-muted-foreground/40" />
				<p className="font-semibold text-foreground">{t`No checklists yet`}</p>
				<p className="mt-1 mb-4 max-w-sm text-muted-foreground text-sm">
					{t`Create checklists to standardize how you evaluate student resumes.`}
				</p>
				<Button type="button" onClick={onCreateNew} className="rounded-xl">
					<ListChecksIcon weight="duotone" className="size-4" />
					{t`Create First Checklist`}
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{checklists.map((checklist) => (
				<ChecklistRow
					key={checklist.id}
					checklistId={checklist.id}
					title={checklist.title}
					isExpanded={expandedId === checklist.id}
					onToggle={() => setExpandedId(expandedId === checklist.id ? null : checklist.id)}
				/>
			))}
		</div>
	);
}

function ChecklistRow({
	checklistId,
	title,
	isExpanded,
	onToggle,
}: {
	checklistId: string;
	title: string;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const { data: detail, isLoading } = useQuery({
		...orpc.resume.checklists.get.queryOptions({ input: { checklistId } }),
		enabled: isExpanded,
	});
	const totalWeight = detail?.items?.reduce((sum, item) => sum + (item.weight ?? 1), 0) ?? 0;
	const getScoreShare = (weight: number) => (totalWeight > 0 ? (weight / totalWeight) * 100 : 0);
	const formatPercent = (value: number) => `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
	const getScoreShareBadgeVariant = (share: number): "rose" | "amber" | "emerald" => {
		if (share >= 20) return "rose";
		if (share >= 10) return "amber";
		return "emerald";
	};

	return (
		<div className={cn("overflow-hidden", uiSurface.card)}>
			<div
				className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors duration-200 hover:bg-muted/50"
				onClick={onToggle}
			>
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
					<ListChecksIcon weight="duotone" className="size-5 text-primary" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-semibold text-foreground">{title}</p>
					{detail && (
						<p className="text-muted-foreground text-xs">
							{detail.items.length} item{detail.items.length !== 1 ? "s" : ""}
						</p>
					)}
				</div>
				<CaretDownIcon
					weight="bold"
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform duration-200",
						isExpanded && "rotate-180",
					)}
				/>
			</div>

			{/* Expanded items */}
			{isExpanded && (
				<div className="border-border border-t bg-muted/30 px-5 pt-3 pb-4">
					{isLoading ? (
						<div className="space-y-2">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} className="h-10 w-full rounded-xl" />
							))}
						</div>
					) : detail?.items && detail.items.length > 0 ? (
						<div className="space-y-2">
							<p className="px-1 text-muted-foreground text-xs">
								{t`Each item contributes a share of the final score based on its weight. Higher weight means a higher score share.`}
							</p>
							{detail.items.map((item, idx) => (
								<div key={item.id} className={cn("flex items-start gap-3 px-4 py-3", uiSurface.inset)}>
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-xs">
										{idx + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-medium text-foreground text-sm">{item.title}</p>
										{item.description && <p className="mt-0.5 text-muted-foreground text-xs">{item.description}</p>}
									</div>
									<Badge
										variant={getScoreShareBadgeVariant(getScoreShare(item.weight ?? 1))}
										className="shrink-0"
										title={`This item contributes ${formatPercent(getScoreShare(item.weight ?? 1))} of the final score.`}
									>
										{t`Score Share`} {formatPercent(getScoreShare(item.weight ?? 1))}
									</Badge>
								</div>
							))}
						</div>
					) : (
						<p className="text-center text-muted-foreground text-sm">No items in this checklist</p>
					)}
				</div>
			)}
		</div>
	);
}
