import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	ArrowCounterClockwiseIcon,
	ArrowLeftIcon,
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
import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import type { CategoryScore, JsonPatchOp, ScoringResult, Suggestion } from "@/integrations/orpc/services/ats";
import { removeBulletFromHtml, replaceBulletInHtml } from "@/integrations/orpc/services/ats/html-utils";
import { generatePrinterToken } from "@/utils/printer-token";
import { cn } from "@/utils/style";

// ---------------------------------------------------------------------------
// Server fn — generates a time-limited printer token so we can iframe the resume
// ---------------------------------------------------------------------------

const getPreviewToken = createServerFn({ method: "GET" })
	.inputValidator(z.string())
	.handler(async ({ data }) => generatePrinterToken(data));

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/dashboard/ats-score/$resumeId/")({
	component: ATSResultPage,
	loader: async ({ params }) => {
		const printerToken = await getPreviewToken({ data: params.resumeId });
		return { printerToken };
	},
});

type ResumeListItem = RouterOutput["resume"]["list"][number];

type CategoryInfo = {
	key: string;
	label: string;
	score: CategoryScore;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ATSResultPage() {
	const params = useParams({ from: "/dashboard/ats-score/$resumeId/" });
	const { printerToken } = Route.useLoaderData();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: resume } = useQuery(orpc.resume.getById.queryOptions({ input: { id: params.resumeId } }));

	// Printer iframe URL — real resume rendered at /printer/:id?token=...
	// Use relative URL (works in both dev and prod)
	const iframeUrl = `/printer/${params.resumeId}?token=${printerToken}`;

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

	const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
	const [selectedCategory, setSelectedCategory] = useState<string>("keywordMatch");

	useEffect(() => {
		try {
			localStorage.setItem(storageKey, JSON.stringify({ result, jd: jobDescription }));
		} catch { /* ignore */ }
	}, [storageKey, result, jobDescription]);

	// Score mutation
	const { mutate: scoreResume, isPending: isScoring } = useMutation(
		orpc.ats.score.mutationOptions({
			onSuccess: (data) => {
				setResult(data as ScoringResult);
				setAppliedIds(new Set());
				setDismissedIds(new Set());
				setSelectedCategory("keywordMatch");
			},
			onError: (error) => toast.error(error.message || t`Failed to score resume. Please try again.`),
		}),
	);

	// Apply suggestion directly to DB
	const { mutateAsync: updateResume, isPending: isApplying } = useMutation(
		orpc.resume.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(orpc.resume.getById.queryOptions({ input: { id: params.resumeId } }));
				queryClient.invalidateQueries(orpc.printer.getResumeScreenshot.queryOptions({ input: { id: params.resumeId } }));
			},
		}),
	);

	const handleScore = useCallback(() => {
		scoreResume({
			resumeId: params.resumeId,
			jobDescription: jobDescription.trim() || undefined,
			includeAiSuggestions: true,
		});
	}, [scoreResume, params.resumeId, jobDescription]);

	const handleAccept = useCallback(
		async (suggestion: Suggestion) => {
			if (!suggestion.patches?.length || !resume?.data) return;
			const updatedData = structuredClone(resume.data) as Record<string, unknown>;
			let allOk = true;
			for (const patch of suggestion.patches) {
				if (!applyJsonPatch(updatedData, patch)) allOk = false;
			}
			if (!allOk) {
				toast.error(t`Could not apply — re-score for fresh suggestions`);
				return;
			}
			try {
				await updateResume({ id: params.resumeId, data: updatedData as ResumeListItem["data"] });
				setAppliedIds((prev) => new Set(prev).add(suggestion.id));
				toast.success(t`Suggestion applied to your resume`);
			} catch {
				toast.error(t`Failed to save changes`);
			}
		},
		[resume?.data, updateResume, params.resumeId],
	);

	const handleDismiss = useCallback((id: string) => {
		setDismissedIds((prev) => new Set(prev).add(id));
	}, []);

	const categories = useMemo(() => getCategories(result), [result]);

	const selectedCategoryInfo = useMemo(
		() => categories.find((c) => c.key === selectedCategory) ?? categories[0],
		[categories, selectedCategory],
	);

	const categorySuggestions = useMemo(
		() =>
			result?.suggestions.filter(
				(s) => s.category === selectedCategory && !appliedIds.has(s.id) && !dismissedIds.has(s.id),
			) ?? [],
		[result, selectedCategory, appliedIds, dismissedIds],
	);

	const totalPending = useMemo(
		() => result?.suggestions.filter((s) => !appliedIds.has(s.id) && !dismissedIds.has(s.id)).length ?? 0,
		[result, appliedIds, dismissedIds],
	);

	return (
		<div className="flex h-full flex-col">
			{/* ── Top bar ── */}
			<div className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-2.5">
				<div className="flex items-center gap-2">
					<Link to="/dashboard/ats-score">
						<Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
							<ArrowLeftIcon className="size-3.5" />
							<Trans>Back</Trans>
						</Button>
					</Link>
					<div className="h-4 w-px bg-border" />
					<TargetIcon className="size-4 text-muted-foreground" />
					<span className="font-semibold text-sm">{resume?.name ?? t`ATS Score`}</span>
				</div>
				<div className="flex items-center gap-2">
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm" disabled={isScoring} className="gap-1.5">
								{isScoring ? <CircleNotchIcon className="size-3.5 animate-spin" /> : <ArrowCounterClockwiseIcon className="size-3.5" />}
								<Trans>Re-score</Trans>
							</Button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-80 space-y-3 p-4">
							<div>
								<p className="font-semibold text-sm"><Trans>Change Job Description</Trans></p>
								<p className="mt-0.5 text-muted-foreground text-xs"><Trans>Paste a job description to score against, or leave blank for a general ATS check.</Trans></p>
							</div>
							<Textarea
								value={jobDescription}
								onChange={(e) => setJobDescription(e.target.value)}
								placeholder={t`Paste job description here (optional)...`}
								rows={5}
								className="resize-none text-xs"
							/>
							<Button onClick={handleScore} disabled={isScoring} size="sm" className="w-full gap-1.5">
								{isScoring ? (
									<><CircleNotchIcon className="size-3.5 animate-spin" /><Trans>Scoring...</Trans></>
								) : (
									<><ArrowCounterClockwiseIcon className="size-3.5" /><Trans>Re-score Resume</Trans></>
								)}
							</Button>
						</PopoverContent>
					</Popover>
					<Button
						size="sm"
						onClick={() => navigate({ to: "/builder/$resumeId", params: { resumeId: params.resumeId } })}
					>
						<Trans>Open in Builder</Trans>
					</Button>
				</div>
			</div>

			{/* ── 3-column body ── */}
			<div className="flex flex-1 overflow-hidden">

				{/* ═══ Column 1 — Score + Categories + Keywords ═══ */}
				<div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r bg-slate-50 dark:bg-slate-950/30">
					{/* Score ring */}
					<div className="flex flex-col items-center gap-1 border-b px-5 py-5">
						<ScoreRing score={result?.overall ?? 0} hasResult={!!result} />
						{result && (
							<p className="mt-1 text-center text-muted-foreground text-[11px]">
								{result.metadata.jdProvided ? <Trans>vs. job description</Trans> : <Trans>general ATS</Trans>}
							</p>
						)}
					</div>

					{result ? (
						<>
							{/* Category nav */}
							<div className="border-b px-3 py-3">
								<p className="mb-2 px-2 font-semibold text-muted-foreground text-[10px] uppercase tracking-widest">
									<Trans>Categories</Trans>
								</p>
								{categories.map((cat) => {
									const pct = cat.score.max > 0 ? Math.round((cat.score.score / cat.score.max) * 100) : 0;
									const color = getScoreColor(pct);
									const issues = result.suggestions.filter(
										(s) => s.category === cat.key && !appliedIds.has(s.id) && !dismissedIds.has(s.id),
									).length;
									const isSelected = selectedCategory === cat.key;
									return (
										<button
											key={cat.key}
											type="button"
											onClick={() => setSelectedCategory(cat.key)}
											className={cn(
												"flex w-full items-center justify-between rounded-lg px-2 py-2 text-start transition-colors",
												isSelected ? "bg-white shadow-sm dark:bg-slate-800" : "hover:bg-white/60 dark:hover:bg-slate-800/50",
											)}
										>
											<span className={cn("text-sm", isSelected ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
												{cat.label}
											</span>
											<div className="flex items-center gap-1.5">
												{issues > 0 && (
													<span className="min-w-[18px] rounded bg-red-100 px-1 text-center font-bold text-[10px] text-red-700 dark:bg-red-950/40 dark:text-red-400">
														{issues}
													</span>
												)}
												<span className={cn("font-semibold text-xs tabular-nums", color.text)}>
													{cat.score.score}/{cat.score.max}
												</span>
											</div>
										</button>
									);
								})}
								{totalPending === 0 && (
									<div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-center dark:bg-green-950/20">
										<p className="font-medium text-green-700 text-xs dark:text-green-400">
											<Trans>All addressed!</Trans>
										</p>
									</div>
								)}
							</div>

							{/* Keywords (moved from col 2) */}
							{result.metadata.jdProvided && (result.metadata.keywordsMatched.length > 0 || result.metadata.keywordsMissing.length > 0) && (
								<div className="px-4 py-4">
									<KeywordsPanel matched={result.metadata.keywordsMatched} missing={result.metadata.keywordsMissing} />
								</div>
							)}
						</>
					) : (
						/* Pre-score: job description input */
						<div className="flex flex-1 flex-col gap-3 p-4">
							<div className="flex flex-col items-center gap-2 py-4 text-center">
								<TargetIcon weight="duotone" className="size-10 text-muted-foreground/30" />
								<p className="text-muted-foreground text-xs"><Trans>Score your resume to see results</Trans></p>
							</div>
							<Textarea
								value={jobDescription}
								onChange={(e) => setJobDescription(e.target.value)}
								placeholder={t`Paste a job description (optional)...`}
								rows={5}
								className="resize-none text-xs"
							/>
							<Button onClick={handleScore} disabled={isScoring} size="sm" className="w-full gap-1.5">
								{isScoring ? (
									<><CircleNotchIcon className="size-3.5 animate-spin" /><Trans>Scoring...</Trans></>
								) : (
									<><MagnifyingGlassIcon className="size-3.5" /><Trans>Score My Resume</Trans></>
								)}
							</Button>
						</div>
					)}
				</div>

				{/* ═══ Column 2 — Feedback + Suggestions ═══ */}
				<div className="flex w-[28rem] shrink-0 flex-col overflow-y-auto border-r">
					{result ? (
						<div className="space-y-5 p-5">
							{/* Gradient bar + score headline + description */}
							<div className="space-y-3 border-b pb-5">
								<ScoreGradientBar score={result.overall} />
								<div>
									<h2 className="font-bold text-xl leading-tight">
										<Trans>Your resume scored {result.overall} out of 100.</Trans>
									</h2>
									<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
										{result.overall >= 80 ? (
											<Trans>Great job! Review the remaining suggestions to push it even higher.</Trans>
										) : result.overall >= 60 ? (
											<Trans>Your resume is on the right track but falls short in a few areas. Apply the suggestions below to improve your score.</Trans>
										) : (
											<Trans>Your resume needs significant improvements to pass ATS filters. Follow the suggestions below to boost your chances.</Trans>
										)}
									</p>
								</div>
							</div>

							{/* Category feedback for selected */}
							{selectedCategoryInfo && (
								<CategoryFeedbackPanel category={selectedCategoryInfo} jdProvided={result.metadata.jdProvided} />
							)}

							{/* ── Suggestions for selected category ── */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<h3 className="flex items-center gap-1.5 font-semibold text-blue-600 text-sm">
										<LightningIcon weight="fill" className="size-3.5" />
										<Trans>How to Improve</Trans>
									</h3>
									{categorySuggestions.length > 0 && (
										<Badge variant="secondary" className="text-[10px]">{categorySuggestions.length}</Badge>
									)}
								</div>

								{categorySuggestions.length > 0 ? (
									<div className="space-y-2">
										{categorySuggestions.map((s) => (
											<SuggestionCard
												key={s.id}
												suggestion={s}
												isApplying={isApplying}
												onAccept={() => handleAccept(s)}
												onDismiss={() => handleDismiss(s.id)}
											/>
										))}
									</div>
								) : (
									<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
										<CheckCircleIcon weight="fill" className="size-8 text-green-500" />
										<div>
											<p className="font-semibold text-green-600 text-sm"><Trans>All suggestions addressed!</Trans></p>
											<p className="mt-0.5 text-muted-foreground text-xs"><Trans>Select another category to see more</Trans></p>
										</div>
									</div>
								)}
							</div>
						</div>
					) : isScoring ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
							<CircleNotchIcon className="size-10 animate-spin text-muted-foreground/40" />
							<div>
								<p className="font-semibold text-muted-foreground text-sm"><Trans>Analyzing your resume...</Trans></p>
								<p className="mt-1 text-muted-foreground text-xs"><Trans>This may take a moment</Trans></p>
							</div>
						</div>
					) : (
						<div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
							<TargetIcon weight="duotone" className="size-10 text-muted-foreground/30" />
							<p className="text-muted-foreground text-sm"><Trans>Score your resume to see feedback here</Trans></p>
						</div>
					)}
				</div>

				{/* ═══ Column 3 — Actual Resume (iframe) ═══ */}
				<div className="relative flex flex-1 flex-col overflow-hidden bg-slate-100 dark:bg-slate-900">
					<div className="border-b bg-background/80 px-4 py-2 backdrop-blur-sm">
						<div className="flex items-center justify-between">
							<p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
								<Trans>Resume Preview</Trans>
							</p>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 gap-1 text-[11px] text-muted-foreground"
								onClick={() => navigate({ to: "/builder/$resumeId", params: { resumeId: params.resumeId } })}
							>
								<Trans>Edit in Builder</Trans>
							</Button>
						</div>
					</div>

					{/* Iframe container — scales the A4 resume to fit */}
					<div className="relative flex-1 overflow-hidden">
						<ResumeIframe url={iframeUrl} />
					</div>
				</div>

			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Resume iframe — scales actual printer page to fit column width
// ---------------------------------------------------------------------------

// A4 page width at 96 dpi
const A4_WIDTH = 794;

function ResumeIframe({ url }: { url: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const obs = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width ?? A4_WIDTH;
			setScale(w / A4_WIDTH);
		});
		obs.observe(el);
		return () => obs.disconnect();
	}, []);

	// Height of the iframe content at native scale, then shrunk via transform.
	// We use a tall fixed height (2x viewport) so the user can scroll the resume.
	const nativeHeight = Math.round(window.innerHeight * 2);

	return (
		<div ref={containerRef} className="absolute inset-0 overflow-y-auto overflow-x-hidden bg-slate-100 dark:bg-slate-900">
			{/* Outer div sets the visible (scaled) height so the scrollbar is correct */}
			<div style={{ height: nativeHeight * scale, width: "100%" }}>
				{/* Inner div is native A4 width, scaled down via CSS transform */}
				<div
					style={{
						width: A4_WIDTH,
						height: nativeHeight,
						transform: `scale(${scale})`,
						transformOrigin: "top left",
					}}
				>
					<iframe
						src={url}
						title="Resume Preview"
						style={{ width: A4_WIDTH, height: nativeHeight, border: "none" }}
					/>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Score ring
// ---------------------------------------------------------------------------

function ScoreRing({ score, hasResult }: { score: number; hasResult: boolean }) {
	const color = hasResult ? getScoreColor(score) : { text: "text-muted-foreground", bg: "bg-muted" };
	const circumference = 2 * Math.PI * 44;
	const offset = hasResult ? circumference - (score / 100) * circumference : circumference;

	return (
		<div className="relative flex size-28 shrink-0 items-center justify-center">
			<svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
				<circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" className="stroke-muted" />
				{hasResult && (
					<circle
						cx="50"
						cy="50"
						r="44"
						fill="none"
						strokeWidth="7"
						strokeDasharray={circumference}
						strokeDashoffset={offset}
						strokeLinecap="round"
						className={cn(
							"transition-all duration-700",
							score >= 80 ? "stroke-green-500" : score >= 60 ? "stroke-amber-500" : "stroke-red-500",
						)}
					/>
				)}
			</svg>
			<div className="text-center">
				{hasResult ? (
					<>
						<span className={cn("font-bold text-3xl tabular-nums leading-none", color.text)}>{score}</span>
						<p className={cn("mt-0.5 font-semibold text-[10px] uppercase tracking-wide", color.text)}>
							{getScoreLabel(score)}
						</p>
					</>
				) : (
					<span className="font-medium text-muted-foreground/40 text-sm">—</span>
				)}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Gradient bar
// ---------------------------------------------------------------------------

function ScoreGradientBar({ score }: { score: number }) {
	return (
		<div className="space-y-2">
			<div className="relative pb-6">
				<div
					className="h-2.5 w-full rounded-full"
					style={{ background: "linear-gradient(to right, #ef4444, #f59e0b 45%, #22c55e)" }}
				/>
				{/* Marker */}
				<div
					className="absolute top-0 h-2.5 w-0.5 rounded-full bg-slate-900 shadow-sm dark:bg-white"
					style={{ left: `calc(${Math.min(score, 100)}% - 1px)` }}
				/>
				{/* Label */}
				<div
					className="-translate-x-1/2 absolute top-4 whitespace-nowrap font-bold text-[9px] uppercase tracking-wide text-slate-700 dark:text-slate-300"
					style={{ left: `${Math.min(score, 100)}%` }}
				>
					<Trans>YOUR RESUME</Trans>
				</div>
			</div>
			<div className="flex justify-between text-[9px] text-muted-foreground">
				<span>0</span>
				<span className="font-medium uppercase tracking-wide"><Trans>Top Resumes →</Trans></span>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Keywords panel
// ---------------------------------------------------------------------------

function KeywordsPanel({ matched, missing }: { matched: string[]; missing: string[] }) {
	const [showAll, setShowAll] = useState(false);
	const displayedMissing = showAll ? missing : missing.slice(0, 8);

	return (
		<div className="space-y-3 rounded-xl border bg-muted/20 p-4">
			{matched.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-green-600 text-xs">
						<CheckCircleIcon weight="fill" className="size-3.5" />
						<Trans>Matched Keywords</Trans>
						<Badge variant="secondary" className="text-[9px] px-1">{matched.length}</Badge>
					</h4>
					<div className="flex flex-wrap gap-1">
						{matched.map((kw) => (
							<Badge key={kw} className="border-green-200 bg-green-100 text-[10px] text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">{kw}</Badge>
						))}
					</div>
				</div>
			)}
			{missing.length > 0 && (
				<div className="space-y-2">
					<h4 className="flex items-center gap-1.5 font-semibold text-red-600 text-xs">
						<XCircleIcon weight="fill" className="size-3.5" />
						<Trans>Missing Keywords</Trans>
						<Badge variant="secondary" className="text-[9px] px-1">{missing.length}</Badge>
					</h4>
					<div className="flex flex-wrap gap-1">
						{displayedMissing.map((kw) => (
							<Badge key={kw} variant="outline" className="border-red-200 text-[10px] text-red-700 dark:border-red-800 dark:text-red-400">{kw}</Badge>
						))}
					</div>
					{missing.length > 8 && (
						<button type="button" onClick={() => setShowAll(!showAll)} className="text-primary text-[10px] hover:underline">
							{showAll ? <Trans>Show less</Trans> : <Trans>+{missing.length - 8} more</Trans>}
						</button>
					)}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Category feedback panel
// ---------------------------------------------------------------------------

function CategoryFeedbackPanel({ category, jdProvided }: { category: CategoryInfo; jdProvided: boolean }) {
	const passedRules = category.score.details.filter((r) => r.score >= r.maxScore);
	const deductedRules = category.score.details.filter((r) => r.score < r.maxScore);
	const pct = category.score.max > 0 ? Math.round((category.score.score / category.score.max) * 100) : 0;
	const color = getScoreColor(pct);

	return (
		<div className="space-y-3">
			{/* Category header */}
			<div className="space-y-1.5">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-sm">{category.label}</h3>
					<span className={cn("font-bold text-sm tabular-nums", color.text)}>
						{category.score.score}/{category.score.max}
					</span>
				</div>
				<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
					<div
						className={cn("h-full rounded-full transition-all duration-700", color.bg)}
						style={{ width: `${pct}%` }}
					/>
				</div>
				{jdProvided && (
					<p className="text-[10px] text-muted-foreground"><Trans>Scored against your job description</Trans></p>
				)}
			</div>

			{/* What's Good */}
			{passedRules.length > 0 && (
				<div className="space-y-1">
					<p className="flex items-center gap-1.5 font-semibold text-green-600 text-xs">
						<CheckCircleIcon weight="fill" className="size-3.5" /><Trans>What's Good</Trans>
					</p>
					{passedRules.map((rule) => (
						<div key={rule.ruleId} className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 dark:bg-green-950/20">
							<CheckCircleIcon weight="fill" className="mt-0.5 size-3 shrink-0 text-green-500" />
							<span className="text-green-800 text-xs dark:text-green-300">{rule.details || rule.ruleName}</span>
						</div>
					))}
				</div>
			)}

			{/* Needs Improvement */}
			{deductedRules.length > 0 && (
				<div className="space-y-1">
					<p className="flex items-center gap-1.5 font-semibold text-amber-600 text-xs">
						<WarningCircleIcon weight="fill" className="size-3.5" /><Trans>Needs Improvement</Trans>
					</p>
					{deductedRules.map((rule) => (
						<div key={rule.ruleId} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
							<WarningIcon weight="fill" className="mt-0.5 size-3 shrink-0 text-amber-500" />
							<div className="text-xs">
								<span className="font-semibold text-amber-800 dark:text-amber-300">-{rule.maxScore - rule.score} pts </span>
								<span className="text-amber-700 dark:text-amber-400">{rule.details || rule.ruleName}</span>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Suggestion card — diff view with green/red highlighting
// ---------------------------------------------------------------------------

function SuggestionCard({
	suggestion,
	isApplying,
	onAccept,
	onDismiss,
}: {
	suggestion: Suggestion;
	isApplying: boolean;
	onAccept: () => void;
	onDismiss: () => void;
}) {
	const configs = {
		critical: { icon: XCircleIcon, color: "text-red-600", accent: "border-l-red-400", bg: "bg-red-50/50 dark:bg-red-950/10" },
		warning: { icon: WarningCircleIcon, color: "text-amber-600", accent: "border-l-amber-400", bg: "bg-amber-50/50 dark:bg-amber-950/10" },
		info: { icon: WarningIcon, color: "text-blue-600", accent: "border-l-blue-400", bg: "bg-blue-50/50 dark:bg-blue-950/10" },
	};
	const cfg = configs[suggestion.severity];
	const Icon = cfg.icon;
	const canApply = suggestion.autoApplicable && !!suggestion.patches?.length;

	return (
		<div className={cn("overflow-hidden rounded-xl border border-l-4", cfg.accent, cfg.bg)}>
			<div className="px-3 py-3">
				<div className="flex items-start gap-2">
					<Icon weight="fill" className={cn("mt-0.5 size-3.5 shrink-0", cfg.color)} />
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-[13px] leading-snug">{suggestion.title}</p>
						<p className="mt-0.5 text-muted-foreground text-xs leading-snug">{suggestion.description}</p>
					</div>
				</div>

				{/* Diff — green/red change preview */}
				{suggestion.diff.hunks.length > 0 && (
					<div className="mt-2.5 overflow-hidden rounded-lg border bg-white font-mono text-[11px] dark:bg-slate-900">
						{suggestion.diff.hunks.map((hunk, i) => (
							<div key={i}>
								{hunk.context && (
									<div className="px-2.5 py-1 text-muted-foreground">{hunk.context}</div>
								)}
								{hunk.removed && (
									<div className="flex items-start gap-1.5 bg-red-50 px-2.5 py-1 dark:bg-red-950/30">
										<span className="mt-px select-none font-bold text-red-400 text-xs">−</span>
										<span className="text-red-700 dark:text-red-300">{hunk.removed}</span>
									</div>
								)}
								{hunk.added && (
									<div className="flex items-start gap-1.5 bg-green-50 px-2.5 py-1 dark:bg-green-950/30">
										<span className="mt-px select-none font-bold text-green-500 text-xs">+</span>
										<span className="text-green-800 dark:text-green-300">{hunk.added}</span>
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{/* Actions */}
				<div className="mt-2.5 flex items-center gap-2">
					{canApply ? (
						<>
							<Button
								size="sm"
								className="h-7 gap-1.5 bg-green-600 text-[11px] text-white hover:bg-green-700"
								onClick={onAccept}
								disabled={isApplying}
							>
								{isApplying ? <CircleNotchIcon className="size-3 animate-spin" /> : <CheckCircleIcon className="size-3" />}
								<Trans>Accept Change</Trans>
							</Button>
							<button type="button" onClick={onDismiss} className="text-[11px] text-muted-foreground hover:text-foreground">
								<Trans>Dismiss</Trans>
							</button>
						</>
					) : (
						<>
							<span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
								<Trans>Manual fix needed</Trans>
							</span>
							<button type="button" onClick={onDismiss} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">
								<Trans>Dismiss</Trans>
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getScoreColor(pct: number): { text: string; bg: string } {
	if (pct >= 75) return { text: "text-green-600", bg: "bg-green-500" };
	if (pct >= 50) return { text: "text-amber-600", bg: "bg-amber-500" };
	return { text: "text-red-600", bg: "bg-red-500" };
}

function getScoreLabel(score: number): string {
	if (score >= 85) return t`Excellent`;
	if (score >= 70) return t`Good`;
	if (score >= 50) return t`Needs Work`;
	return t`Poor`;
}

function applyJsonPatch(draft: Record<string, unknown>, patch: JsonPatchOp): boolean {
	const pathParts = patch.path.split("/").filter(Boolean);
	if (pathParts.length === 0) return false;

	if (patch.op === "replace" || patch.op === "add") {
		let cur: Record<string, unknown> = draft;
		for (let i = 0; i < pathParts.length - 1; i++) {
			const k = pathParts[i]!;
			if (cur[k] == null) return false;
			cur = cur[k] as Record<string, unknown>;
		}
		const last = pathParts[pathParts.length - 1]!;
		if (patch.op === "add" && Array.isArray(cur)) {
			if (last === "-") cur.push(patch.value);
			else {
				const idx = Number.parseInt(last, 10);
				if (!Number.isNaN(idx)) cur.splice(idx, 0, patch.value);
			}
		} else {
			cur[last] = patch.value;
		}
		return true;
	}

	if (patch.op === "remove") {
		let cur: Record<string, unknown> = draft;
		for (let i = 0; i < pathParts.length - 1; i++) {
			const k = pathParts[i]!;
			if (cur[k] == null) return false;
			cur = cur[k] as Record<string, unknown>;
		}
		const last = pathParts[pathParts.length - 1]!;
		if (Array.isArray(cur)) {
			const idx = Number.parseInt(last, 10);
			if (!Number.isNaN(idx)) cur.splice(idx, 1);
		} else {
			delete cur[last];
		}
		return true;
	}

	if (patch.op === "replace-bullet" || patch.op === "remove-bullet") {
		let cur: Record<string, unknown> = draft;
		for (let i = 0; i < pathParts.length - 1; i++) {
			const k = pathParts[i]!;
			if (cur[k] == null) return false;
			cur = cur[k] as Record<string, unknown>;
		}
		const last = pathParts[pathParts.length - 1]!;
		const html = cur[last];
		if (typeof html !== "string") return false;
		if (patch.op === "replace-bullet") {
			if (!patch.oldText || !patch.newText) return false;
			const updated = replaceBulletInHtml(html, patch.oldText, patch.newText);
			if (updated === html) return false;
			cur[last] = updated;
		} else {
			if (!patch.oldText) return false;
			const updated = removeBulletFromHtml(html, patch.oldText);
			if (updated === html) return false;
			cur[last] = updated;
		}
		return true;
	}

	return false;
}
