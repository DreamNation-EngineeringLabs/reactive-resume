import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	ArrowCounterClockwiseIcon,
	ArrowsInIcon,
	ArrowsOutIcon,
	CheckCircleIcon,
	CircleNotchIcon,
	LightningIcon,
	MagnifyingGlassIcon,
	TargetIcon,
	WarningCircleIcon,
	WarningIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KeywordCurveChart } from "@/components/ats/keyword-curve-chart";
import { AtsScoreHistoryChart } from "@/components/ats/score-history-chart";
import { AtsSuggestionDescription } from "@/components/ats/suggestion-description";
import { flushResumeSync, useResumeStore } from "@/components/resume/store/resume";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { orpc } from "@/integrations/orpc/client";
import type { CategoryScore, JsonPatchOp, ScoringResult, Suggestion } from "@/integrations/orpc/services/ats";
import { removeBulletFromHtml, replaceBulletInHtml } from "@/integrations/orpc/services/ats/html-utils";
import { cn } from "@/utils/style";
import { useSectionStore } from "../../../-store/section";
import { useBuilderSidebar, useBuilderSidebarStore } from "../../../-store/sidebar";
import { SectionBase } from "../shared/section-base";

export function ATSScoreSectionBuilder() {
	const panelState = useATSPanelState();
	const { openAts } = useSearch({ from: "/builder/$resumeId" });
	const { resumeId } = useParams({ from: "/builder/$resumeId" });
	const navigate = useNavigate();
	const { toggleSidebar, isCollapsed } = useBuilderSidebar();
	const setCollapsed = useSectionStore((s) => s.setCollapsed);
	const atsInlineExpanded = useBuilderSidebarStore((s) => s.atsInlineExpanded);
	const setAtsInlineExpanded = useBuilderSidebarStore((s) => s.setAtsInlineExpanded);

	const handleExpand = useCallback(() => {
		if (isCollapsed("right")) toggleSidebar("right", true);
		setCollapsed("ats-score", false);
		setAtsInlineExpanded(true);
	}, [isCollapsed, toggleSidebar, setCollapsed, setAtsInlineExpanded]);

	const handleCollapse = useCallback(() => {
		setAtsInlineExpanded(false);
	}, [setAtsInlineExpanded]);

	// Auto-open inline panel when navigated with openAts=true (e.g. from dashboard)
	useEffect(() => {
		if (!openAts) return;
		handleExpand();
		navigate({ to: ".", search: { openAts: false }, replace: true });
	}, [openAts, navigate, handleExpand]);

	return (
		<SectionBase
			type="ats-score"
			extra={
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							{atsInlineExpanded ? (
								<Button size="icon" variant="ghost" className="size-8" onClick={handleCollapse}>
									<ArrowsInIcon className="size-4" />
								</Button>
							) : (
								<Button size="icon" variant="ghost" className="size-8" onClick={handleExpand}>
									<ArrowsOutIcon className="size-4" />
								</Button>
							)}
						</TooltipTrigger>
						<TooltipContent>
							{atsInlineExpanded ? <Trans>Collapse</Trans> : <Trans>Expand inline</Trans>}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			}
		>
			{atsInlineExpanded ? (
				<ATSScoreInlineBody state={panelState} resumeId={resumeId} />
			) : (
				<ATSScorePanel state={panelState} onExpand={handleExpand} />
			)}
		</SectionBase>
	);
}

interface ATSPanelState {
	jobDescription: string;
	setJobDescription: (v: string) => void;
	result: ScoringResult | null;
	setResult: (v: ScoringResult | null) => void;
	appliedIds: Set<string>;
	setAppliedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	dismissedIds: Set<string>;
	setDismissedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	isPending: boolean;
	handleScore: () => void;
	handleApply: (suggestion: Suggestion) => void;
	handleDismiss: (id: string) => void;
	handleApplyAll: () => void;
	pendingSuggestions: Suggestion[];
	applicablePendingCount: number;
}

