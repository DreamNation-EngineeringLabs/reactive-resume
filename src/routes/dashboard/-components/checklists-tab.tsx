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

	const { data: checklists, isLoading } = useQuery(
		orpc.resume.checklists.list.queryOptions({ input: { tenantId } }),
	);

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
			<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
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
				<div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-4 pt-3">
					{isLoading ? (
						<div className="space-y-2">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} className="h-10 w-full rounded-xl" />
							))}
						</div>
					) : detail?.items && detail.items.length > 0 ? (
						<div className="space-y-2">
							{detail.items.map((item, idx) => (
								<div
									key={item.id}
									className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
								>
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-600 text-xs">
										{idx + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-medium text-slate-800 text-sm">{item.title}</p>
										{item.description && (
											<p className="mt-0.5 text-slate-400 text-xs">{item.description}</p>
										)}
									</div>
									<span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-slate-500 text-xs">
										×{item.weight}
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
