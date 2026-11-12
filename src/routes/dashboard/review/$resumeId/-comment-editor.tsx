import { t } from "@lingui/core/macro";
import { Fragment, useMemo, useState } from "react";
import { severityLabel } from "@/components/resume/review-anchors";
import type { CommentAnchor, CommentSeverity } from "@/schema/resume/comment-anchor";
import type { ResumeData } from "@/schema/resume/data";
import {
	anchorForSection,
	SUGGESTION_SECTIONS,
	suggestionSectionKey,
	suggestionSectionLabel,
	suggestionsForSection,
	WHOLE_RESUME,
} from "@/schema/resume/review-suggestions";
import { cn } from "@/utils/style";
import { SEVERITY_DOT, SEVERITY_ON } from "./-comment-composer";

type EditableComment = {
	id: string;
	content: string;
	severity: string | null;
	anchor: CommentAnchor | null;
	parentId: string | null;
};

/** `section` is the anchor section to move to; null makes it a comment on the whole resume. */
export type CommentEdit = { content: string; severity?: CommentSeverity | null; section?: string | null };

type Props = {
	comment: EditableComment;
	resumeData: ResumeData;
	/** Comment text already sent on this resume, so a standard line is not sent twice. */
	sentContents: ReadonlySet<string>;
	isPending: boolean;
	onSave: (edit: CommentEdit) => void;
	onCancel: () => void;
};

const asSeverity = (value: string | null): CommentSeverity | null =>
	value === "LOW" || value === "MEDIUM" || value === "HIGH" ? value : null;

/**
 * Edits a reviewer's own comment in place.
 *
 * The usual edit is swapping one standard line for a better one, so the section's standard feedback
 * is listed and one click replaces the text and severity with it. The text can still be typed over.
 * Picking another section moves the comment to that whole section. A reply only has its text.
 */
export function CommentEditor({ comment, resumeData, sentContents, isPending, onSave, onCancel }: Props) {
	const isReply = !!comment.parentId;
	// A comment with no anchor is on the whole resume; one on a section with no standard feedback has no key.
	const originalSection = comment.anchor ? suggestionSectionKey(comment.anchor.section, resumeData) : WHOLE_RESUME;
	const originalSeverity = asSeverity(comment.severity);

	const [content, setContent] = useState(comment.content);
	const [severity, setSeverity] = useState<CommentSeverity | null>(originalSeverity);
	const [section, setSection] = useState<string | null>(originalSection);
	const sectionSuggestions = useMemo(() => suggestionsForSection(section), [section]);

	const typed = content.trim();
	const moved = section !== null && section !== originalSection;
	const target = moved && section ? anchorForSection(section, resumeData) : undefined;
	const changed = typed !== comment.content || severity !== originalSeverity || moved;

	const save = () => {
		if (!typed || !changed || isPending) return;
		onSave(
			isReply
				? { content: typed }
				: {
						content: typed,
						...(severity !== originalSeverity && { severity }),
						...(moved && { section: target?.section ?? null }),
					},
		);
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			save();
		} else if (event.key === "Escape") {
			event.preventDefault();
			onCancel();
		}
	};

	return (
		<div className="space-y-2.5">
			{!isReply && (
				<div className="space-y-1.5">
					<div className="flex items-center gap-2">
						<span className="font-semibold text-[11px] text-muted-foreground">
							{section ? t`Standard feedback for ${suggestionSectionLabel(section)}` : t`Standard feedback`}
						</span>
						<select
							value={section ?? ""}
							onChange={(e) => setSection(e.target.value || null)}
							aria-label={t`Choose a section`}
							className="rounded-lg bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border"
						>
							<option value="">{t`Choose a section…`}</option>
							{SUGGESTION_SECTIONS.map((s) => (
								<option key={s.key} value={s.key}>
									{s.label}
								</option>
							))}
						</select>
					</div>

					{sectionSuggestions.length > 0 && (
						<ul className="max-h-56 overflow-y-auto rounded-xl bg-card ring-1 ring-border">
							{sectionSuggestions.map((suggestion, i) => {
								const current = typed === suggestion.content;
								// Sent as another comment on this resume — picking it here would send it twice.
								const elsewhere =
									!current && suggestion.content !== comment.content && sentContents.has(suggestion.content);
								return (
									<Fragment key={suggestion.id}>
										{suggestion.group && suggestion.group !== sectionSuggestions[i - 1]?.group && (
											<li className="sticky top-0 border-border border-b bg-muted px-3 py-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
												{suggestion.group}
											</li>
										)}
										<li className="border-border border-b last:border-b-0">
											<button
												type="button"
												disabled={elsewhere}
												aria-pressed={current}
												onClick={() => {
													setContent(suggestion.content);
													setSeverity(suggestion.severity);
												}}
												className={cn(
													"flex w-full items-start gap-2.5 px-3 py-2 text-start transition-colors",
													elsewhere ? "opacity-55" : "hover:bg-primary/5",
													current && "bg-primary/5",
												)}
											>
												<span
													aria-hidden
													className={cn("mt-1 size-1.5 shrink-0 rounded-full", SEVERITY_DOT[suggestion.severity])}
												/>
												<span className="min-w-0 flex-1">
													<span className="block text-foreground text-xs leading-snug">{suggestion.content}</span>
													{elsewhere && (
														<span className="mt-0.5 block text-[10px] text-muted-foreground">
															{t`Already sent on this resume`}
														</span>
													)}
												</span>
											</button>
										</li>
									</Fragment>
								);
							})}
						</ul>
					)}

					{moved && section && (
						<p className="text-[10px] text-muted-foreground">
							{target
								? t`This comment will move to the whole ${suggestionSectionLabel(section)} section.`
								: section === WHOLE_RESUME
									? t`This comment will move to the resume as a whole.`
									: t`This comment will move to the resume as a whole — this resume has no ${suggestionSectionLabel(section)} section.`}
						</p>
					)}

					<div className="flex flex-wrap items-center gap-1.5">
						<span className="text-[11px] text-muted-foreground">{t`Severity`}</span>
						{(["LOW", "MEDIUM", "HIGH"] as const).map((level) => (
							<button
								key={level}
								type="button"
								aria-pressed={severity === level}
								onClick={() => setSeverity(severity === level ? null : level)}
								className={cn(
									"flex items-center gap-1.5 rounded-lg px-2 py-0.5 font-semibold text-[11px] ring-1 transition-all",
									severity === level ? SEVERITY_ON[level] : "bg-card text-muted-foreground ring-border hover:bg-muted",
								)}
							>
								<span className={cn("size-2 rounded-full", SEVERITY_DOT[level])} />
								{severityLabel(level)}
							</button>
						))}
					</div>
				</div>
			)}

			<textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				onKeyDown={onKeyDown}
				rows={3}
				aria-label={t`Comment text`}
				className="w-full resize-none rounded-xl border-0 bg-card px-3 py-2 text-foreground text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-primary"
			/>

			<div className="flex items-center gap-2">
				<button
					type="button"
					disabled={!typed || !changed || isPending}
					onClick={save}
					className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white text-xs hover:bg-primary/90 disabled:opacity-50"
				>
					{isPending ? t`Saving…` : t`Save`}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg px-3 py-1.5 font-semibold text-muted-foreground text-xs hover:bg-muted"
				>
					{t`Cancel`}
				</button>
			</div>
		</div>
	);
}
