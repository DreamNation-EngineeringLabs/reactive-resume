import { ArrowsOutIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/utils/style";

/**
 * Wraps the A4 resume preview so it fits a phone screen, and lets the reader pinch/drag around it.
 *
 * The preview renders at a fixed page width (794px for A4 — see `--page-width` in preview.module.css).
 * On a 390px viewport that meant only the middle ~49% of the resume was ever on screen: the template's
 * left sidebar column sat at a negative x and was simply unreachable, so students could not see their
 * own skills section at all. Nothing clipped it visibly, which made it read as "the preview is broken".
 *
 * Scaling is applied with a transform rather than by changing `--page-width`, so the page keeps its
 * true print dimensions — the PDF pipeline, page-break maths and template CSS all stay untouched.
 */

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
/**
 * Breathing room either side of the page when scaling to fit.
 *
 * Kept small on purpose: a 1366px laptop gives the artboard 818px for a 794px page, so anything
 * larger than 12px here would scale a page that actually fits and pop the zoom controls up at 99%.
 */
const FIT_PADDING = 8;
/** Ignore scale differences under this — 0.99 is imperceptible and not worth showing controls for. */
const FIT_EPSILON = 0.02;

type Props = {
	children: ReactNode;
	/** Intrinsic width of the content being scaled, in CSS pixels. A4 is 794. */
	contentWidth: number;
	/** Enable the fit/zoom/pan behaviour. When false the children render untouched (desktop). */
	enabled?: boolean;
	className?: string;
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function ZoomablePreview({ children, contentWidth, enabled = true, className }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const [fitScale, setFitScale] = useState(1);
	const [scale, setScale] = useState(1);
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [contentHeight, setContentHeight] = useState(0);

	// Pointer bookkeeping for drag-to-pan and two-finger pinch.
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const gestureStart = useRef<{ distance: number; scale: number; x: number; y: number } | null>(null);
	const lastTap = useRef(0);

	const recomputeFit = useCallback(() => {
		const container = containerRef.current;
		if (!container || !enabled) return;

		const available = container.clientWidth - FIT_PADDING * 2;
		if (available <= 0) return;

		const next = clamp(available / contentWidth, MIN_SCALE, 1);
		setFitScale(next);
		// Only snap the live scale to fit while the reader has not zoomed themselves.
		setScale((current) => (Math.abs(current - fitScale) < 0.001 ? next : current));
	}, [contentWidth, enabled, fitScale]);

	// Measure the unscaled content so the wrapper can reserve exactly `height * scale` — without this
	// the untransformed height stays in flow and leaves a screenful of dead space under the page.
	useLayoutEffect(() => {
		const content = contentRef.current;
		if (!content) return;

		const observer = new ResizeObserver(() => {
			setContentHeight(content.offsetHeight);
		});
		observer.observe(content);
		setContentHeight(content.offsetHeight);

		return () => observer.disconnect();
	}, []);

	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver(recomputeFit);
		observer.observe(container);
		recomputeFit();

		return () => observer.disconnect();
	}, [recomputeFit]);

	// Reset the pan whenever we return to exactly-fit, so the page cannot be left parked off-screen.
	useEffect(() => {
		if (Math.abs(scale - fitScale) < 0.001) setOffset({ x: 0, y: 0 });
	}, [scale, fitScale]);

	const zoomTo = useCallback(
		(next: number) => {
			setScale(clamp(next, Math.min(MIN_SCALE, fitScale), MAX_SCALE));
		},
		[fitScale],
	);

	const resetToFit = useCallback(() => {
		setScale(fitScale);
		setOffset({ x: 0, y: 0 });
	}, [fitScale]);

	const onPointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
			event.currentTarget.setPointerCapture(event.pointerId);

			if (pointers.current.size === 2) {
				const [a, b] = [...pointers.current.values()];
				gestureStart.current = {
					distance: Math.hypot(a.x - b.x, a.y - b.y),
					scale,
					x: offset.x,
					y: offset.y,
				};
			}
		},
		[scale, offset],
	);

	const onPointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			const previous = pointers.current.get(event.pointerId);
			if (!previous) return;

			const current = { x: event.clientX, y: event.clientY };
			pointers.current.set(event.pointerId, current);

			if (pointers.current.size === 2 && gestureStart.current) {
				const [a, b] = [...pointers.current.values()];
				const distance = Math.hypot(a.x - b.x, a.y - b.y);
				zoomTo(gestureStart.current.scale * (distance / gestureStart.current.distance));
				return;
			}

			// Single-pointer drag pans, but only once zoomed past fit — otherwise the whole page is
			// already visible and dragging it away would just lose it.
			if (pointers.current.size === 1 && scale > fitScale + 0.001) {
				setOffset((o) => ({ x: o.x + (current.x - previous.x), y: o.y + (current.y - previous.y) }));
			}
		},
		[fitScale, scale, zoomTo],
	);

	const onPointerUp = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			pointers.current.delete(event.pointerId);
			if (pointers.current.size < 2) gestureStart.current = null;

			// Double-tap toggles between fit and 2×, the gesture readers expect from image viewers.
			const now = Date.now();
			if (pointers.current.size === 0) {
				if (now - lastTap.current < 300) {
					if (scale > fitScale + 0.001) resetToFit();
					else zoomTo(fitScale * 2);
					lastTap.current = 0;
				} else {
					lastTap.current = now;
				}
			}
		},
		[fitScale, resetToFit, scale, zoomTo],
	);

	if (!enabled) return <div className={className}>{children}</div>;

	const isZoomed = scale > fitScale + 0.001;
	// Controls only earn their place when the page cannot fit unaided, or the reader has zoomed in.
	// On a wide desktop the page fits at 1:1 and the bar would be pure clutter.
	const showControls = fitScale < 1 - FIT_EPSILON || isZoomed;

	return (
		<div className={cn("relative flex-1 overflow-hidden", className)} ref={containerRef}>
			<div
				className="h-full w-full touch-none overflow-auto overscroll-contain"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
			>
				<div
					className="mx-auto"
					style={{
						width: contentWidth * scale,
						height: contentHeight ? contentHeight * scale : undefined,
					}}
				>
					<div
						ref={contentRef}
						style={{
							width: contentWidth,
							transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
							transformOrigin: "top left",
							willChange: isZoomed ? "transform" : undefined,
						}}
					>
						{children}
					</div>
				</div>
			</div>

			{/* Explicit controls: pinch is undiscoverable, and plenty of students never try it. */}
			<div
				hidden={!showControls}
				className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/90 p-1 shadow-lg backdrop-blur-sm"
			>
				<button
					type="button"
					aria-label="Zoom out"
					className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
					disabled={scale <= Math.min(MIN_SCALE, fitScale) + 0.001}
					onClick={() => zoomTo(scale - 0.25)}
				>
					<MinusIcon className="size-4" />
				</button>

				<button
					type="button"
					aria-label="Fit resume to screen"
					className="flex h-11 items-center gap-1.5 rounded-full px-3 font-medium text-muted-foreground text-xs tabular-nums transition-colors hover:bg-muted hover:text-foreground"
					onClick={resetToFit}
				>
					<ArrowsOutIcon className="size-4" />
					{Math.round(scale * 100)}%
				</button>

				<button
					type="button"
					aria-label="Zoom in"
					className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
					disabled={scale >= MAX_SCALE - 0.001}
					onClick={() => zoomTo(scale + 0.25)}
				>
					<PlusIcon className="size-4" />
				</button>
			</div>
		</div>
	);
}
