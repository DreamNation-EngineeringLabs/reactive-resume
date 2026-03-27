import { useCallback, useMemo } from "react";
import type { usePanelRef } from "react-resizable-panels";
import { create } from "zustand/react";

type PanelImperativeHandle = ReturnType<typeof usePanelRef>;

interface BuilderSidebarState {
	leftSidebar: PanelImperativeHandle | null;
	rightSidebar: PanelImperativeHandle | null;
}

interface BuilderSidebarActions {
	setLeftSidebar: (ref: PanelImperativeHandle | null) => void;
	setRightSidebar: (ref: PanelImperativeHandle | null) => void;
}

type BuilderSidebar = BuilderSidebarState & BuilderSidebarActions;

export const useBuilderSidebarStore = create<BuilderSidebar>((set) => ({
	leftSidebar: null,
	rightSidebar: null,
	setLeftSidebar: (ref) => set({ leftSidebar: ref }),
	setRightSidebar: (ref) => set({ rightSidebar: ref }),
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
