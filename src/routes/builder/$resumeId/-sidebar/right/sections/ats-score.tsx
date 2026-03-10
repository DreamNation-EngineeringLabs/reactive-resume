import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	ArrowCounterClockwiseIcon,
	ArrowsOutIcon,
	CaretDownIcon,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { orpc } from "@/integrations/orpc/client";
import type { JsonPatchOp, Suggestion, ScoringResult, CategoryScore } from "@/integrations/orpc/services/ats";
import { cn } from "@/utils/style";
import { useBuilderSidebar } from "../../../-store/sidebar";
import { useSectionStore } from "../../../-store/section";
import { SectionBase } from "../shared/section-base";

export function ATSScoreSectionBuilder() {
	const [modalOpen, setModalOpen] = useState(false);
	const panelState = useATSPanelState();
	const { openAts } = useSearch({ from: "/builder/$resumeId" });
	const navigate = useNavigate();
	const { toggleSidebar, isCollapsed } = useBuilderSidebar();
	const setCollapsed = useSectionStore((s) => s.setCollapsed);

	// Auto-open ATS modal when navigated with openAts=true (e.g. from dashboard)
	useEffect(() => {
		if (!openAts) return;
		// Expand the right sidebar if collapsed
		if (isCollapsed("right")) toggleSidebar("right", true);
		// Uncollapse the ats-score section
		setCollapsed("ats-score", false);
		// Open the modal
		setModalOpen(true);
		// Clear the search param so it doesn't re-trigger
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
								<Button size="icon" variant="ghost" className="size-8" onClick={() => setModalOpen(true)}>
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

			<Dialog open={modalOpen} onOpenChange={setModalOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<TargetIcon className="size-5" />
							<Trans>ATS Score</Trans>
						</DialogTitle>
						<DialogDescription>
							<Trans>Score your resume for ATS compatibility and get suggestions to improve it.</Trans>
						</DialogDescription>
					</DialogHeader>
					<ATSScorePanel state={panelState} />
				</DialogContent>
			</Dialog>
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
		appliedIds, dismissedIds,
		isPending, handleScore,
		handleApply, handleDismiss, handleApplyAll,
		pendingSuggestions, applicablePendingCount,
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
					<Separator />
					<CategoryBreakdown result={result} />

					{result.metadata.jdProvided && result.metadata.keywordsMissing.length > 0 && (
						<>
							<Separator />
							<MissingKeywords keywords={result.metadata.keywordsMissing} />
						</>
					)}

					{result.suggestions.length > 0 && (
						<>
							<Separator />
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-sm">
									<Trans>Suggestions</Trans>
									{pendingSuggestions.length > 0 && (
										<Badge variant="secondary" className="ml-2">
											{pendingSuggestions.length}
										</Badge>
									)}
								</h3>
								{applicablePendingCount > 1 && (
									<Button size="sm" variant="outline" onClick={handleApplyAll}>
										<LightningIcon className="mr-1 size-3" />
										<Trans>Apply All</Trans>
									</Button>
								)}
							</div>

							<div className="space-y-3">
								{result.suggestions.map((suggestion) => (
									<SuggestionCard
										key={suggestion.id}
										suggestion={suggestion}
										applied={appliedIds.has(suggestion.id)}
										dismissed={dismissedIds.has(suggestion.id)}
										onApply={handleApply}
										onDismiss={handleDismiss}
									/>
								))}
							</div>

							{pendingSuggestions.length === 0 && result.suggestions.length > 0 && (
								<p className="text-center text-muted-foreground text-sm">
									<Trans>All suggestions have been handled. Re-score to see updated results.</Trans>
								</p>
							)}

							<Button variant="outline" onClick={handleScore} disabled={isPending} className="w-full">
								<ArrowCounterClockwiseIcon className="mr-2 size-4" />
								<Trans>Re-score Resume</Trans>
							</Button>
						</>
					)}
				</>
			)}
		</div>
	);
}

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

type CategoryInfo = {
	key: string;
	label: string;
	score: CategoryScore;
};

