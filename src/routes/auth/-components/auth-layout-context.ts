import { createContext, useContext, useEffect } from "react";

type AuthLayoutContextType = {
	setIsChildLoading: (loading: boolean) => void;
};

export const AuthLayoutContext = createContext<AuthLayoutContextType>({
	setIsChildLoading: () => {},
});

export function useAuthLayout() {
	return useContext(AuthLayoutContext);
}

/**
 * Signals the parent auth layout that this child route is ready to be shown.
 * Call in any auth child route that does NOT need a deferred session probe.
 */
export function useSignalAuthReady() {
	const { setIsChildLoading } = useAuthLayout();
	useEffect(() => {
		setIsChildLoading(false);
	}, [setIsChildLoading]);
}