function useATSPanelState(): ATSPanelState {
	const params = useParams({ from: "/builder/$resumeId" });
	const updateResumeData = useResumeStore((state) => state.updateResumeData);
	const queryClient = useQueryClient();

	const storageKey = `ats-score-${params.resumeId}`;

	const [jobDescription, setJobDescription] = useState(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) return (JSON.parse(saved) as { jd?: string }).jd ?? "";
		} catch {
			/* ignore */
		}
		return "";
	});
	const [result, setResult] = useState<ScoringResult | null>(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) return (JSON.parse(saved) as { result?: ScoringResult }).result ?? null;
		} catch {
			/* ignore */
		}
		return null;
	});
	const [appliedIds, setAppliedIds] = useState<Set<string>>(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const arr = (JSON.parse(saved) as { applied?: string[] }).applied;
				return arr ? new Set(arr) : new Set();
			}
		} catch {
			/* ignore */
		}
		return new Set();
	});
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const arr = (JSON.parse(saved) as { dismissed?: string[] }).dismissed;
				return arr ? new Set(arr) : new Set();
			}
		} catch {
			/* ignore */
		}
		return new Set();
	});

	// Persist state changes to localStorage
	useEffect(() => {
		try {
			localStorage.setItem(
				storageKey,
				JSON.stringify({
					result,
					jd: jobDescription,
					applied: [...appliedIds],
					dismissed: [...dismissedIds],
				}),
			);
		} catch {
			/* ignore full storage */
		}
	}, [storageKey, result, jobDescription, appliedIds, dismissedIds]);

	const { mutate: scoreResume, isPending } = useMutation(
		orpc.ats.score.mutationOptions({
			onSuccess: (data) => {
				setResult(data as ScoringResult);
				setAppliedIds(new Set());
				setDismissedIds(new Set());
				// Refresh history chart so new entry (with delta) appears immediately
				queryClient.invalidateQueries({
					queryKey: orpc.ats.getHistory.queryOptions({ input: { resumeId: params.resumeId } }).queryKey,
				});
			},
			onError: (error) => {
				toast.error(error.message || t`Failed to score resume. Please try again.`);
			},
		}),
	);

	const handleScore = useCallback(() => {
		flushResumeSync();
		setTimeout(() => {
			scoreResume({
				resumeId: params.resumeId,
				jobDescription: jobDescription.trim() || undefined,
				includeAiSuggestions: true,
			});
		}, 300);
	}, [scoreResume, params.resumeId, jobDescription]);

	const applyPatches = useCallback(
		(patches: JsonPatchOp[]): boolean => {
			let allSucceeded = true;
			updateResumeData((draft) => {
				for (const patch of patches) {
					if (!applyJsonPatch(draft, patch)) {
						allSucceeded = false;
					}
				}
			});
			return allSucceeded;
		},
		[updateResumeData],
	);

	const handleApply = useCallback(
		(suggestion: Suggestion) => {
			if (!suggestion.patches?.length) return;
			const success = applyPatches(suggestion.patches);
			if (success) {
				setAppliedIds((prev) => new Set(prev).add(suggestion.id));
				toast.success(t`Suggestion applied`);
			} else {
				toast.error(t`Could not apply — re-score for fresh suggestions`);
			}
		},
		[applyPatches],
	);

	const handleDismiss = useCallback((id: string) => {
		setDismissedIds((prev) => new Set(prev).add(id));
	}, []);

	const handleApplyAll = useCallback(() => {
		if (!result) return;
		const toApply = result.suggestions.filter(
			(s) => s.autoApplicable && s.patches?.length && !appliedIds.has(s.id) && !dismissedIds.has(s.id),
		);
		if (toApply.length === 0) return;

		let successCount = 0;
		let failCount = 0;

		updateResumeData((draft) => {
			for (const suggestion of toApply) {
				let suggestionOk = true;
				for (const patch of suggestion.patches!) {
					if (!applyJsonPatch(draft, patch)) {
						suggestionOk = false;
					}
				}
				if (suggestionOk) {
					successCount++;
				} else {
					failCount++;
				}
			}
		});

		const appliedSet = new Set(appliedIds);
		for (const s of toApply) {
			appliedSet.add(s.id);
		}
		setAppliedIds(appliedSet);

		if (failCount === 0) {
			toast.success(t`Applied ${successCount} suggestions`);
		} else {
			toast.warning(t`Applied ${successCount} suggestions, ${failCount} failed — re-score for fresh suggestions`);
		}
	}, [result, appliedIds, dismissedIds, updateResumeData]);

	const pendingSuggestions = useMemo(
		() => result?.suggestions.filter((s) => !appliedIds.has(s.id) && !dismissedIds.has(s.id)) ?? [],
		[result, appliedIds, dismissedIds],
	);

	const applicablePendingCount = useMemo(
		() => pendingSuggestions.filter((s) => s.autoApplicable && s.patches?.length).length,
		[pendingSuggestions],
	);

	return {
		jobDescription,
		setJobDescription,
		result,
		setResult,
		appliedIds,
		setAppliedIds,
		dismissedIds,
		setDismissedIds,
		isPending,
		handleScore,
		handleApply,
		handleDismiss,
		handleApplyAll,
		pendingSuggestions,
		applicablePendingCount,
	};
}

