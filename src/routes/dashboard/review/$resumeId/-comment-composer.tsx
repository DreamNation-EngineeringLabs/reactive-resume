import { t } from "@lingui/core/macro";
import { PaperPlaneTiltIcon, PencilSimpleLineIcon, XIcon } from "@phosphor-icons/react";
import { type RefObject, useMemo, useState } from "react";
import { anchorLabel, severityLabel } from "@/components/resume/review-anchors";
import type { CommentAnchor, CommentSeverity } from "@/schema/resume/comment-anchor";
import type { ResumeData } from "@/schema/resume/data";
import {
	SUGGESTION_SECTIONS,
	suggestionSectionKey,
	suggestionSectionLabel,
	suggestionsForSection,
} from "@/schema/resume/review-suggestions";
import { cn } from "@/utils/style";

// Same colours as the highlighter on the resume.
export const SEVERITY_ON = {
	LOW: "bg-emerald-50 text-emerald-800 ring-emerald-500",
	MEDIUM: "bg-amber-50 text-amber-800 ring-amber-500",
	HIGH: "bg-rose-50 text-rose-800 ring-rose-500",
};
export const SEVERITY_DOT = { LOW: "bg-emerald-500", MEDIUM: "bg-amber-400", HIGH: "bg-rose-500" };

type Props = {
	resumeData: ResumeData;
	anchor: CommentAnchor | null;
	onClearAnchor: () => void;
	replyTo: string | null;
	onCancelReply: () => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	/** Comment text already sent on this resume, so a standard line is not sent twice. */
	sentContents: ReadonlySet<string>;
	isPending: boolean;
	onSubmit: (input: { content: string; severity?: CommentSeverity; suggestion?: string }) => Promise<unknown>;
	/** Posts several comments at once — the standard feedback the reviewer ticked, one comment each. */
	onSubmitMany: (
		comments: { content: string; severity?: CommentSeverity; suggestion?: string; anchor?: CommentAnchor }[],
	) => Promise<unknown>;
};

/**
 * The reviewer's comment box: what the comment points at, severity, an optional rewrite for the quoted
 * text, and the standard feedback for a section, ticked rather than typed.
 */
