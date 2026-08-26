import { useCallback, useMemo } from "react";
import type { usePanelRef } from "react-resizable-panels";
import { create } from "zustand/react";

type PanelImperativeHandle = ReturnType<typeof usePanelRef>;

interface BuilderSidebarState {
	leftSidebar: PanelImperativeHandle | null;
	rightSidebar: PanelImperativeHandle | null;
	/**
	 * When true the ATS section renders its wide inline body instead of the compact panel.
	 *
	 * Despite the name this does not resize anything: `getSidebarMaxSize` returns a flat 20%, so the
	 * right sidebar never exceeds that and the artboard is never squeezed below 60%. (An earlier
	 * comment here claimed ≈38% width, which was never true of the code.)
	 */
	atsInlineExpanded: boolean;
	/**
	 * Which panel is open as a full-screen overlay on mobile, if any.
	 *
	 * A single value rather than two booleans, so "only one thing on screen at a time" is structural:
	 * opening one panel inherently closes the other and there is no state in which both are visible.
	 * Ignored on desktop, where both panels dock side by side via the resizable group instead.
	 */
	mobilePanel: "left" | "right" | null;
}

interface BuilderSidebarActions {
	setLeftSidebar: (ref: PanelImperativeHandle | null) => void;
	setRightSidebar: (ref: PanelImperativeHandle | null) => void;
	setAtsInlineExpanded: (v: boolean) => void;
	setMobilePanel: (panel: "left" | "right" | null) => void;
	toggleMobilePanel: (panel: "left" | "right") => void;
}

type BuilderSidebar = BuilderSidebarState & BuilderSidebarActions;

export const useBuilderSidebarStore = create<BuilderSidebar>((set) => ({
	leftSidebar: null,
	rightSidebar: null,
	atsInlineExpanded: false,
	mobilePanel: null,
	setLeftSidebar: (ref) => set({ leftSidebar: ref }),
	setRightSidebar: (ref) => set({ rightSidebar: ref }),
	setAtsInlineExpanded: (v) => set({ atsInlineExpanded: v }),
	setMobilePanel: (panel) => set({ mobilePanel: panel }),
	toggleMobilePanel: (panel) => set((state) => ({ mobilePanel: state.mobilePanel === panel ? null : panel })),
}));

type UseBuilderSidebarReturn = {
	getSidebarMaxSize: (side: "left" | "right") => number;
	collapsedSidebarSize: number;
	isCollapsed: (side: "left" | "right") => boolean;
	toggleSidebar: (side: "left" | "right", forceExpand?: boolean) => void;
};

export function useBuilderSidebar<T = UseBuilderSidebarReturn>(selector?: (builder: UseBuilderSidebarReturn) => T): T {
	const getSidebarMaxSize = useCallback((_side: "left" | "right"): number => {
		return 20;
	}, []);

	const collapsedSidebarSize = useMemo(() => 0, []);

	const isCollapsed = useCallback((side: "left" | "right") => {
		const state = useBuilderSidebarStore.getState();
		const sidebar = side === "left" ? state.leftSidebar?.current : state.rightSidebar?.current;
		return sidebar ? sidebar.isCollapsed() : false;
	}, []);

	const toggleSidebar = useCallback((side: "left" | "right", forceExpand?: boolean) => {
		const state = useBuilderSidebarStore.getState();

		// On mobile the panels are full-screen overlays rather than docked columns, so the resizable
		// panel handles do not apply — expanding one there only squeezed the preview into a sliver
		// instead of opening. Checked at call time (not via useIsMobile) because this runs from an
		// event handler and must reflect the viewport as it is at that moment.
		const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

		if (isMobileViewport) {
			if (forceExpand) state.setMobilePanel(side);
			else state.toggleMobilePanel(side);
			return;
		}

		const sidebar = side === "left" ? state.leftSidebar?.current : state.rightSidebar?.current;

		if (!sidebar) return;

		const shouldExpand = forceExpand ?? sidebar.isCollapsed();

		if (shouldExpand) {
			sidebar.expand();
		} else {
			sidebar.collapse();
		}
	}, []);

	const state = useMemo(() => {
		return {
			getSidebarMaxSize,
			collapsedSidebarSize,
			isCollapsed,
			toggleSidebar,
		};
	}, [getSidebarMaxSize, collapsedSidebarSize, isCollapsed, toggleSidebar]);

	return selector ? selector(state) : (state as T);
}
