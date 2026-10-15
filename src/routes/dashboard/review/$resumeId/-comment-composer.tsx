import { t } from "@lingui/core/macro";
import { BookmarkSimpleIcon, PaperPlaneTiltIcon, PencilSimpleLineIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RefObject, useMemo, useState } from "react";
import { anchorLabel, severityLabel } from "@/components/resume/review-anchors";
import { orpc } from "@/integrations/orpc/client";
import type { CommentAnchor, CommentSeverity } from "@/schema/resume/comment-anchor";
import type { ResumeData } from "@/schema/resume/data";
import { cn } from "@/utils/style";

// Same colours as the highlighter on the resume.
const SEVERITY_ON = {
	LOW: "bg-emerald-50 text-emerald-800 ring-emerald-500",
	MEDIUM: "bg-amber-50 text-amber-800 ring-amber-500",
	HIGH: "bg-rose-50 text-rose-800 ring-rose-500",
};
const SEVERITY_DOT = { LOW: "bg-emerald-500", MEDIUM: "bg-amber-400", HIGH: "bg-rose-500" };

type Props = {
	resumeData: ResumeData;
	anchor: CommentAnchor | null;
	onClearAnchor: () => void;
	replyTo: string | null;
	onCancelReply: () => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	isPending: boolean;
	onSubmit: (input: { content: string; severity?: CommentSeverity; suggestion?: string }) => Promise<unknown>;
};

const CHIP_LIMIT = 8;

/**
 * The reviewer's comment box: what the comment points at, severity, an optional rewrite for the quoted
 * text, and the tenant's shared comment bank (chips, `#` search, save, manage with usage counts).
 */
