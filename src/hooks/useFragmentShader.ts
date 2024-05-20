import { fetchFragmentShader } from '@src/helpers/shaderActions';
import { suspend } from 'suspend-react'

export function useFragmentShader(shaderName : string) {
	console.log('useFragmentShader', shaderName);
	console.trace();
	return suspend(async () => {
		console.time('useFragmentShader')
		const fragmentShader = await fetchFragmentShader(shaderName);
		console.timeEnd('useFragmentShader')
		return fragmentShader;
	}, []);
}
