import React, { useMemo } from "react";
import { IsLoadingMultiple, useProgress } from "../Context/LoaderContext";
import { LoaderKey, VisualizationsLoaderKey } from "./LoaderHandler";

export const CanvasLoader = () => {
	const { progress, maxProgress } = useProgress(VisualizationsLoaderKey);	

	const getProgressBarWidth = () => {
		if (!maxProgress) {
			return '0%';
		}
		const widthPercentage = (progress / maxProgress) * 100;
		return `${widthPercentage}%`;
	}	

	const progressBarStyle = useMemo(() => { return {
		width: getProgressBarWidth()
	}}, [progress, maxProgress]);
	
	// No need to render anything when loading is complete.
	if (progress === maxProgress) {
		return null;
	}

	return (
		<IsLoadingMultiple loaderIds={[LoaderKey, VisualizationsLoaderKey]}>
			<div className="flex flex-col fixed w-screen h-screen items-center justify-center z-[100] bg-gray-950">
				<div className="w-1/3 bg-gray-200 mb-2 rounded-full h-2.5 dark:bg-gray-700">
					<div className="bg-blue-800 h-2.5 rounded-full" style={progressBarStyle}></div>
				</div>
				<div className="flex justify-center items-center space-x-1 text-sm text-gray-100">
					<svg fill='none' className="w-6 h-6 animate-spin" viewBox="0 0 32 32" xmlns='http://www.w3.org/2000/svg'>
						<path clipRule='evenodd'
							d='M15.165 8.53a.5.5 0 01-.404.58A7 7 0 1023 16a.5.5 0 011 0 8 8 0 11-9.416-7.874.5.5 0 01.58.404z'
							fill='currentColor' fillRule='evenodd' />
					</svg>
					<div>Loading ...</div>
				</div>
			</div>
		</IsLoadingMultiple>
	);
}