export function CommentComposer({
	resumeData,
	anchor,
	onClearAnchor,
	replyTo,
	onCancelReply,
	inputRef,
	isPending,
	onSubmit,
}: Props) {
	const queryClient = useQueryClient();
	const [content, setContent] = useState("");
	const [caret, setCaret] = useState(0);
	const [severity, setSeverity] = useState<CommentSeverity | null>(null);
	const [suggestion, setSuggestion] = useState<string | null>(null);
	const [managing, setManaging] = useState(false);
	const [pick, setPick] = useState(0);
	const [hashClosed, setHashClosed] = useState(false);

	const listQuery = orpc.resume.reviewSnippets.list.queryOptions();
	const { data: snippets = [] } = useQuery(listQuery);
	const refreshBank = () => queryClient.invalidateQueries({ queryKey: listQuery.queryKey });
	const countUse = useMutation({ ...orpc.resume.reviewSnippets.use.mutationOptions(), onSuccess: refreshBank });
	const saveSnippet = useMutation({ ...orpc.resume.reviewSnippets.create.mutationOptions(), onSuccess: refreshBank });
	const deleteSnippet = useMutation({ ...orpc.resume.reviewSnippets.delete.mutationOptions(), onSuccess: refreshBank });

	const quote = anchor?.quote?.exact;
	const isReply = !!replyTo;

	// A rewrite belongs to the text it was written for: selecting other text starts without one.
	const [rewriteFor, setRewriteFor] = useState(quote);
	if (rewriteFor !== quote) {
		setRewriteFor(quote);
		setSuggestion(null);
	}

	// `#word` right before the caret searches the comment bank.
	const hashQuery = useMemo(() => /(?:^|\s)#([^\s#]*)$/.exec(content.slice(0, caret))?.[1] ?? null, [content, caret]);
	const matches = useMemo(() => {
		if (hashQuery === null || hashClosed) return [];
		const q = hashQuery.toLowerCase();
		return snippets.filter((s) => s.content.toLowerCase().includes(q)).slice(0, 6);
	}, [hashQuery, hashClosed, snippets]);

	const placeCaret = (position: number) =>
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.setSelectionRange(position, position);
			setCaret(position);
		});

	const insertSnippet = (snippet: { id: string; content: string }, replaceHash: boolean) => {
		const before = replaceHash ? content.slice(0, caret).replace(/#[^\s#]*$/, "") : content.trimEnd();
		const joined = before && !before.endsWith(" ") ? `${before} ${snippet.content}` : `${before}${snippet.content}`;
		const after = replaceHash ? content.slice(caret) : "";
		setContent(joined + after);
		placeCaret(joined.length);
		countUse.mutate({ id: snippet.id });
	};

	const submit = async () => {
		if (!content.trim() || isPending) return;
		const rewrite = suggestion?.trim();
		await onSubmit({
			content: content.trim(),
			severity: isReply ? undefined : (severity ?? undefined),
			suggestion: !isReply && quote && rewrite && rewrite !== quote ? rewrite : undefined,
		});
		setContent("");
		setSuggestion(null);
		setSeverity(null);
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (matches.length > 0) {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				setPick((p) => (p + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
				return;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				event.preventDefault();
				insertSnippet(matches[Math.min(pick, matches.length - 1)], true);
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				setHashClosed(true);
				return;
			}
		}
		if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			void submit();
		} else if (event.key === "Escape") {
			if (isReply) onCancelReply();
			else onClearAnchor();
		}
	};

	return (
		<div className="rounded-2xl bg-muted/50 p-4">
			<div className="mb-2 flex items-center justify-between">
				<p className="font-semibold text-foreground text-sm">{isReply ? t`Reply to Thread` : t`Add Feedback Comment`}</p>
				{isReply && (
					<button type="button" onClick={onCancelReply} className="text-primary text-xs hover:underline">
						{t`Cancel Reply`}
					</button>
				)}
			</div>

			{!isReply &&
				(anchor ? (
					<div className="mb-3 flex items-start gap-2 rounded-xl border-amber-400 border-l-4 bg-card px-3 py-2">
						<div className="min-w-0 flex-1">
							<p className="font-semibold text-[11px] text-muted-foreground">{anchorLabel(anchor, resumeData)}</p>
							<p className="line-clamp-2 text-foreground text-xs">{quote ? `“${quote}”` : t`Whole section`}</p>
						</div>
						<button
							type="button"
							aria-label={t`Remove the selected text from this comment`}
							onClick={onClearAnchor}
							className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
						>
							<XIcon className="size-3.5" />
						</button>
					</div>
				) : (
					<p className="mb-3 text-muted-foreground text-xs">
						{t`Select text on the resume to comment on that exact spot. Select a section title to comment on the whole section.`}
					</p>
				))}

			{!isReply && (
				<div className="mb-3 flex flex-wrap items-center gap-1.5">
					<span className="text-muted-foreground text-xs">{t`Severity (optional)`}</span>
					{(["LOW", "MEDIUM", "HIGH"] as const).map((level) => (
						<button
							key={level}
							type="button"
							aria-pressed={severity === level}
							onClick={() => setSeverity(severity === level ? null : level)}
							className={cn(
								"flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-xs ring-1 transition-all",
								severity === level ? SEVERITY_ON[level] : "bg-card text-muted-foreground ring-border hover:bg-muted",
							)}
						>
							<span className={cn("size-2 rounded-full", SEVERITY_DOT[level])} />
							{severityLabel(level)}
						</button>
					))}

					{quote && suggestion === null && (
						<button
							type="button"
							onClick={() => setSuggestion(quote)}
							className="ms-auto flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-primary text-xs hover:bg-primary/5"
						>
							<PencilSimpleLineIcon className="size-3.5" />
							{t`Suggest a rewrite`}
						</button>
					)}
				</div>
			)}

			{!isReply && quote && suggestion !== null && (
				<div className="mb-3 rounded-xl bg-card p-3 ring-1 ring-emerald-200">
					<div className="mb-1.5 flex items-center justify-between">
						<label htmlFor="review-suggestion" className="font-semibold text-[11px] text-emerald-700">
							{t`Replace the selected text with`}
						</label>
						<button
							type="button"
							aria-label={t`Remove the suggested rewrite`}
							onClick={() => setSuggestion(null)}
							className="rounded-md p-0.5 text-muted-foreground hover:text-muted-foreground"
						>
							<XIcon className="size-3.5" />
						</button>
					</div>
					<textarea
						id="review-suggestion"
						value={suggestion}
						onChange={(e) => setSuggestion(e.target.value)}
						rows={2}
						className="w-full resize-none rounded-lg border-0 bg-emerald-500/10 px-3 py-2 text-foreground text-xs outline-none ring-1 ring-emerald-500/30 focus:ring-2 focus:ring-emerald-500"
					/>
					<p className="mt-1 text-[10px] text-muted-foreground">{t`The student can apply this with one click.`}</p>
				</div>
			)}

			<div className="relative">
				<textarea
					ref={inputRef}
					value={content}
					onChange={(e) => {
						setContent(e.target.value);
						setCaret(e.target.selectionStart);
						setHashClosed(false);
						setPick(0);
					}}
					onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
					onKeyDown={onKeyDown}
					placeholder={
						isReply
							? t`Write your reply...`
							: t`Write specific, actionable feedback for the student. Type # to use a saved comment.`
					}
					rows={4}
					aria-autocomplete="list"
					aria-expanded={matches.length > 0}
					className="mb-3 w-full resize-none rounded-xl border-0 bg-card px-4 py-3 text-foreground text-sm outline-none ring-1 ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
				/>
				{matches.length > 0 && (
					<div
						role="listbox"
						aria-label={t`Saved comments`}
						className="absolute inset-x-0 top-full z-20 -mt-2 overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-border"
					>
						{matches.map((snippet, i) => (
							<button
								key={snippet.id}
								type="button"
								role="option"
								aria-selected={i === pick}
								onMouseDown={(e) => {
									e.preventDefault();
									insertSnippet(snippet, true);
								}}
								className={cn(
									"block w-full px-3 py-2 text-start text-foreground text-xs",
									i === pick ? "bg-primary/5 text-primary" : "hover:bg-muted/50",
								)}
							>
								{snippet.content}
							</button>
						))}
					</div>
				)}
			</div>

			{!isReply && !managing && (
				<div className="mb-3 flex flex-wrap gap-1.5">
					{snippets.slice(0, CHIP_LIMIT).map((snippet) => (
						<button
							key={snippet.id}
							type="button"
							onClick={() => insertSnippet(snippet, false)}
							className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border transition-all hover:bg-primary/5 hover:text-primary hover:ring-primary/20"
						>
							{snippet.content}
						</button>
					))}
				</div>
			)}

			{!isReply && managing && (
				<div className="mb-3 rounded-xl bg-card p-2 ring-1 ring-border">
					<p className="px-1 pb-1.5 text-[11px] text-muted-foreground">
						{t`Saved comments for your whole team, most used first. Frequent ones are good workshop topics.`}
					</p>
					<ul className="max-h-56 divide-y divide-border overflow-y-auto">
						{snippets.map((snippet) => (
							<li key={snippet.id} className="flex items-center gap-2 px-1 py-1.5">
								<span className="min-w-0 flex-1 text-foreground text-xs">{snippet.content}</span>
								<span className="shrink-0 text-[10px] text-muted-foreground">{t`Used ${snippet.usageCount}×`}</span>
								<button
									type="button"
									aria-label={t`Delete saved comment: ${snippet.content}`}
									onClick={() => deleteSnippet.mutate({ id: snippet.id })}
									className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
								>
									<TrashIcon className="size-3.5" />
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					disabled={!content.trim() || isPending}
					onClick={() => void submit()}
					className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-sm text-white transition-all hover:bg-primary/90 disabled:opacity-50"
				>
					<PaperPlaneTiltIcon weight="duotone" className="size-4" />
					{isPending ? t`Posting…` : isReply ? t`Post Reply` : t`Post Comment`}
				</button>
				{!isReply && (
					<>
						<button
							type="button"
							disabled={!content.trim() || saveSnippet.isPending}
							onClick={() => saveSnippet.mutate({ content: content.trim() })}
							className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold text-muted-foreground text-xs hover:bg-muted disabled:opacity-40"
						>
							<BookmarkSimpleIcon className="size-3.5" />
							{t`Save for reuse`}
						</button>
						<button
							type="button"
							aria-pressed={managing}
							onClick={() => setManaging((m) => !m)}
							className="rounded-lg px-2 py-1.5 font-semibold text-muted-foreground text-xs hover:bg-muted"
						>
							{managing ? t`Done` : t`Manage saved`}
						</button>
					</>
				)}
			</div>
			<p className="mt-2 text-[10px] text-muted-foreground">{t`Ctrl+Enter posts. Esc clears the selection.`}</p>
		</div>
	);
}
