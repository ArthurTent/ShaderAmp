import * as React from 'react';
import { ShaderAmp } from '../ShaderAmp';
import type { AudioSourceInput, ShaderAmpOptions, ShaderInput, ShaderObject } from '../types';

export interface ShaderAmpCanvasProps
    extends Omit<ShaderAmpOptions, 'container' | 'canvas' | 'source' | 'shader'> {
    source?: AudioSourceInput | React.RefObject<HTMLMediaElement | null>;
    shader?: ShaderInput;
    className?: string;
    style?: React.CSSProperties;
    onReady?: (amp: ShaderAmp) => void;
    onShaderChange?: (s: ShaderObject) => void;
    onError?: (e: Error) => void;
}

const isRef = (s: unknown): s is React.RefObject<HTMLMediaElement | null> =>
    !!s && typeof s === 'object' && 'current' in (s as any);

const resolveSource = (s: ShaderAmpCanvasProps['source']): AudioSourceInput =>
    isRef(s) ? s.current : (s ?? null);

export const ShaderAmpCanvas = React.forwardRef<ShaderAmp | null, ShaderAmpCanvasProps>(
    function ShaderAmpCanvas(props, ref) {
        const {
            source,
            shader,
            className,
            style,
            onReady,
            onShaderChange,
            onError,
            renderScale,
            speedDivider,
            volumeAmplifier,
            fade,
            maxPixelRatio,
            ...rest
        } = props;
        const divRef = React.useRef<HTMLDivElement | null>(null);
        const ampRef = React.useRef<ShaderAmp | null>(null);
        const [amp, setAmp] = React.useState<ShaderAmp | null>(null);

        // Latest-value refs so effect closures don't go stale.
        const onReadyRef = React.useRef(onReady);
        const onErrorRef = React.useRef(onError);
        onReadyRef.current = onReady;
        onErrorRef.current = onError;

        // What the instance was created with; effects only react to later changes.
        const initialShader = React.useRef<ShaderInput | undefined>(undefined);
        const initialSource = React.useRef<AudioSourceInput>(null);

        React.useImperativeHandle<ShaderAmp | null, ShaderAmp | null>(ref, () => ampRef.current, [amp]);

        // Mount once (StrictMode-safe).
        React.useEffect(() => {
            const div = divRef.current;
            if (!div) return;
            let cancelled = false;
            let instance: ShaderAmp | null = null;
            initialShader.current = shader;
            initialSource.current = resolveSource(source);
            ShaderAmp.create({
                container: div,
                shader,
                source: initialSource.current,
                renderScale,
                speedDivider,
                volumeAmplifier,
                fade,
                maxPixelRatio,
                ...rest,
            })
                .then((a) => {
                    if (cancelled) {
                        a.destroy();
                        return;
                    }
                    instance = a;
                    ampRef.current = a;
                    setAmp(a);
                    onReadyRef.current?.(a);
                })
                .catch((e) => {
                    if (!cancelled) onErrorRef.current?.(e as Error);
                });
            return () => {
                cancelled = true;
                ampRef.current = null;
                setAmp(null);
                instance?.destroy();
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // Event subscriptions
        React.useEffect(() => {
            if (!amp || !onShaderChange) return;
            return amp.on('shaderchange', ({ shader: s }) => onShaderChange(s));
        }, [amp, onShaderChange]);
        React.useEffect(() => {
            if (!amp || !onError) return;
            return amp.on('error', ({ error }) => onError(error));
        }, [amp, onError]);

        // source (skip the value create() already consumed)
        const lastSource = React.useRef<AudioSourceInput>(null);
        React.useEffect(() => {
            if (!amp) return;
            lastSource.current = initialSource.current;
            return undefined;
        }, [amp]);
        React.useEffect(() => {
            if (!amp) return;
            const resolved = resolveSource(source);
            if (resolved === lastSource.current) return;
            lastSource.current = resolved;
            amp.setSource(resolved);
        }, [amp, source]);

        // shader (skip the value create() already loaded)
        const lastShader = React.useRef<ShaderInput | undefined>(undefined);
        React.useEffect(() => {
            if (!amp) return;
            lastShader.current = initialShader.current;
            return undefined;
        }, [amp]);
        React.useEffect(() => {
            if (!amp || shader === undefined || shader === lastShader.current) return;
            lastShader.current = shader;
            void amp.loadShader(shader);
        }, [amp, shader]);

        // option updates
        React.useEffect(() => {
            amp?.setOptions({ renderScale, speedDivider, volumeAmplifier, fade, maxPixelRatio });
        }, [amp, renderScale, speedDivider, volumeAmplifier, fade, maxPixelRatio]);

        return React.createElement('div', { ref: divRef, className, style });
    },
);

export function useShaderAmp(): [React.RefObject<ShaderAmp | null>, (amp: ShaderAmp) => void] {
    const ref = React.useRef<ShaderAmp | null>(null);
    const set = React.useCallback((amp: ShaderAmp) => {
        ref.current = amp;
    }, []);
    return [ref, set];
}
