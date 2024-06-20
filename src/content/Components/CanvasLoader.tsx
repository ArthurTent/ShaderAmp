import { Html, useProgress } from "@react-three/drei";
import React, { useContext } from "react";
import { IsLoading } from "../Context/LoaderContext";
import { LoaderKey } from "./LoaderHandler";


export const CanvasLoader = () => {
	return (
		<IsLoading loaderId={LoaderKey}>

			<Html
				as="div"
				center
				style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					flexDirection: "column",
				}}
			>

				<span className="canvas-loader"></span>
				<p
					style={{
						fontSize: 14,
						color: "#F1F1F1",
						fontWeight: 800,
						marginTop: 40,
					}}
				>
					LOADING%
				</p>
			</Html>
		</IsLoading>
	);
}
