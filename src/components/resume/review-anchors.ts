import { useEffect, useRef } from "react";
import { create } from "zustand";
import { type CommentAnchor, findQuote } from "@/schema/resume/comment-anchor";
import type { ResumeData } from "@/schema/resume/data";
import { getSectionTitle, type LeftSidebarSection } from "@/utils/resume/section";

/**
 * Reviewer comments anchored to the rendered resume.
 *
 * Anchors point at resume data, found in the preview DOM through hooks every template already shares:
 * `data-section-type` / `data-section-id` on sections, `data-section-item-id` on items, `.page-header` for
 * basics, and per-field classes such as `experience-item-description` or `basics-headline`. So an anchor
 * survives template switches and page moves; only editing the quoted text itself can break it.
 *
 * Highlights use the CSS Custom Highlight API: nothing is injected into the template DOM, and nothing
 * shows up in the printed PDF (the printer never registers highlights).
 */

export type AnchorStatus = "ok" | "changed" | "missing";
type AnchoredComment = { id: string; anchor: CommentAnchor | null };

/** Comments that should be highlighted: open (not resolved) top-level comments that point somewhere. */
export function openAnchoredComments(comments: (AnchoredComment & { parentId: string | null; status: string })[]) {
	return comments
		.filter((c) => !c.parentId && c.anchor && c.status !== "RESOLVED")
		.map(({ id, anchor }) => ({ id, anchor }));
}

const ROOT = ".resume-preview-container";
const HEADER = "page-header";
const CONTEXT = 32;
// `experience-item-description`, `basics-headline`, `basics-item-email` — not the generic `section-item-*` or `*-item-header`.
const FIELD_CLASS = /^(?!section-)[a-z]+(?:-[a-z]+)*-item-(?!header$)[a-z]+$|^basics-(?:name|headline|item-[a-z]+)$/;
const HIGHLIGHT = "review-comment";
const HIGHLIGHT_ACTIVE = "review-comment-active";

function sectionKey(el: HTMLElement) {
	return el.classList.contains(HEADER) ? "basics" : (el.dataset.sectionId ?? el.dataset.sectionType ?? "");
}

function closestField(from: Element, boundary: Element) {
	for (let el: Element | null = from; el && el !== boundary; el = el.parentElement) {
		const field = [...el.classList].find((c) => FIELD_CLASS.test(c));
		if (field) return { el, field };
	}
	return null;
}

function textOffset(scope: Node, node: Node, offset: number) {
	const range = document.createRange();
	range.setStart(scope, 0);
	range.setEnd(node, offset);
	return range.toString().length;
}

function rangeAt(scope: Node, start: number, end: number) {
	const range = document.createRange();
	const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
	let pos = 0;
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const len = node.textContent?.length ?? 0;
		if (pos <= start && start <= pos + len) range.setStart(node, start - pos);
		if (pos <= end && end <= pos + len) {
			range.setEnd(node, end - pos);
			break;
		}
		pos += len;
	}
	return range;
}

function rangeOf(el: Node) {
	const range = document.createRange();
	range.selectNodeContents(el);
	return range;
}

/** Turns a selection on the preview into an anchor, or null if it isn't inside one section. */
export function anchorFromRange(range: Range): CommentAnchor | null {
	const exact = range.toString();
	const root = document.querySelector(ROOT);
	if (!root || !exact.trim() || !root.contains(range.commonAncestorContainer)) return null;

	const common = range.commonAncestorContainer;
	const start = common instanceof Element ? common : common.parentElement;
	const sectionEl = start?.closest<HTMLElement>(`[data-section-type], [data-section-id], .${HEADER}`);
	if (!start || !sectionEl) return null;

	const section = sectionKey(sectionEl);
	// Selecting the section title means "this whole section" (e.g. "Add more skills here").
	if (start.closest("h6")) return { section };

	const itemEl = start.closest<HTMLElement>("[data-section-item-id]");
	const itemId = itemEl && sectionEl.contains(itemEl) ? itemEl.dataset.sectionItemId : undefined;
	const field = closestField(start, itemEl ?? sectionEl);
	const scope = field?.el ?? itemEl ?? sectionEl;

	const lead = exact.length - exact.trimStart().length;
	const quoteText = exact.trim();
	const at = textOffset(scope, range.startContainer, range.startOffset) + lead;
	const full = scope.textContent ?? "";

	return {
		section,
		itemId,
		field: field?.field,
		quote: {
			exact: quoteText.slice(0, 2000),
			prefix: full.slice(Math.max(0, at - CONTEXT), at),
			suffix: full.slice(at + quoteText.length, at + quoteText.length + CONTEXT),
		},
		start: at,
	};
}

/** Finds an anchor in the current preview. "changed": the quoted text was edited, so the whole field is used. */
export function resolveAnchor(anchor: CommentAnchor): { status: AnchorStatus; range: Range | null } {
	const root = document.querySelector(ROOT);
	const missing = { status: "missing" as const, range: null };
	if (!root) return missing;

	const sectionEl =
		anchor.section === "basics"
			? root.querySelector(`.${HEADER}`)
			: (root.querySelector(`[data-section-id="${CSS.escape(anchor.section)}"]`) ??
				root.querySelector(`[data-section-type="${CSS.escape(anchor.section)}"]`));
	if (!sectionEl) return missing;

	let scopes: Element[] = [sectionEl];
	if (anchor.itemId) {
		// Item ids are unique UUIDs; search the whole preview in case the section continues on another page.
		const item = root.querySelector(`[data-section-item-id="${CSS.escape(anchor.itemId)}"]`);
		if (!item) return missing;
		scopes = [item];
	}
	if (anchor.field) {
		scopes = [...scopes[0].querySelectorAll(`.${CSS.escape(anchor.field)}`)];
		if (scopes.length === 0) return missing;
	}
	if (!anchor.quote) return { status: "ok", range: rangeOf(scopes[0]) };

	for (const scope of scopes) {
		const at = findQuote(scope.textContent ?? "", anchor.quote, anchor.start);
		if (at !== -1) return { status: "ok", range: rangeAt(scope, at, at + anchor.quote.exact.length) };
	}
	return { status: "changed", range: rangeOf(scopes[0]) };
}

