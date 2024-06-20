// Borrowed from: https://blog.stackademic.com/loading-state-utility-in-react-js-bde4256fa123

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

  
  type LoadingType = (
	loaderId: string
  ) => void;
  
  type LoaderContextType = {
	loading: LoadingType;
	releaseLoading: LoadingType;
	state: Record<string, number>;
  };
  
  const LoadersContext = createContext<LoaderContextType>({} as LoaderContextType);
  
  export function LoadersProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = useState<Record<string, number>>({});
	const loading = useCallback(triggerLoading, []);
	const releaseLoading = useCallback(releaseLoader, []);

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
	}
  
	return (
	  <LoadersContext.Provider value={{ state, loading, releaseLoading }}>
		{children}
	  </LoadersContext.Provider>
	);
  }
  
  export function useIsLoading(loaderId: string): boolean {
	const { state } = useContext(LoadersContext);
	console.log('useIsLoading, state: ', state[loaderId]);
	return useMemo(() => state[loaderId] > 0, [loaderId, state]);
  }
  
  export function useLoading() {
	const { loading, releaseLoading } = useContext(LoadersContext);
	return { loading, releaseLoading} ;
  }

  export function IsLoading({
	loaderId,
	children,
  }: {
	loaderId: string;
	children: any;
  }) {
	const isLoading = useIsLoading(loaderId);
  
	return isLoading && children;
  }