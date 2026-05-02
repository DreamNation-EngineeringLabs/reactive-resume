import { t } from "@lingui/core/macro";
import { CaretDownIcon, ListChecksIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

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
			<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 py-16 text-center">
				<ListChecksIcon weight="duotone" className="mb-4 size-12 text-slate-300" />
				<p className="font-semibold text-slate-600">{t`No checklists yet`}</p>
				<p className="mt-1 mb-4 max-w-sm text-slate-400 text-sm">
					{t`Create checklists to standardize how you evaluate student resumes.`}
				</p>
				<button
					type="button"
					onClick={onCreateNew}
					className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-sm text-white transition-all hover:bg-indigo-700"
				>
					<ListChecksIcon weight="duotone" className="size-4" />
					{t`Create First Checklist`}
				</button>
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
	const getScoreShareBadgeClass = (share: number) => {
		if (share >= 20) return "bg-rose-100 text-rose-700";
		if (share >= 10) return "bg-amber-100 text-amber-700";
		return "bg-emerald-100 text-emerald-700";
	};

	return (
		<div className="overflow-hidden rounded-2xl bg-white shadow-sm">
			{/* biome-ignore lint: click to expand */}
			<div
				className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50/60"
				onClick={onToggle}
			>
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
					<ListChecksIcon weight="duotone" className="size-5 text-indigo-600" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-semibold text-slate-900">{title}</p>
					{detail && (
						<p className="text-slate-400 text-xs">
							{detail.items.length} item{detail.items.length !== 1 ? "s" : ""}
						</p>
					)}
				</div>
				<CaretDownIcon
					weight="bold"
					className={cn("size-4 shrink-0 text-slate-400 transition-transform", isExpanded && "rotate-180")}
				/>
			</div>

			{/* Expanded items */}
			{isExpanded && (
				<div className="border-slate-100 border-t bg-slate-50/50 px-5 pt-3 pb-4">
					{isLoading ? (
						<div className="space-y-2">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} className="h-10 w-full rounded-xl" />
							))}
						</div>
					) : detail?.items && detail.items.length > 0 ? (
						<div className="space-y-2">
							<p className="px-1 text-slate-500 text-xs">
								{t`Each item contributes a share of the final score based on its weight. Higher weight means a higher score share.`}
							</p>
							{detail.items.map((item, idx) => (
								<div key={item.id} className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-600 text-xs">
										{idx + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-medium text-slate-800 text-sm">{item.title}</p>
										{item.description && <p className="mt-0.5 text-slate-400 text-xs">{item.description}</p>}
									</div>
									<span
										className={cn(
											"shrink-0 rounded-lg px-2 py-0.5 text-xs",
											getScoreShareBadgeClass(getScoreShare(item.weight ?? 1)),
										)}
										title={`This item contributes ${formatPercent(getScoreShare(item.weight ?? 1))} of the final score.`}
									>
										{t`Score Share`} {formatPercent(getScoreShare(item.weight ?? 1))}
									</span>
								</div>
							))}
						</div>
					) : (
						<p className="text-center text-slate-400 text-sm">No items in this checklist</p>
					)}
				</div>
			)}
		</div>
	);
}