function ATSScorePanel({ state, onExpand }: { state: ATSPanelState; onExpand: () => void }) {
	const { jobDescription, setJobDescription, result, isPending, handleScore, pendingSuggestions } = state;

	const criticalCount = pendingSuggestions.filter((s) => s.severity === "critical").length;
	const warningCount = pendingSuggestions.filter((s) => s.severity === "warning").length;
	const autoCount = pendingSuggestions.filter((s) => s.autoApplicable && s.patches?.length).length;

	return (
		<div className="space-y-3">
			<div className="space-y-2">
				<p className="text-muted-foreground text-xs">
					<Trans>
						Paste a job description to score vs. a specific role, or score without one for general ATS checks.
					</Trans>
				</p>
				<Textarea
					value={jobDescription}
					onChange={(e) => setJobDescription(e.target.value)}
					placeholder={t`Paste job description here (optional)...`}
					rows={3}
					className="resize-none text-xs"
				/>
			</div>

			<Button onClick={handleScore} disabled={isPending} className="w-full" size="sm">
				{isPending ? (
					<>
						<CircleNotchIcon className="mr-2 size-3.5 animate-spin" />
						<Trans>Scoring...</Trans>
					</>
				) : (
					<>
						<MagnifyingGlassIcon className="mr-2 size-3.5" />
						<Trans>Score My Resume</Trans>
					</>
				)}
			</Button>

			{result && (
				<>
					<Separator />
					<ScoreOverview result={result} />

					{/* Suggestion summary + CTA */}
					{pendingSuggestions.length > 0 && (
						<div className="space-y-2 rounded-lg border bg-muted/30 p-3">
							<div className="flex flex-wrap gap-1.5">
								{criticalCount > 0 && (
									<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-medium text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
										<XCircleIcon className="size-3" />
										{criticalCount} critical
									</span>
								)}
								{warningCount > 0 && (
									<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
										<WarningIcon className="size-3" />
										{warningCount} warnings
									</span>
								)}
								{autoCount > 0 && (
									<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-[11px] text-green-700 dark:bg-green-950/40 dark:text-green-300">
										<LightningIcon className="size-3" />
										{autoCount} auto-fix
									</span>
								)}
							</div>
							<Button onClick={onExpand} className="w-full" size="sm">
								<ArrowsOutIcon className="mr-1.5 size-3.5" />
								<Trans>View & Apply Suggestions ({pendingSuggestions.length})</Trans>
							</Button>
						</div>
					)}

					{pendingSuggestions.length === 0 && result && (
						<p className="text-center text-muted-foreground text-xs">
							<Trans>All suggestions applied or dismissed. Re-score to refresh.</Trans>
						</p>
					)}
				</>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Inline body — full ATS panel shown inside the right sidebar when expanded
// ---------------------------------------------------------------------------

function ATSScoreInlineBody({ state, resumeId }: { state: ATSPanelState; resumeId: string }) {
	const {
		jobDescription,
		setJobDescription,
		result,
		appliedIds,
		dismissedIds,
		isPending,
		handleScore,
		handleApply,
		handleDismiss,
		handleApplyAll,
		applicablePendingCount,
	} = state;

	// Fetch history to get delta + improvements for the latest run
	const { data: history } = useQuery(orpc.ats.getHistory.queryOptions({ input: { resumeId } }));
	const latestEntry = history && history.length > 0 ? history[history.length - 1] : null;
	// Only show delta when result is fresh (overall score matches latest history entry)
	const deltaEntry = latestEntry && result && latestEntry.overallScore === result.overall ? latestEntry : null;

	const categories = useMemo(() => getCategories(result), [result]);
	const [activeCategory, setActiveCategory] = useState<string | null>(null);

	// Default to the lowest-scoring category when results arrive
	useEffect(() => {
		if (!categories.length) return;
		const worst = [...categories].sort((a, b) => {
			const pa = a.score.max > 0 ? a.score.score / a.score.max : 1;
			const pb = b.score.max > 0 ? b.score.score / b.score.max : 1;
			return pa - pb;
		})[0];
		setActiveCategory(worst?.key ?? categories[0]?.key ?? null);
	}, [categories]);

	const activeCat = categories.find((c) => c.key === activeCategory) ?? categories[0] ?? null;
	const activeSuggestions = result?.suggestions.filter((s) => s.category === activeCategory) ?? [];

	return (
		<div className="space-y-4">
			{/* ── Job description + score button ── */}
			<div className="space-y-2">
				<Textarea
					value={jobDescription}
					onChange={(e) => setJobDescription(e.target.value)}
					placeholder={t`Paste job description here (optional)...`}
					rows={2}
					className="resize-none text-xs"
				/>
				<Button onClick={handleScore} disabled={isPending} className="w-full" size="sm">
					{isPending ? (
						<>
							<CircleNotchIcon className="mr-1.5 size-3.5 animate-spin" />
							<Trans>Scoring...</Trans>
						</>
					) : (
						<>
							<MagnifyingGlassIcon className="mr-1.5 size-3.5" />
							<Trans>Score My Resume</Trans>
						</>
					)}
				</Button>
			</div>

			{result && (
				<>
					{result.metadata.aiRewriteUnavailable && (
						<p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-900 text-xs dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
							<Trans>
								Some AI rewrites could not be generated. Manual suggestions and scores still apply — check your AI
								configuration or try re-scoring.
							</Trans>
						</p>
					)}

					{/* ── Overall score + mode ── */}
					<div className="space-y-2 rounded-xl border bg-muted/30 px-4 py-3">
						<div className="flex items-center gap-3">
							<ScoreRingSmall score={result.overall} />
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<p className={cn("font-bold text-2xl tabular-nums leading-none", getScoreColor(result.overall).text)}>
										{result.overall}
										<span className="ml-1 font-normal text-sm">/100</span>
									</p>
									{/* Delta badge — shown when history is loaded and delta exists */}
									{deltaEntry?.deltaScore != null && deltaEntry.deltaScore !== 0 && (
										<span
											className={cn(
												"flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold text-[10px]",
												deltaEntry.deltaScore > 0
													? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
													: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
											)}
										>
											{deltaEntry.deltaScore > 0 ? "↑" : "↓"}
											{deltaEntry.deltaScore > 0 ? "+" : ""}
											{deltaEntry.deltaScore} vs last
										</span>
									)}
									{deltaEntry?.deltaScore === 0 && (
										<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
											= no change
										</span>
									)}
									{deltaEntry?.deltaScore == null && history && history.length === 1 && (
										<span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/40">
											<Trans>First check</Trans>
										</span>
									)}
								</div>
								<p className={cn("mt-0.5 font-medium text-xs", getScoreColor(result.overall).text)}>
									{getScoreLabel(result.overall)}
								</p>
								<span
									className={cn(
										"mt-1 inline-block rounded-full px-2 py-0.5 font-medium text-[10px]",
										result.metadata.jdProvided
											? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
											: "bg-muted text-muted-foreground",
									)}
								>
									{result.metadata.jdProvided ? t`Job Match` : t`General ATS`}
								</span>
							</div>
							{applicablePendingCount > 0 && (
								<Button size="sm" variant="default" onClick={handleApplyAll} className="shrink-0 text-xs">
									<LightningIcon className="mr-1 size-3" />
									<Trans>Apply {applicablePendingCount}</Trans>
								</Button>
							)}
						</div>
						{/* Major improvements row */}
						{deltaEntry && deltaEntry.majorImprovements.length > 0 && (
							<div className="flex flex-wrap gap-1.5 border-t pt-2">
								{deltaEntry.majorImprovements.map((imp) => (
									<span
										key={imp.category}
										className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-semibold text-[10px] text-green-700 dark:bg-green-950/40 dark:text-green-400"
									>
										↑ {imp.label} <span className="opacity-70">+{imp.delta}%</span>
									</span>
								))}
							</div>
						)}
					</div>

					{/* ── 2-column category grid (click to select) ── */}
					<div className="grid grid-cols-2 gap-2">
						{categories.map((cat) => {
							const pct = cat.score.max > 0 ? Math.round((cat.score.score / cat.score.max) * 100) : 0;
							const color = getScoreColor(pct);
							const catSuggestions = result.suggestions.filter(
								(s) => s.category === cat.key && !appliedIds.has(s.id) && !dismissedIds.has(s.id),
							);
							const isActive = activeCategory === cat.key;
							return (
								<button
									key={cat.key}
									type="button"
									onClick={() => setActiveCategory(cat.key)}
									className={cn(
										"group flex flex-col gap-1.5 rounded-lg border p-2.5 text-left transition-all hover:border-primary/40 hover:bg-muted/60",
										isActive ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "bg-card",
									)}
								>
									<div className="flex items-center justify-between gap-1">
										<span className="truncate font-medium text-[11px] leading-tight">{cat.label}</span>
										{catSuggestions.length > 0 && (
											<span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 font-bold text-[9px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
												{catSuggestions.length}
											</span>
										)}
									</div>
									<div className="flex items-center justify-between">
										<div className="h-1.5 flex-1 rounded-full bg-muted">
											<div
												className={cn("h-full rounded-full transition-all", color.bg)}
												style={{ width: `${pct}%` }}
											/>
										</div>
										<span className={cn("ml-2 shrink-0 font-bold text-[11px] tabular-nums", color.text)}>
											{cat.score.score}/{cat.score.max}
										</span>
									</div>
								</button>
							);
						})}
					</div>

					{/* ── Missing keywords chip row (JD mode only) ── */}
					{result.metadata.jdProvided && result.metadata.keywordsMissing.length > 0 && (
						<MissingKeywords keywords={result.metadata.keywordsMissing} matched={result.metadata.keywordsMatched} />
					)}

					{/* ── Selected category detail ── */}
					{activeCat && (
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<div
									className={cn(
										"h-3 w-1 rounded-full",
										getScoreColor(
											activeCat.score.max > 0 ? Math.round((activeCat.score.score / activeCat.score.max) * 100) : 0,
										).bg,
									)}
								/>
								<p className="font-semibold text-sm">{activeCat.label}</p>
								<span
									className={cn(
										"ml-auto font-bold text-sm tabular-nums",
										getScoreColor(
											activeCat.score.max > 0 ? Math.round((activeCat.score.score / activeCat.score.max) * 100) : 0,
										).text,
									)}
								>
									{activeCat.score.score}/{activeCat.score.max}
								</span>
							</div>
							<CategoryDetailPanel
								category={activeCat}
								suggestions={activeSuggestions}
								appliedIds={appliedIds}
								dismissedIds={dismissedIds}
								onApply={handleApply}
								onDismiss={handleDismiss}
								jdProvided={result.metadata.jdProvided}
								taxonomyMatchCount={result.metadata.taxonomyMatchCount}
							/>
						</div>
					)}

					{/* ── Score history + re-score ── */}
					<div className="space-y-2 border-t pt-3">
						<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							<Trans>Score History</Trans>
						</p>
						<AtsScoreHistoryChart resumeId={resumeId} />
						<Button variant="outline" size="sm" onClick={handleScore} disabled={isPending} className="w-full">
							<ArrowCounterClockwiseIcon className="mr-1.5 size-3.5" />
							<Trans>Re-score Resume</Trans>
						</Button>
					</div>
				</>
			)}
		</div>
	);
}

// Small score ring used inside the inline panel header
function ScoreRingSmall({ score }: { score: number }) {
	const circumference = 2 * Math.PI * 20;
	const offset = circumference - (score / 100) * circumference;
	return (
		<div className="relative flex size-12 shrink-0 items-center justify-center">
			<svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
				<circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" className="stroke-muted" />
				<circle
					cx="24"
					cy="24"
					r="20"
					fill="none"
					strokeWidth="4"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					className={cn(
						"transition-all duration-700",
						score >= 80 ? "stroke-green-500" : score >= 60 ? "stroke-amber-500" : "stroke-red-500",
					)}
				/>
			</svg>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Score overview (sidebar compact)
// ---------------------------------------------------------------------------

function ScoreOverview({ result }: { result: ScoringResult }) {
	const color = getScoreColor(result.overall);

	return (
		<div className="flex flex-col items-center gap-2 py-2">
			<div
				className={cn(
					"flex size-20 items-center justify-center rounded-full border-4 font-bold text-3xl",
					color.border,
					color.text,
				)}
			>
				{result.overall}
			</div>
			<p className={cn("font-medium text-sm", color.text)}>{getScoreLabel(result.overall)}</p>
			<span
				className={cn(
					"rounded-full px-2 py-0.5 font-medium text-[10px]",
					result.metadata.jdProvided
						? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
						: "bg-muted text-muted-foreground",
				)}
			>
				{result.metadata.jdProvided ? <Trans>Job Match</Trans> : <Trans>General ATS</Trans>}
			</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Category detail panel — shown per tab
// ---------------------------------------------------------------------------

type CategoryInfo = {
	key: string;
	label: string;
	score: CategoryScore;
};

function CategoryDetailPanel({
	category,
	suggestions,
	appliedIds,
	dismissedIds,
	onApply,
	onDismiss,
	jdProvided,
	taxonomyMatchCount,
}: {
	category: CategoryInfo;
	suggestions: Suggestion[];
	appliedIds: Set<string>;
	dismissedIds: Set<string>;
	onApply: (s: Suggestion) => void;
	onDismiss: (id: string) => void;
	jdProvided: boolean;
	taxonomyMatchCount?: number;
}) {
	const passedRules = category.score.details.filter((r) => r.score >= r.maxScore);
	const deductedRules = category.score.details.filter((r) => r.score < r.maxScore);
	const pendingSuggestions = suggestions.filter((s) => !appliedIds.has(s.id) && !dismissedIds.has(s.id));
	const appliedSuggestions = suggestions.filter((s) => appliedIds.has(s.id));

	return (
		<div className="space-y-5 pt-4">
			{/* Keyword scoring curve — only in no-JD mode for the keywordMatch tab */}
			{category.key === "keywordMatch" && !jdProvided && taxonomyMatchCount !== undefined && (
				<KeywordCurveChart currentCount={taxonomyMatchCount} />
			)}

			{/* What's Good */}
			{passedRules.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-green-600 text-sm">
						<CheckCircleIcon weight="fill" className="size-4" />
						<Trans>What's Good</Trans>
					</h4>
					<div className="space-y-1.5">
						{passedRules.map((rule) => (
							<div
								key={rule.ruleId}
								className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 dark:bg-green-950/20"
							>
								<CheckCircleIcon weight="fill" className="mt-0.5 size-3.5 shrink-0 text-green-500" />
								<span className="text-green-800 text-xs dark:text-green-300">{rule.details || rule.ruleName}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* What Needs Improvement */}
			{deductedRules.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-amber-600 text-sm">
						<WarningCircleIcon weight="fill" className="size-4" />
						<Trans>Needs Improvement</Trans>
					</h4>
					<div className="space-y-1.5">
						{deductedRules.map((rule) => (
							<div
								key={rule.ruleId}
								className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/20"
							>
								<WarningIcon weight="fill" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
								<div className="text-xs">
									<span className="font-medium text-amber-800 dark:text-amber-300">
										-{rule.maxScore - rule.score} pts
									</span>
									<span className="ml-1.5 text-amber-700 dark:text-amber-400">{rule.details || rule.ruleName}</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Actionable Suggestions */}
			{(pendingSuggestions.length > 0 || deductedRules.length > 0) && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-blue-600 text-sm">
						<LightningIcon weight="fill" className="size-4" />
						<Trans>How to Improve</Trans>
						{jdProvided && (
							<Badge variant="outline" className="ml-1 text-[10px]">
								<Trans>JD-matched</Trans>
							</Badge>
						)}
					</h4>
					{pendingSuggestions.length > 0 ? (
						<div className="space-y-2">
							{pendingSuggestions.map((suggestion) => (
								<SuggestionCard
									key={suggestion.id}
									suggestion={suggestion}
									applied={false}
									dismissed={false}
									onApply={onApply}
									onDismiss={onDismiss}
								/>
							))}
						</div>
					) : (
						<p className="rounded-lg border border-dashed bg-muted/30 px-3 py-3 text-center text-muted-foreground text-xs">
							<Trans>
								No suggestion cards in this tab. Use “Needs Improvement” above, try other categories, or re-score after
								edits.
							</Trans>
						</p>
					)}
				</div>
			)}

			{/* Applied suggestions */}
			{appliedSuggestions.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-muted-foreground text-sm">
						<CheckCircleIcon className="size-4" />
						<Trans>Applied</Trans>
					</h4>
					<div className="space-y-2">
						{appliedSuggestions.map((suggestion) => (
							<SuggestionCard
								key={suggestion.id}
								suggestion={suggestion}
								applied
								dismissed={false}
								onApply={onApply}
								onDismiss={onDismiss}
							/>
						))}
					</div>
				</div>
			)}

			{passedRules.length > 0 && deductedRules.length === 0 && pendingSuggestions.length === 0 && (
				<p className="py-4 text-center text-green-600 text-sm">
					<Trans>This category looks great! No improvements needed.</Trans>
				</p>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Missing & Matched Keywords
// ---------------------------------------------------------------------------

function MissingKeywords({ keywords, matched }: { keywords: string[]; matched: string[] }) {
	const [showAll, setShowAll] = useState(false);
	const displayed = showAll ? keywords : keywords.slice(0, 10);

	return (
		<div className="space-y-3 rounded-xl border p-4">
			{matched.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-green-600 text-sm">
						<CheckCircleIcon weight="fill" className="size-4" />
						<Trans>Matched Keywords</Trans>
						<Badge variant="secondary" className="text-[10px]">
							{matched.length}
						</Badge>
					</h4>
					<div className="flex flex-wrap gap-1.5">
						{matched.map((kw) => (
							<Badge
								key={kw}
								className="border-green-200 bg-green-100 text-green-800 text-xs dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
							>
								{kw}
							</Badge>
						))}
					</div>
				</div>
			)}

			<div className="space-y-2">
				<h4 className="flex items-center gap-1.5 font-semibold text-red-600 text-sm">
					<XCircleIcon weight="fill" className="size-4" />
					<Trans>Missing Keywords</Trans>
					<Badge variant="secondary" className="text-[10px]">
						{keywords.length}
					</Badge>
				</h4>
				<div className="flex flex-wrap gap-1.5">
					{displayed.map((kw) => (
						<Badge
							key={kw}
							variant="outline"
							className="border-red-200 text-red-700 text-xs dark:border-red-800 dark:text-red-400"
						>
							{kw}
						</Badge>
					))}
				</div>
				{keywords.length > 10 && (
					<button type="button" onClick={() => setShowAll(!showAll)} className="text-primary text-xs hover:underline">
						{showAll ? <Trans>Show less</Trans> : <Trans>+{keywords.length - 10} more</Trans>}
					</button>
				)}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Suggestion card
// ---------------------------------------------------------------------------

type SuggestionCardProps = {
	suggestion: Suggestion;
	applied: boolean;
	dismissed: boolean;
	onApply: (suggestion: Suggestion) => void;
	onDismiss: (id: string) => void;
};

function SuggestionCard({ suggestion, applied, dismissed, onApply, onDismiss }: SuggestionCardProps) {
	if (dismissed) return null;

	const severityConfig = {
		critical: { icon: XCircleIcon, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
		warning: { icon: WarningCircleIcon, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
		info: { icon: WarningIcon, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
	};

	const config = severityConfig[suggestion.severity];
	const SeverityIcon = config.icon;

	return (
		<div className={cn("rounded-lg border p-3 text-sm", applied && "opacity-60")}>
			<div className="flex items-start gap-2">
				<SeverityIcon weight="fill" className={cn("mt-0.5 size-4 shrink-0", config.color)} />
				<div className="min-w-0 flex-1">
					<h4 className="font-medium text-sm leading-tight">{suggestion.title}</h4>
					<AtsSuggestionDescription suggestion={suggestion} />

					{suggestion.diff.hunks.length > 0 && <DiffView hunks={suggestion.diff.hunks} />}

					<div className="mt-2 flex items-center gap-2">
						{applied ? (
							<span className="flex items-center gap-1 text-green-600 text-xs">
								<CheckCircleIcon className="size-3.5" />
								<Trans>Applied</Trans>
							</span>
						) : (
							<>
								{suggestion.autoApplicable && suggestion.patches?.length ? (
									<Button size="sm" variant="outline" onClick={() => onApply(suggestion)} className="h-7 text-xs">
										<TargetIcon className="mr-1 size-3" />
										<Trans>Apply fix</Trans>
									</Button>
								) : null}
								<Button
									size="sm"
									variant="ghost"
									onClick={() => onDismiss(suggestion.id)}
									className="h-7 text-muted-foreground text-xs"
								>
									<Trans>Dismiss</Trans>
								</Button>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function DiffView({ hunks }: { hunks: { removed?: string; added?: string; context?: string }[] }) {
	return (
		<div className="mt-2 overflow-hidden rounded border bg-muted/30 font-mono text-xs">
			{hunks.map((hunk, i) => (
				<div key={i}>
					{hunk.context && <div className="px-2 py-0.5 text-muted-foreground">{hunk.context}</div>}
					{hunk.removed && (
						<div className="bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-950/40 dark:text-red-300">
							- {hunk.removed}
						</div>
					)}
					{hunk.added && (
						<div className="bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-950/40 dark:text-green-300">
							+ {hunk.added}
						</div>
					)}
				</div>
			))}
		</div>
	);
}

// --- Helpers ---

function getCategories(result: ScoringResult | null): CategoryInfo[] {
	if (!result) return [];
	return [
		{ key: "keywordMatch", label: t`Keyword Match`, score: result.categories.keywordMatch },
		{ key: "impactMetrics", label: t`Impact & Metrics`, score: result.categories.impactMetrics },
		{ key: "structure", label: t`Structure`, score: result.categories.structure },
		{ key: "formatting", label: t`Formatting`, score: result.categories.formatting },
		{ key: "brevity", label: t`Brevity`, score: result.categories.brevity },
		...(result.categories.tailoring
			? [
					{
						key: "tailoring",
						label: result.metadata.jdProvided ? t`Tailoring` : t`Content Quality`,
						score: result.categories.tailoring,
					},
				]
			: []),
	];
}

function applyJsonPatch(draft: Record<string, unknown>, patch: JsonPatchOp): boolean {
	const pathParts = patch.path.split("/").filter(Boolean);
	if (pathParts.length === 0) return false;

	if (patch.op === "replace" || patch.op === "add") {
		let current: Record<string, unknown> = draft;
		for (let i = 0; i < pathParts.length - 1; i++) {
			const key = pathParts[i]!;
			if (current[key] == null) return false;
			current = current[key] as Record<string, unknown>;
		}
		const lastKey = pathParts[pathParts.length - 1]!;

		if (patch.op === "add" && Array.isArray(current)) {
			if (lastKey === "-") {
				current.push(patch.value);
			} else {
				const idx = Number.parseInt(lastKey, 10);
				if (!Number.isNaN(idx)) {
					current.splice(idx, 0, patch.value);
				}
			}
		} else {
			current[lastKey] = patch.value;
		}
		return true;
	} else if (patch.op === "remove") {
		let current: Record<string, unknown> = draft;
		for (let i = 0; i < pathParts.length - 1; i++) {
			const key = pathParts[i]!;
			if (current[key] == null) return false;
			current = current[key] as Record<string, unknown>;
		}
		const lastKey = pathParts[pathParts.length - 1]!;
		if (Array.isArray(current)) {
			const idx = Number.parseInt(lastKey, 10);
			if (!Number.isNaN(idx)) {
				current.splice(idx, 1);
			}
		} else {
			delete current[lastKey];
		}
		return true;
	} else if (patch.op === "replace-bullet" || patch.op === "remove-bullet") {
		let current: Record<string, unknown> = draft;
		for (let i = 0; i < pathParts.length - 1; i++) {
			const key = pathParts[i]!;
			if (current[key] == null) return false;
			current = current[key] as Record<string, unknown>;
		}
		const lastKey = pathParts[pathParts.length - 1]!;
		const html = current[lastKey];
		if (typeof html !== "string") return false;

		if (patch.op === "replace-bullet") {
			if (!patch.oldText || !patch.newText) return false;
			const updated = replaceBulletInHtml(html, patch.oldText, patch.newText);
			if (updated === html) return false;
			current[lastKey] = updated;
		} else {
			if (!patch.oldText) return false;
			const updated = removeBulletFromHtml(html, patch.oldText);
			if (updated === html) return false;
			current[lastKey] = updated;
		}
		return true;
	}

	return false;
}

function getScoreColor(score: number) {
	if (score >= 80) return { text: "text-green-600", border: "border-green-500", bg: "bg-green-500" };
	if (score >= 60) return { text: "text-amber-600", border: "border-amber-500", bg: "bg-amber-500" };
	return { text: "text-red-600", border: "border-red-500", bg: "bg-red-500" };
}

function getScoreLabel(score: number): string {
	if (score >= 80) return t`Excellent`;
	if (score >= 60) return t`Good`;
	if (score >= 40) return t`Needs Work`;
	return t`Poor`;
}
