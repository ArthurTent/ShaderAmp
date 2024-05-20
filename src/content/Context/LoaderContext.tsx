// Borrowed from: https://blog.stackademic.com/loading-state-utility-in-react-js-bde4256fa123

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

  type LoaderContextType = {
	loading: (
		loaderId: string
	  ) => void;
	presetLoadCount: (
		loaderId: string,
		count: number
	  ) => void
	releaseLoading: (
		loaderId: string
	  ) => void;
	state: Record<string, number>;
	loadCounts: Record<string, number>;
  };
  
  const LoadersContext = createContext<LoaderContextType>({} as LoaderContextType);
  
  export function LoadersProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = useState<Record<string, number>>({});
	const [loadCounts, setLoadCounts] = useState<Record<string, number>>({});
	const presetLoadCount = useCallback(presetLoading, []);
	const loading = useCallback(triggerLoading, []);
	const releaseLoading = useCallback(releaseLoader, []);

	function presetLoading<T>(loaderId: string, loadCount: number) {
		updateLoaders(loaderId, loadCount);
	  }
	
	function triggerLoading<T>(loaderId: string) {
	  updateLoaders(loaderId, 1);
	}
  
	function releaseLoader<T>(loaderId: string) {
		updateLoaders(loaderId, -1);
	  }

	function updateLoaders(loaderId: string, amount: number) {
	  setState((loaders) => ({
		...loaders,
		[loaderId]: (loaders[loaderId] || 0) + amount,
	  }));
	  setLoadCounts((counts) => ({
		...counts,
		[loaderId]: Math.max((counts[loaderId] || 0) + amount, (counts[loaderId] || 0)),
	  }));
	}
  
	return (
	  <LoadersContext.Provider value={{ state, loadCounts, loading, presetLoadCount, releaseLoading }}>
		{children}
	  </LoadersContext.Provider>
	);
  }
  
  export function useIsLoading(loaderId: string): boolean {
	const { state } = useContext(LoadersContext);
	return useMemo(() => state[loaderId] === undefined || state[loaderId] > 0, [loaderId, state]);
  }

  export type LoadProgress = {
	progress: number;
	maxProgress: number;
  }

  export function useProgress(loaderId: string): LoadProgress {
	const { state, loadCounts } = useContext(LoadersContext);
	const createLoadProgress = () => {
		const loaderState = state[loaderId];
		const loaderCounts = loadCounts[loaderId];
		return { progress: loaderCounts - loaderState, maxProgress: loaderCounts };
	}
	return useMemo(createLoadProgress, [state, loadCounts]);
  }

  export function useIsLoadingDeferred(loaderId: string): boolean {
	const { state } = useContext(LoadersContext);
	const [deferredIsLoading, setDeferredIsLoading] = useState<boolean>(true);
	const timeoutHandleRef = useRef<NodeJS.Timeout>()
	const loadInProgress = () => {
		const isLoading = state[loaderId] === undefined || state[loaderId] > 0;
		if (isLoading) {
			return true;
		}
		if (timeoutHandleRef.current === undefined) { 
			timeoutHandleRef.current = setTimeout(() => {
				setDeferredIsLoading(false);
			}, 1000);
		}
		return deferredIsLoading;
	}
	return useMemo(loadInProgress, [loaderId, state, deferredIsLoading]);
  }
  
  export function useLoading() {
	const { loading, presetLoadCount, releaseLoading } = useContext(LoadersContext);
	return { loading, presetLoadCount, releaseLoading} ;
  }

  export function IsLoading({
	loaderId,
	children,
  }: {
	loaderId: string;
	children: any;
  }) {
	const isLoading = useIsLoadingDeferred(loaderId);
	return isLoading && children;
  }
  
  export function IsLoadingMultiple({
	loaderIds,
	children,
  }: {
	loaderIds: string[];
	children: any;
  }) {
	const isLoadings:boolean[] = loaderIds.map(x => useIsLoadingDeferred(x));
	return isLoadings.some(b => b === true) && children;
  }