function CategoryBreakdown({ result }: { result: ScoringResult }) {
	const [expanded, setExpanded] = useState(false);

	const categories: CategoryInfo[] = [
		{ key: "keywordMatch", label: t`Keyword Match`, score: result.categories.keywordMatch },
		{ key: "impactMetrics", label: t`Impact & Metrics`, score: result.categories.impactMetrics },
		{ key: "structure", label: t`Structure`, score: result.categories.structure },
		{ key: "formatting", label: t`Formatting`, score: result.categories.formatting },
		{ key: "brevity", label: t`Brevity`, score: result.categories.brevity },
		...(result.categories.tailoring
			? [{ key: "tailoring", label: t`Tailoring`, score: result.categories.tailoring }]
			: []),
	];

	return (
		<div className="space-y-2">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center justify-between text-sm font-semibold"
			>
				<Trans>Category Breakdown</Trans>
				<CaretDownIcon className={cn("size-4 transition-transform", expanded && "rotate-180")} />
			</button>

			{expanded && (
				<div className="space-y-3">
					{categories.map((cat) => (
						<CategoryBar key={cat.key} label={cat.label} score={cat.score} />
					))}
				</div>
			)}
		</div>
	);
}

function CategoryBar({ label, score }: { label: string; score: CategoryScore }) {
	const pct = score.max > 0 ? Math.round((score.score / score.max) * 100) : 0;
	const color = getScoreColor(pct);
	const deductedRules = score.details.filter((r) => r.score < r.maxScore);

	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between text-xs">
				<span>{label}</span>
				<span className={cn("font-medium", color.text)}>
					{score.score}/{score.max}
				</span>
			</div>
			<div className="h-1.5 w-full rounded-full bg-muted">
				<div className={cn("h-full rounded-full transition-all", color.bg)} style={{ width: `${pct}%` }} />
			</div>
			{deductedRules.length > 0 && (
				<div className="mt-1 space-y-1">
					{deductedRules.map((rule) => (
						<p key={rule.ruleId} className="text-muted-foreground text-xs leading-snug">
							<span className="font-medium text-amber-600">-{rule.maxScore - rule.score}</span>{" "}
							{rule.details || rule.ruleName}
						</p>
					))}
				</div>
			)}
		</div>
	);
}

function MissingKeywords({ keywords }: { keywords: string[] }) {
	const [showAll, setShowAll] = useState(false);
	const displayed = showAll ? keywords : keywords.slice(0, 8);

	return (
		<div className="space-y-2">
			<h3 className="font-semibold text-sm">
				<Trans>Missing Keywords</Trans>
			</h3>
			<div className="flex flex-wrap gap-1.5">
				{displayed.map((kw) => (
					<Badge key={kw} variant="outline" className="text-xs">
						{kw}
					</Badge>
				))}
			</div>
			{keywords.length > 8 && (
				<button
					type="button"
					onClick={() => setShowAll(!showAll)}
					className="text-xs text-primary hover:underline"
				>
					{showAll ? <Trans>Show less</Trans> : <Trans>+{keywords.length - 8} more</Trans>}
				</button>
			)}
		</div>
	);
}

type SuggestionCardProps = {
	suggestion: Suggestion;
	applied: boolean;
	dismissed: boolean;
	onApply: (suggestion: Suggestion) => void;
	onDismiss: (id: string) => void;
};

function SuggestionCard({ suggestion, applied, dismissed, onApply, onDismiss }: SuggestionCardProps) {
	const [showDiff, setShowDiff] = useState(false);

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
					<div className="flex items-start justify-between gap-2">
						<h4 className="font-medium text-sm leading-tight">{suggestion.title}</h4>
						{suggestion.estimatedScoreGain > 0 && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Badge variant="secondary" className="shrink-0 text-xs">
											+{suggestion.estimatedScoreGain}
										</Badge>
									</TooltipTrigger>
									<TooltipContent>
										<Trans>Estimated score improvement</Trans>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>
					<p className="mt-1 text-muted-foreground text-xs">{suggestion.description}</p>

					{suggestion.diff.hunks.length > 0 && (
						<button
							type="button"
							onClick={() => setShowDiff(!showDiff)}
							className="mt-1.5 text-xs text-primary hover:underline"
						>
							{showDiff ? <Trans>Hide diff</Trans> : <Trans>Show diff</Trans>}
						</button>
					)}

					{showDiff && suggestion.diff.hunks.length > 0 && (
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
