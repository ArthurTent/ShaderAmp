import { Html } from "@react-three/drei";
import React, { useEffect } from "react";
import { Component } from "react";
import { useLoading } from "../Context/LoaderContext";

export const LoaderKey: string = 'canvascomponent';

export default function LoaderHandler() {
	const { loading, releaseLoading } = useLoading();

	useEffect(() => {
		loading(LoaderKey);

		return () => {
			releaseLoading(LoaderKey);
		}
	}, [])
	return (
null	)
}