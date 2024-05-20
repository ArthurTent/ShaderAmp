import { Viewport } from "@react-three/fiber";
import { TUniform } from "@src/content/AnalyzerMesh";
import { getCurrentDateVector as getCurrentDateTimeVector } from "@src/helpers/utils";
import { useEffect, useRef, useState } from "react";
import { WebGLRenderer, RedFormat, LuminanceFormat, DataTexture, Vector2, Vector4 } from "three";

const fftSize = 128;
const frequencyBinCount = 1024; // Assuming the analyserNode.fftSize is the default 2048;

function createUniforms(viewport: any, fbcArrayRef: any) {
	const format = (new WebGLRenderer().capabilities.isWebGL2) ? RedFormat : LuminanceFormat;
	const dataTexture = new DataTexture(fbcArrayRef, fftSize / 2, 1, format);
	const newUniforms = {
		// Global data
		iResolution: { value: new Vector2(viewport.width, viewport.height) },
		iMouse: { value: new Vector4(viewport.width / 2, viewport.height / 2), type: 'v4', },
		iAudioData: { value: dataTexture },
		iDate: { value: getCurrentDateTimeVector() },
	};
	return newUniforms;
}

export function useUniforms(viewport : Viewport) : TUniform {
	const fbcArrayRef = useRef<Uint8Array>();
	if (fbcArrayRef.current === undefined) {
		fbcArrayRef.current = new Uint8Array(frequencyBinCount)
	}
	const uniformsRef = useRef<TUniform | null>(null);
	function getUniforms() : TUniform {
		if (uniformsRef.current !== null) {
			return uniformsRef.current;
		}
		const uniforms = createUniforms(viewport, fbcArrayRef.current);
		uniformsRef.current = uniforms;
		return uniforms;
	}
	return getUniforms();
}