const ITEM_NAME_KEYS = ["company", "school", "institution", "name", "title", "network", "organization", "language"];

/** "Experience › Cascade Studios", "Basics › Headline", "Skills". */
export function anchorLabel(anchor: CommentAnchor, data: ResumeData) {
	const builtIn = data.sections[anchor.section as keyof ResumeData["sections"]];
	const custom = data.customSections.find((s) => s.id === anchor.section);

	if (anchor.section === "basics") {
		const field = anchor.field?.replace(/^basics-(item-)?/, "") ?? "";
		return [getSectionTitle("basics"), field && field.charAt(0).toUpperCase() + field.slice(1)]
			.filter(Boolean)
			.join(" › ");
	}

	const title =
		anchor.section === "summary"
			? data.summary.title || getSectionTitle("summary")
			: builtIn?.title || custom?.title || getSectionTitle(anchor.section as LeftSidebarSection);
	const items: Record<string, unknown>[] = (builtIn ?? custom)?.items ?? [];
	const item = items.find((i) => i.id === anchor.itemId);
	const itemName = item && ITEM_NAME_KEYS.map((k) => item[k]).find((v) => typeof v === "string" && v.trim());

	return [title, itemName].filter(Boolean).join(" › ");
}

function scrollToRange(range: Range) {
	const node = range.startContainer;
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	(node instanceof Element ? node : node.parentElement)?.scrollIntoView({
		block: "center",
		behavior: reduce ? "auto" : "smooth",
	});
}

/** Scrolls the preview to a comment's text (for re-clicking the comment that is already active). */
export function scrollToAnchor(anchor: CommentAnchor) {
	const { range } = resolveAnchor(anchor);
	if (range) scrollToRange(range);
}

/** Latest anchor status per comment id, written by `useReviewHighlights` so other panels can show it. */
export const useAnchorStatusStore = create<{ statuses: Record<string, AnchorStatus> }>(() => ({ statuses: {} }));

/**
 * Highlights every anchored comment in the preview and keeps them in place while the resume re-renders.
 * Mount once per page, next to the preview. Scrolls the active comment into view when it changes, and
 * clicking highlighted text calls `onActivate` with that comment's id. Returns each comment's status.
 */
export function useReviewHighlights(
	comments: AnchoredComment[],
	activeId: string | null,
	onActivate?: (id: string) => void,
) {
	const ranges = useRef(new Map<string, Range>());
	const scrolledTo = useRef<string | null>(null);
	const onActivateRef = useRef(onActivate);
	onActivateRef.current = onActivate;

	useEffect(() => {
		const supported = typeof CSS !== "undefined" && "highlights" in CSS;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const paint = () => {
			const next: Record<string, AnchorStatus> = {};
			ranges.current.clear();
			for (const { id, anchor } of comments) {
				if (!anchor) continue;
				const { status, range } = resolveAnchor(anchor);
				next[id] = status;
				if (range) ranges.current.set(id, range);
			}
			const prev = useAnchorStatusStore.getState().statuses;
			if (JSON.stringify(prev) !== JSON.stringify(next)) useAnchorStatusStore.setState({ statuses: next });

			const active = activeId ? ranges.current.get(activeId) : undefined;
			// Scroll once per activation — also covers a deep-linked comment whose text renders late.
			if (active && scrolledTo.current !== activeId) {
				scrolledTo.current = activeId;
				scrollToRange(active);
			}

			if (!supported) return;
			const rest = [...ranges.current].filter(([id]) => id !== activeId).map(([, r]) => r);
			CSS.highlights.set(HIGHLIGHT, new Highlight(...rest));
			CSS.highlights.set(HIGHLIGHT_ACTIVE, new Highlight(...(active ? [active] : [])));
		};

		if (activeId !== scrolledTo.current) scrolledTo.current = null;
		paint();
		// Re-anchor whenever the preview changes (student edits, template switch, data loading in).
		const observer = new MutationObserver(() => {
			clearTimeout(timer);
			timer = setTimeout(paint, 150);
		});
		observer.observe(document.body, { subtree: true, childList: true, characterData: true });

		return () => {
			observer.disconnect();
			clearTimeout(timer);
			if (supported) {
				CSS.highlights.delete(HIGHLIGHT);
				CSS.highlights.delete(HIGHLIGHT_ACTIVE);
			}
		};
	}, [comments, activeId]);

	useEffect(() => () => useAnchorStatusStore.setState({ statuses: {} }), []);

	// Click on highlighted text → select its comment.
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (!onActivateRef.current || !window.getSelection()?.isCollapsed) return;
			if (!(event.target instanceof Node) || !document.querySelector(ROOT)?.contains(event.target)) return;
			const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
			const fallback = caret ? null : document.caretRangeFromPoint?.(event.clientX, event.clientY);
			const node = caret?.offsetNode ?? fallback?.startContainer;
			const offset = caret?.offset ?? fallback?.startOffset ?? 0;
			if (!node) return;
			// Innermost (shortest) highlight under the pointer wins.
			const hit = [...ranges.current]
				.filter(([, r]) => r.isPointInRange(node, offset))
				.sort(([, a], [, b]) => a.toString().length - b.toString().length)[0];
			if (hit) onActivateRef.current(hit[0]);
		};
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, []);

	return useAnchorStatusStore((state) => state.statuses);
}
