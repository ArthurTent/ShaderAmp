import { Html } from "@react-three/drei";
import React, { useEffect } from "react";
import { Component } from "react";
import { useLoading } from "../Context/LoaderContext";

export const LoaderKey: string = 'canvascomponent';
export const VisualizationsLoaderKey: string = 'visualizations';

export default function LoaderHandler({loaderKey} : { loaderKey: string }) {
	const { loading, releaseLoading } = useLoading();

	useEffect(() => {
		loading(loaderKey);

		return () => {
			releaseLoading(loaderKey);
		}
	}, [])
	return (
null	)
}