export function CommentComposer({
	resumeData,
	anchor,
	onClearAnchor,
	replyTo,
	onCancelReply,
	inputRef,
	sentContents,
	isPending,
	onSubmit,
	onSubmitMany,
}: Props) {
	const [content, setContent] = useState("");
	const [severity, setSeverity] = useState<CommentSeverity | null>(null);
	const [suggestion, setSuggestion] = useState<string | null>(null);
	const [pickedSection, setPickedSection] = useState(() => (anchor ? suggestionSectionKey(anchor.section) : null));
	// Standard feedback is ticked, not typed: a reviewer almost always sends two or three lines on a
	// section, and each has to arrive as its own comment so the student can address them one by one.
	const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

	const quote = anchor?.quote?.exact;
	const isReply = !!replyTo;

	// The picker is always on screen. Selecting text moves it to that text's section, but the reviewer
	// can switch to any other, and it keeps its value after posting: the next comment often goes on the
	// same section, and a picker that vanished after one post forced the reviewer to start over.
	const [pickedFor, setPickedFor] = useState(anchor?.section);
	if (pickedFor !== anchor?.section) {
		setPickedFor(anchor?.section);
		if (anchor) setPickedSection(suggestionSectionKey(anchor.section));
	}
	const shownSection = pickedSection;
	const sectionSuggestions = useMemo(() => suggestionsForSection(shownSection), [shownSection]);

	// A rewrite belongs to the text it was written for: selecting other text starts without one.
	const [rewriteFor, setRewriteFor] = useState(quote);
	if (rewriteFor !== quote) {
		setRewriteFor(quote);
		setSuggestion(null);
	}

	/** The suggestions ticked right now, in the order the catalogue lists them. */
	const chosen = useMemo(
		() => sectionSuggestions.filter((s) => picked.has(s.id) && !sentContents.has(s.content)),
		[sectionSuggestions, picked, sentContents],
	);

	// Moving to another section leaves ticks behind that are no longer on screen, and they would post
	// invisibly. Clearing on the section change keeps what is ticked and what is shown the same thing.
	const [tickedFor, setTickedFor] = useState(shownSection);
	if (tickedFor !== shownSection) {
		setTickedFor(shownSection);
		setPicked(new Set());
	}

	const toggle = (id: string) =>
		setPicked((current) => {
			const next = new Set(current);
			if (!next.delete(id)) next.add(id);
			return next;
		});

	const selectable = sectionSuggestions.filter((s) => !sentContents.has(s.content));
	const typed = content.trim();
	const total = chosen.length + (typed ? 1 : 0);

	const reset = () => {
		setContent("");
		setSuggestion(null);
		setSeverity(null);
		setPicked(new Set());
	};

	/**
	 * One comment per ticked suggestion, plus whatever was typed.
	 *
	 * Each is a separate thread rather than one merged comment, so the student can mark them
	 * addressed one at a time and each keeps the severity its checklist item carries. They go on the
	 * selected text when it is in the picked section, otherwise on the picked section as a whole.
	 */
	const submit = async () => {
		if (total === 0 || isPending) return;
		const rewrite = suggestion?.trim();
		const typedComment = typed
			? {
					content: typed,
					severity: isReply ? undefined : (severity ?? undefined),
					suggestion: !isReply && quote && rewrite && rewrite !== quote ? rewrite : undefined,
				}
			: null;

		// A reply is always one comment on one thread, and standard feedback does not apply to it.
		if (isReply || chosen.length === 0) {
			if (!typedComment) return;
			await onSubmit(typedComment);
		} else {
			const onSelection = !!anchor && suggestionSectionKey(anchor.section) === shownSection;
			const sectionAnchor: CommentAnchor | undefined = onSelection
				? anchor
				: shownSection
					? { section: shownSection }
					: undefined;
			await onSubmitMany([
				...chosen.map((s) => ({ content: s.content, severity: s.severity, anchor: sectionAnchor })),
				...(typedComment ? [{ ...typedComment, anchor: sectionAnchor }] : []),
			]);
		}
		reset();
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
				<p className="font-semibold text-foreground text-sm">
					{isReply ? t`Reply to Thread` : t`Add Feedback Comment`}
				</p>
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

			<textarea
				ref={inputRef}
				value={content}
				onChange={(e) => setContent(e.target.value)}
				onKeyDown={onKeyDown}
				placeholder={isReply ? t`Write your reply...` : t`Write specific, actionable feedback for the student.`}
				rows={4}
				className="mb-3 w-full resize-none rounded-xl border-0 bg-card px-4 py-3 text-foreground text-sm outline-none ring-1 ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
			/>

			{/* Standard feedback for the section being commented on. Stacked rather than chipped:
			    these are whole sentences, and a pill row truncates them into uselessness. */}
			{!isReply && (
				<div className="mb-3">
					<div className="mb-1.5 flex items-center gap-2">
						<span className="font-semibold text-[11px] text-muted-foreground">
							{shownSection ? t`Suggested for ${suggestionSectionLabel(shownSection)}` : t`Standard feedback`}
						</span>
						<select
							value={pickedSection ?? ""}
							onChange={(e) => setPickedSection(e.target.value || null)}
							aria-label={t`Choose a section`}
							className="rounded-lg bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border"
						>
							<option value="">{t`Choose a section…`}</option>
							{SUGGESTION_SECTIONS.map((section) => (
								<option key={section.key} value={section.key}>
									{section.label}
								</option>
							))}
						</select>
						{selectable.length > 0 && (
							<button
								type="button"
								onClick={() =>
									setPicked(chosen.length === selectable.length ? new Set() : new Set(selectable.map((s) => s.id)))
								}
								className="ms-auto font-semibold text-[11px] text-primary hover:underline"
							>
								{chosen.length === selectable.length ? t`Clear all` : t`Select all`}
							</button>
						)}
					</div>

					{sectionSuggestions.length > 0 && (
						<ul className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
							{sectionSuggestions.map((suggestion) => {
								const alreadySent = sentContents.has(suggestion.content);
								const checked = alreadySent || picked.has(suggestion.id);
								return (
									<li key={suggestion.id} className="border-border border-b last:border-b-0">
										{/* Tick as many as apply: each posts as its own comment, so the student can mark
										    them addressed one at a time. */}
										<label
											className={cn(
												"flex w-full items-start gap-2.5 px-3 py-2 transition-colors",
												alreadySent ? "opacity-55" : "cursor-pointer hover:bg-primary/5",
												!alreadySent && checked && "bg-primary/5",
											)}
										>
											<input
												type="checkbox"
												checked={checked}
												disabled={alreadySent}
												onChange={() => toggle(suggestion.id)}
												className="mt-0.5 size-3.5 shrink-0 accent-primary"
											/>
											<span
												aria-hidden
												className={cn("mt-1 size-1.5 shrink-0 rounded-full", SEVERITY_DOT[suggestion.severity])}
											/>
											<span className="min-w-0 flex-1">
												<span className="block text-foreground text-xs leading-snug">{suggestion.content}</span>
												{alreadySent && (
													<span className="mt-0.5 block text-[10px] text-muted-foreground">
														{t`Already sent on this resume`}
													</span>
												)}
											</span>
										</label>
									</li>
								);
							})}
						</ul>
					)}

					{chosen.length > 0 && (
						<p className="mt-1.5 text-[10px] text-muted-foreground">
							{t`${chosen.length} selected — each is posted as its own comment, with the severity shown.`}
						</p>
					)}
				</div>
			)}

			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					disabled={total === 0 || isPending}
					onClick={() => void submit()}
					className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-sm text-white transition-all hover:bg-primary/90 disabled:opacity-50"
				>
					<PaperPlaneTiltIcon weight="duotone" className="size-4" />
					{isPending ? t`Posting…` : isReply ? t`Post Reply` : total > 1 ? t`Post ${total} Comments` : t`Post Comment`}
				</button>
			</div>
			<p className="mt-2 text-[10px] text-muted-foreground">{t`Ctrl+Enter posts. Esc clears the selection.`}</p>
		</div>
	);
}
