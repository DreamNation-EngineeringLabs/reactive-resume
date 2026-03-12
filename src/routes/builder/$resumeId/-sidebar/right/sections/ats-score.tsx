import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	ArrowCounterClockwiseIcon,
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
import { useMutation } from "@tanstack/react-query";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useResumeStore, flushResumeSync } from "@/components/resume/store/resume";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { orpc } from "@/integrations/orpc/client";
import type { JsonPatchOp, Suggestion, ScoringResult, CategoryScore } from "@/integrations/orpc/services/ats";
import { cn } from "@/utils/style";
import { useBuilderSidebar } from "../../../-store/sidebar";
import { useSectionStore } from "../../../-store/section";
import { SectionBase } from "../shared/section-base";

export function ATSScoreSectionBuilder() {
	const [sheetOpen, setSheetOpen] = useState(false);
	const panelState = useATSPanelState();
	const { openAts } = useSearch({ from: "/builder/$resumeId" });
	const navigate = useNavigate();
	const { toggleSidebar, isCollapsed } = useBuilderSidebar();
	const setCollapsed = useSectionStore((s) => s.setCollapsed);

	// Auto-open ATS sheet when navigated with openAts=true (e.g. from dashboard)
	useEffect(() => {
		if (!openAts) return;
		if (isCollapsed("right")) toggleSidebar("right", true);
		setCollapsed("ats-score", false);
		setSheetOpen(true);
		navigate({ to: ".", search: { openAts: false }, replace: true });
	}, [openAts, navigate, toggleSidebar, isCollapsed, setCollapsed]);

	return (
		<>
			<SectionBase
				type="ats-score"
				extra={
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button size="icon" variant="ghost" className="size-8" onClick={() => setSheetOpen(true)}>
									<ArrowsOutIcon className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent><Trans>Expand</Trans></TooltipContent>
						</Tooltip>
					</TooltipProvider>
				}
			>
				<ATSScorePanel state={panelState} />
			</SectionBase>

			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent
					side="right"
					style={{ maxWidth: "none", width: "60vw" }}
					className="sm:my-3 sm:me-3 sm:h-[calc(100%-1.5rem)] sm:rounded-2xl sm:border p-0 flex flex-col gap-0 overflow-hidden max-sm:w-full"
				>
					<SheetHeader className="border-b px-6 py-4">
						<SheetTitle className="flex items-center gap-2 text-lg">
							<TargetIcon className="size-5" />
							<Trans>ATS Score Analysis</Trans>
						</SheetTitle>
						<SheetDescription>
							<Trans>Score your resume for ATS compatibility and get detailed feedback by category.</Trans>
						</SheetDescription>
					</SheetHeader>
					<ATSScoreSheetBody state={panelState} />
				</SheetContent>
			</Sheet>
		</>
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

	const storageKey = `ats-score-${params.resumeId}`;

	const [jobDescription, setJobDescription] = useState(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) return (JSON.parse(saved) as { jd?: string }).jd ?? "";
		} catch { /* ignore */ }
		return "";
	});
	const [result, setResult] = useState<ScoringResult | null>(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) return (JSON.parse(saved) as { result?: ScoringResult }).result ?? null;
		} catch { /* ignore */ }
		return null;
	});
	const [appliedIds, setAppliedIds] = useState<Set<string>>(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const arr = (JSON.parse(saved) as { applied?: string[] }).applied;
				return arr ? new Set(arr) : new Set();
			}
		} catch { /* ignore */ }
		return new Set();
	});
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const arr = (JSON.parse(saved) as { dismissed?: string[] }).dismissed;
				return arr ? new Set(arr) : new Set();
			}
		} catch { /* ignore */ }
		return new Set();
	});

	// Persist state changes to localStorage
	useEffect(() => {
		try {
			localStorage.setItem(storageKey, JSON.stringify({
				result,
				jd: jobDescription,
				applied: [...appliedIds],
				dismissed: [...dismissedIds],
			}));
		} catch { /* ignore full storage */ }
	}, [storageKey, result, jobDescription, appliedIds, dismissedIds]);

	const { mutate: scoreResume, isPending } = useMutation(
		orpc.ats.score.mutationOptions({
			onSuccess: (data) => {
				setResult(data as ScoringResult);
				setAppliedIds(new Set());
				setDismissedIds(new Set());
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
		(patches: JsonPatchOp[]) => {
			updateResumeData((draft) => {
				for (const patch of patches) {
					applyJsonPatch(draft, patch);
				}
			});
		},
		[updateResumeData],
	);

	const handleApply = useCallback(
		(suggestion: Suggestion) => {
			if (!suggestion.patches?.length) return;
			applyPatches(suggestion.patches);
			setAppliedIds((prev) => new Set(prev).add(suggestion.id));
			toast.success(t`Suggestion applied`);
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
		for (const suggestion of toApply) {
			applyPatches(suggestion.patches!);
			setAppliedIds((prev) => new Set(prev).add(suggestion.id));
		}
		toast.success(t`Applied ${toApply.length} suggestions`);
	}, [result, appliedIds, dismissedIds, applyPatches]);

	const pendingSuggestions = useMemo(
		() => result?.suggestions.filter((s) => !appliedIds.has(s.id) && !dismissedIds.has(s.id)) ?? [],
		[result, appliedIds, dismissedIds],
	);

	const applicablePendingCount = useMemo(
		() => pendingSuggestions.filter((s) => s.autoApplicable && s.patches?.length).length,
		[pendingSuggestions],
	);

	return {
		jobDescription, setJobDescription,
		result, setResult,
		appliedIds, setAppliedIds,
		dismissedIds, setDismissedIds,
		isPending, handleScore,
		handleApply, handleDismiss, handleApplyAll,
		pendingSuggestions, applicablePendingCount,
	};
}

function ATSScorePanel({ state }: { state: ATSPanelState }) {
	const {
		jobDescription, setJobDescription,
		result,
		isPending, handleScore,
	} = state;

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<p className="text-muted-foreground text-sm">
					<Trans>Paste a job description to score your resume against it, or score without one for general ATS checks.</Trans>
				</p>
				<Textarea
					value={jobDescription}
					onChange={(e) => setJobDescription(e.target.value)}
					placeholder={t`Paste job description here (optional)...`}
					rows={4}
					className="resize-none text-sm"
				/>
			</div>

			<Button onClick={handleScore} disabled={isPending} className="w-full">
				{isPending ? (
					<>
						<CircleNotchIcon className="mr-2 size-4 animate-spin" />
						<Trans>Scoring...</Trans>
					</>
				) : (
					<>
						<MagnifyingGlassIcon className="mr-2 size-4" />
						<Trans>Score My Resume</Trans>
					</>
				)}
			</Button>

			{result && (
				<>
					<Separator />
					<ScoreOverview result={result} />
				</>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Sheet body — the expanded ATS panel
// ---------------------------------------------------------------------------

function ATSScoreSheetBody({ state }: { state: ATSPanelState }) {
	const {
		jobDescription, setJobDescription,
		result,
		appliedIds, dismissedIds,
		isPending, handleScore,
		handleApply, handleDismiss, handleApplyAll,
		applicablePendingCount,
	} = state;

	const categories = useMemo(() => getCategories(result), [result]);

	return (
		<ScrollArea className="flex-1 min-h-0">
			<div className="p-6 space-y-6">
				{/* Job description input */}
				<div className="space-y-2">
					<p className="text-muted-foreground text-sm">
						<Trans>Paste a job description to score your resume against it, or score without one for general ATS checks.</Trans>
					</p>
					<Textarea
						value={jobDescription}
						onChange={(e) => setJobDescription(e.target.value)}
						placeholder={t`Paste job description here (optional)...`}
						rows={3}
						className="resize-none text-sm"
					/>
				</div>

				<Button onClick={handleScore} disabled={isPending} className="w-full">
					{isPending ? (
						<>
							<CircleNotchIcon className="mr-2 size-4 animate-spin" />
							<Trans>Scoring...</Trans>
						</>
					) : (
						<>
							<MagnifyingGlassIcon className="mr-2 size-4" />
							<Trans>Score My Resume</Trans>
						</>
					)}
				</Button>

				{result && (
					<>
						{/* Overall score ring + summary bar */}
						<div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border bg-muted/30 p-6">
							<ScoreRing score={result.overall} />
							<div className="flex-1 space-y-3 w-full">
								<p className="text-center sm:text-left text-muted-foreground text-sm">
									{result.metadata.jdProvided ? (
										<Trans>Scored against your job description</Trans>
									) : (
										<Trans>General ATS compatibility score</Trans>
									)}
								</p>
								{/* Mini category bars */}
								<div className="grid grid-cols-2 gap-x-4 gap-y-2">
									{categories.map((cat) => {
										const pct = cat.score.max > 0 ? Math.round((cat.score.score / cat.score.max) * 100) : 0;
										const color = getScoreColor(pct);
										return (
											<div key={cat.key} className="space-y-0.5">
												<div className="flex items-center justify-between text-xs">
													<span className="truncate">{cat.label}</span>
													<span className={cn("font-medium tabular-nums", color.text)}>
														{cat.score.score}/{cat.score.max}
													</span>
												</div>
												<div className="h-1.5 w-full rounded-full bg-muted">
													<div className={cn("h-full rounded-full transition-all", color.bg)} style={{ width: `${pct}%` }} />
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>

						{/* Missing keywords (JD) */}
						{result.metadata.jdProvided && result.metadata.keywordsMissing.length > 0 && (
							<MissingKeywords keywords={result.metadata.keywordsMissing} matched={result.metadata.keywordsMatched} />
						)}

						{/* Tabbed category sections */}
						<Tabs defaultValue={categories[0]?.key ?? "keywordMatch"}>
							<TabsList className="w-full flex-wrap lg:w-auto lg:flex-nowrap">
								{categories.map((cat) => {
									const pct = cat.score.max > 0 ? Math.round((cat.score.score / cat.score.max) * 100) : 0;
									const color = getScoreColor(pct);
									return (
										<TabsTrigger key={cat.key} value={cat.key} className="gap-1.5">
											<span>{cat.label}</span>
											<Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", color.text)}>
												{cat.score.score}/{cat.score.max}
											</Badge>
										</TabsTrigger>
									);
								})}
							</TabsList>

							{categories.map((cat) => {
								const categorySuggestions = result.suggestions.filter((s) => s.category === cat.key);
								return (
									<TabsContent key={cat.key} value={cat.key}>
										<CategoryDetailPanel
											category={cat}
											suggestions={categorySuggestions}
											appliedIds={appliedIds}
											dismissedIds={dismissedIds}
											onApply={handleApply}
											onDismiss={handleDismiss}
											jdProvided={result.metadata.jdProvided}
										/>
									</TabsContent>
								);
							})}
						</Tabs>

						{/* Apply all + re-score */}
						<div className="flex flex-col sm:flex-row items-center gap-2">
							{applicablePendingCount > 1 && (
								<Button variant="default" onClick={handleApplyAll} className="w-full sm:w-auto">
									<LightningIcon className="mr-1.5 size-4" />
									<Trans>Apply All Suggestions ({applicablePendingCount})</Trans>
								</Button>
							)}
							<Button variant="outline" onClick={handleScore} disabled={isPending} className="w-full sm:w-auto">
								<ArrowCounterClockwiseIcon className="mr-1.5 size-4" />
								<Trans>Re-score Resume</Trans>
							</Button>
						</div>
					</>
				)}
			</div>
		</ScrollArea>
	);
}

// ---------------------------------------------------------------------------
// Score ring (large)
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
	const color = getScoreColor(score);
	const circumference = 2 * Math.PI * 54; // r=54
	const offset = circumference - (score / 100) * circumference;

	return (
		<div className="relative flex size-28 shrink-0 items-center justify-center">
			<svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
				<circle cx="60" cy="60" r="54" fill="none" strokeWidth="8" className="stroke-muted" />
				<circle
					cx="60" cy="60" r="54" fill="none" strokeWidth="8"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					className={cn(
						"transition-all duration-700",
						score >= 80 ? "stroke-green-500" : score >= 60 ? "stroke-amber-500" : "stroke-red-500",
					)}
				/>
			</svg>
			<div className="text-center">
				<span className={cn("font-bold text-3xl tabular-nums", color.text)}>{score}</span>
				<p className={cn("font-medium text-xs", color.text)}>{getScoreLabel(score)}</p>
			</div>
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
			<p className="text-center text-muted-foreground text-xs">
				{result.metadata.jdProvided ? (
					<Trans>Scored against your job description</Trans>
				) : (
					<Trans>General ATS compatibility score</Trans>
				)}
			</p>
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
}: {
	category: CategoryInfo;
	suggestions: Suggestion[];
	appliedIds: Set<string>;
	dismissedIds: Set<string>;
	onApply: (s: Suggestion) => void;
	onDismiss: (id: string) => void;
	jdProvided: boolean;
}) {
	const passedRules = category.score.details.filter((r) => r.score >= r.maxScore);
	const deductedRules = category.score.details.filter((r) => r.score < r.maxScore);
	const pendingSuggestions = suggestions.filter((s) => !appliedIds.has(s.id) && !dismissedIds.has(s.id));
	const appliedSuggestions = suggestions.filter((s) => appliedIds.has(s.id));

	return (
		<div className="space-y-5 pt-4">
			{/* What's Good */}
			{passedRules.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-sm text-green-600">
						<CheckCircleIcon weight="fill" className="size-4" />
						<Trans>What's Good</Trans>
					</h4>
					<div className="space-y-1.5">
						{passedRules.map((rule) => (
							<div key={rule.ruleId} className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2">
								<CheckCircleIcon weight="fill" className="mt-0.5 size-3.5 shrink-0 text-green-500" />
								<span className="text-xs text-green-800 dark:text-green-300">
									{rule.details || rule.ruleName}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* What Needs Improvement */}
			{deductedRules.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-sm text-amber-600">
						<WarningCircleIcon weight="fill" className="size-4" />
						<Trans>Needs Improvement</Trans>
					</h4>
					<div className="space-y-1.5">
						{deductedRules.map((rule) => (
							<div key={rule.ruleId} className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
								<WarningIcon weight="fill" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
								<div className="text-xs">
									<span className="font-medium text-amber-800 dark:text-amber-300">
										-{rule.maxScore - rule.score} pts
									</span>
									<span className="text-amber-700 dark:text-amber-400 ml-1.5">
										{rule.details || rule.ruleName}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Actionable Suggestions */}
			{pendingSuggestions.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-sm text-blue-600">
						<LightningIcon weight="fill" className="size-4" />
						<Trans>How to Improve</Trans>
						{jdProvided && (
							<Badge variant="outline" className="text-[10px] ml-1">
								<Trans>JD-matched</Trans>
							</Badge>
						)}
					</h4>
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
				</div>
			)}

			{/* Applied suggestions */}
			{appliedSuggestions.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-sm text-muted-foreground">
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
				<p className="text-center text-green-600 text-sm py-4">
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
					<h4 className="flex items-center gap-1.5 font-semibold text-sm text-green-600">
						<CheckCircleIcon weight="fill" className="size-4" />
						<Trans>Matched Keywords</Trans>
						<Badge variant="secondary" className="text-[10px]">{matched.length}</Badge>
					</h4>
					<div className="flex flex-wrap gap-1.5">
						{matched.map((kw) => (
							<Badge key={kw} className="text-xs bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-800">
								{kw}
							</Badge>
						))}
					</div>
				</div>
			)}

			<div className="space-y-2">
				<h4 className="flex items-center gap-1.5 font-semibold text-sm text-red-600">
					<XCircleIcon weight="fill" className="size-4" />
					<Trans>Missing Keywords</Trans>
					<Badge variant="secondary" className="text-[10px]">{keywords.length}</Badge>
				</h4>
				<div className="flex flex-wrap gap-1.5">
					{displayed.map((kw) => (
						<Badge key={kw} variant="outline" className="text-xs border-red-200 text-red-700 dark:border-red-800 dark:text-red-400">
							{kw}
						</Badge>
					))}
				</div>
				{keywords.length > 10 && (
					<button
						type="button"
						onClick={() => setShowAll(!showAll)}
						className="text-xs text-primary hover:underline"
					>
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
					<p className="mt-1 text-muted-foreground text-xs">{suggestion.description}</p>

					{suggestion.diff.hunks.length > 0 && (
						<DiffView hunks={suggestion.diff.hunks} />
					)}

					<div className="mt-2 flex items-center gap-2">
						{applied ? (
							<span className="flex items-center gap-1 text-xs text-green-600">
								<CheckCircleIcon className="size-3.5" />
								<Trans>Applied</Trans>
							</span>
						) : (
							<>
								{suggestion.autoApplicable && suggestion.patches?.length ? (
									<Button size="sm" variant="outline" onClick={() => onApply(suggestion)} className="h-7 text-xs">
										<TargetIcon className="mr-1 size-3" />
										<Trans>Apply</Trans>
									</Button>
								) : null}
								<Button
									size="sm"
									variant="ghost"
									onClick={() => onDismiss(suggestion.id)}
									className="h-7 text-xs text-muted-foreground"
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
			? [{ key: "tailoring", label: t`Tailoring`, score: result.categories.tailoring }]
			: []),
	];
}

function applyJsonPatch(draft: Record<string, unknown>, patch: JsonPatchOp) {
	const pathParts = patch.path.split("/").filter(Boolean);
	if (pathParts.length === 0) return;

	if (patch.op === "replace" || patch.op === "add") {
		let current: Record<string, unknown> = draft;
		for (let i = 0; i < pathParts.length - 1; i++) {
			const key = pathParts[i]!;
			if (current[key] == null) return;
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
	} else if (patch.op === "remove") {
		let current: Record<string, unknown> = draft;
		for (let i = 0; i < pathParts.length - 1; i++) {
			const key = pathParts[i]!;
			if (current[key] == null) return;
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
	}
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
