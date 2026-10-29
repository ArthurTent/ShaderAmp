import type {
    OverlayBlendMode,
    OverlayState,
    SceneCondition,
    SceneEdge,
    SceneGraph,
    SceneNode,
    ScenePlayMode,
    ShaderObject,
} from '../types';

export type SceneClock = {
    /** Displayed shader time in seconds ('auto' timeSource). */
    time?: number;
    iTime?: number;
    iAmplifiedTime?: number;
    /** True on the frame where a wait-for-audio gate opened (restarts the scene). */
    gateOpened?: boolean;
};

/**
 * Hooks the player needs from the host renderer. Everything storage-related in
 * the extension's SceneController is replaced by these callbacks.
 */
export interface ScenePlayerHooks {
    /** Resolve a node/edge shaderRef (builtin name or imported/packaged ref) to a shader. */
    resolveShader: (ref: string) => ShaderObject | undefined;
    /** Make a shader the active render program. */
    activateShader: (shader: ShaderObject) => void | Promise<void>;
    /** Merge uniform override values for a shader (persisted per shader name). */
    applyUniforms: (shaderName: string, values: Record<string, any>) => void | Promise<void>;
    /** Read a current custom-uniform value (for 'uniform' conditions). */
    getUniform: (shaderName: string, name: string) => any;
    /** Currently active shader name (activation dedupe + uniform-node default). */
    currentShaderName: () => string | undefined;
    /** Apply/clear the rendered overlay layer. */
    setOverlay: (state: OverlayState | null) => void;
    /** Rewind the shader clock (playMode 'reset'). */
    resetShaderClock: () => void;
    /** Called whenever a node is entered (for 'scenenode' events). */
    onEnterNode?: (scene: SceneGraph, node: SceneNode) => void;
    /** Called when play state flips (for 'scenechange' events). */
    onStateChange?: (scene: SceneGraph | null, playing: boolean) => void;
}

/**
 * Scene graph playback engine — a storage-free port of the extension's
 * SceneController. Drives node traversal from the render loop: call `tick()`
 * every frame with the shader clock, `onBeat()` per detected beat and
 * `onAudioLevel()` with the current RMS level.
 */
export class ScenePlayer {
    private scenes: SceneGraph[] = [];
    private activeSceneId: string | null = null;
    private isPlaying = false;
    private currentNodeId: string | null = null;
    private lastShaderTime = 0;
    private nodeStartShaderTime = 0;
    private nodeBeatCount = 0;
    private graphBeatCount = 0;
    private lastAudioLevel = 0;
    private conditionResolvedOnce = false;
    private audioAboveSince: number | null = null;
    private clockPaused = false;
    private lastActivatedShaderName: string | null = null;
    private desiredOverlay: OverlayState | null = null;
    private manualOverlay: { ref: string; state: OverlayState } | null = null;
    private queue: Promise<void> = Promise.resolve();

    // Clock jumps bigger than this (seek, resetTime) re-enter the scene graph
    // at the new position instead of just re-clamping the per-node hold.
    private static readonly SEEK_JUMP_THRESHOLD_S = 2.0;

    constructor(private hooks: ScenePlayerHooks) {}

    // ---- scene registry ----

    addScene(scene: SceneGraph): void {
        const idx = this.scenes.findIndex((s) => s.id === scene.id);
        if (idx >= 0) this.scenes[idx] = scene;
        else this.scenes.push(scene);
    }

    removeScene(id: string): boolean {
        const idx = this.scenes.findIndex((s) => s.id === id);
        if (idx < 0) return false;
        this.scenes.splice(idx, 1);
        if (this.activeSceneId === id) void this.stop();
        return true;
    }

    listScenes(): SceneGraph[] {
        return [...this.scenes];
    }

    findScene(id: string): SceneGraph | null {
        return this.scenes.find((s) => s.id === id) || null;
    }

    get activeScene(): SceneGraph | null {
        return this.activeSceneId ? this.findScene(this.activeSceneId) : null;
    }

    get playing(): boolean {
        return this.isPlaying;
    }

    get paused(): boolean {
        return this.clockPaused;
    }

    get currentNode(): SceneNode | null {
        const scene = this.activeScene;
        return scene?.nodes.find((n) => n.id === this.currentNodeId) ?? null;
    }

    // ---- transport ----

    private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.queue.then(fn);
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    private notifyState(): void {
        this.hooks.onStateChange?.(this.activeScene, this.isPlaying);
    }

    /** Start a scene by id (or a graph object, which gets registered first). */
    play(sceneIdOrGraph: string | SceneGraph, mode: ScenePlayMode = 'keep'): Promise<void> {
        return this.runExclusive(async () => {
            const scene = typeof sceneIdOrGraph === 'string' ? this.findScene(sceneIdOrGraph) : sceneIdOrGraph;
            if (!scene) return;
            if (typeof sceneIdOrGraph !== 'string') this.addScene(scene);
            this.clockPaused = false;
            const restartSame = this.isPlaying && this.activeSceneId === scene.id;
            this.activeSceneId = scene.id;
            this.isPlaying = true;
            this.notifyState();
            if (mode === 'reset') {
                this.lastShaderTime = 0;
                this.hooks.resetShaderClock();
            }
            this.lastActivatedShaderName = restartSame ? this.lastActivatedShaderName : (this.hooks.currentShaderName() ?? null);
            await this.resetGraph();
        });
    }

    stop(): Promise<void> {
        return this.runExclusive(async () => {
            if (!this.isPlaying && !this.activeSceneId) return;
            this.isPlaying = false;
            this.activeSceneId = null;
            this.currentNodeId = null;
            this.clockPaused = false;
            this.desiredOverlay = null;
            this.manualOverlay = null;
            this.flushOverlay();
            this.notifyState();
        });
    }

    /** Freeze/unfreeze the scene graph (the shader clock keeps running). */
    togglePause(): Promise<void> {
        return this.runExclusive(async () => {
            if (!this.isPlaying) return;
            this.clockPaused = !this.clockPaused;
        });
    }

    /** Follow the current node's manual edge (or first outgoing edge). */
    manualAdvance(): Promise<void> {
        return this.runExclusive(async () => {
            if (this.clockPaused || !this.isPlaying || !this.currentNodeId) return;
            const scene = this.activeScene;
            const node = scene?.nodes.find((n) => n.id === this.currentNodeId);
            if (!scene || !node) return;
            const outgoing = scene.edges.filter((e) => e.source === node.id);
            const edge = outgoing.find((e) => e.trigger.type === 'manual') ?? outgoing[0];
            if (edge) {
                await this.enterNode(edge.target, scene);
                await this.evaluateChain(scene, edge.target, this.lastShaderTime, { enter: true });
            }
        });
    }

    /** Jump the shader clock and re-evaluate the graph at that time. */
    seek(time: number): Promise<void> {
        return this.runExclusive(async () => {
            if (typeof time !== 'number' || !isFinite(time)) return;
            this.lastShaderTime = time;
            this.nodeStartShaderTime = time;
            this.graphBeatCount = 0;
            this.nodeBeatCount = 0;
            this.audioAboveSince = null;
            this.lastActivatedShaderName = this.hooks.currentShaderName() ?? null;
            const scene = this.activeScene;
            const start = scene ? this.getStartNode(scene) : null;
            const firstEdge = scene && start ? scene.edges.find((e) => e.source === start.id) : null;
            if (this.isPlaying && scene && firstEdge) {
                this.desiredOverlay = null;
                await this.enterNode(firstEdge.target, scene);
                await this.evaluateChain(scene, firstEdge.target, time, { enter: true });
            }
        });
    }

    // ---- per-frame / per-beat drivers ----

    tick(clock: number | SceneClock): Promise<void> {
        return this.runExclusive(async () => {
            const gateOpened = typeof clock === 'object' && clock?.gateOpened === true;
            if (gateOpened && this.isPlaying) {
                this.lastShaderTime = 0;
                this.nodeStartShaderTime = 0;
                await this.resetGraph();
            }
            const shaderTime = typeof clock === 'object' && clock !== null ? this.resolveShaderTime(clock) : clock;
            if (typeof shaderTime === 'number' && isFinite(shaderTime)) {
                if (this.isPlaying && !gateOpened &&
                    Math.abs(shaderTime - this.lastShaderTime) > ScenePlayer.SEEK_JUMP_THRESHOLD_S) {
                    this.lastShaderTime = shaderTime;
                    this.nodeStartShaderTime = shaderTime;
                    this.graphBeatCount = 0;
                    this.nodeBeatCount = 0;
                    this.audioAboveSince = null;
                    const scene = this.activeScene;
                    const start = scene ? this.getStartNode(scene) : null;
                    const firstEdge = scene && start ? scene.edges.find((e) => e.source === start.id) : null;
                    if (scene && firstEdge) {
                        this.desiredOverlay = null;
                        await this.enterNode(firstEdge.target, scene);
                        await this.evaluateChain(scene, firstEdge.target, shaderTime, { enter: true });
                    }
                }
                this.lastShaderTime = shaderTime;
                if (shaderTime < this.nodeStartShaderTime) {
                    this.nodeStartShaderTime = shaderTime;
                }
            }
            if (this.clockPaused || !this.isPlaying || !this.currentNodeId) return;
            const scene = this.activeScene;
            let node = scene?.nodes.find((n) => n.id === this.currentNodeId);
            if (!scene) return;
            if (!node) {
                await this.resetGraph();
                return;
            }

            await this.evaluateChain(scene, node.id, this.lastShaderTime, { enter: true });

            // Looping: a terminal node idles until re-running the graph from
            // the start would land somewhere different — then restart for real.
            node = scene.nodes.find((n) => n.id === this.currentNodeId);
            if (node && scene.isLooping && scene.edges.every((e) => e.source !== node!.id)) {
                const start = this.getStartNode(scene);
                const firstEdge = start ? scene.edges.find((e) => e.source === start.id) : null;
                if (firstEdge) {
                    const virtualEnd = await this.evaluateChain(scene, firstEdge.target, this.lastShaderTime, { enter: false });
                    if (virtualEnd && virtualEnd !== this.currentNodeId) {
                        this.desiredOverlay = null;
                        await this.enterNode(firstEdge.target, scene);
                        await this.evaluateChain(scene, firstEdge.target, this.lastShaderTime, { enter: true });
                    }
                }
            }
        });
    }

    onBeat(): Promise<void> {
        return this.runExclusive(async () => {
            if (this.clockPaused || !this.isPlaying || !this.currentNodeId) return;
            const scene = this.activeScene;
            const node = scene?.nodes.find((n) => n.id === this.currentNodeId);
            if (!scene) return;
            if (!node) {
                await this.resetGraph();
                return;
            }
            this.nodeBeatCount++;
            this.graphBeatCount++;
            await this.evaluateChain(scene, node.id, this.lastShaderTime, { enter: true });
        });
    }

    onAudioLevel(level: number): void {
        this.lastAudioLevel = level;
    }

    // ---- manual overlay layer (MIDI / API triggers) ----

    private flushOverlay(): void {
        this.hooks.setOverlay(this.manualOverlay?.state ?? this.desiredOverlay);
    }

    private buildOverlayState(shaderRef: string, opacity = 1, blendMode: OverlayBlendMode = 'additive'): OverlayState | null {
        const shader = this.hooks.resolveShader(shaderRef);
        if (!shader) {
            console.warn(`[shaderamp] could not resolve overlay shader ref ${shaderRef}`);
            return null;
        }
        return { shader, opacity: Math.min(1, Math.max(0, opacity)), blendMode: blendMode === 'normal' ? 'normal' : 'additive' };
    }

    async manualOverlayAction(msg: {
        action: 'show' | 'release' | 'toggle' | 'opacity' | 'hide';
        shaderRef?: string | null;
        opacity?: number;
        blendMode?: OverlayBlendMode;
    }): Promise<void> {
        return this.runExclusive(async () => {
            const ref = msg.shaderRef || null;
            const show = () => {
                if (!ref) return;
                const state = this.buildOverlayState(ref, msg.opacity ?? 1, msg.blendMode ?? 'additive');
                if (state) this.manualOverlay = { ref, state };
            };
            switch (msg.action) {
                case 'show': show(); break;
                case 'release': if (ref && this.manualOverlay?.ref === ref) this.manualOverlay = null; break;
                case 'toggle': if (ref && this.manualOverlay?.ref === ref) this.manualOverlay = null; else show(); break;
                case 'hide': this.manualOverlay = null; break;
                case 'opacity': {
                    if (!ref) break;
                    const opacity = Math.min(1, Math.max(0, msg.opacity ?? 0));
                    if (opacity <= 0.001) { if (this.manualOverlay?.ref === ref) this.manualOverlay = null; }
                    else if (this.manualOverlay?.ref === ref) this.manualOverlay = { ref, state: { ...this.manualOverlay.state, opacity } };
                    else show();
                    break;
                }
            }
            this.flushOverlay();
        });
    }

    get overlayState(): OverlayState | null {
        return this.manualOverlay?.state ?? this.desiredOverlay;
    }

    // ---- graph traversal ----

    private getStartNode(scene: SceneGraph): SceneNode | null {
        return scene.nodes.find((n) => n.type === 'start') || scene.nodes[0] || null;
    }

    private async resetGraph(): Promise<void> {
        const scene = this.activeScene;
        if (!scene) {
            this.currentNodeId = null;
            return;
        }
        this.graphBeatCount = 0;
        this.audioAboveSince = null;
        const start = this.getStartNode(scene);
        if (!start) return;
        const firstEdge = scene.edges.find((e) => e.source === start.id);
        if (firstEdge) {
            this.desiredOverlay = null;
            await this.enterNode(firstEdge.target, scene);
            await this.evaluateChain(scene, firstEdge.target, this.lastShaderTime, { enter: true });
        }
        this.flushOverlay();
    }

    private async enterNode(nodeId: string, scene: SceneGraph): Promise<void> {
        const node = scene.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        this.currentNodeId = nodeId;
        this.nodeStartShaderTime = this.lastShaderTime;
        this.nodeBeatCount = 0;
        this.conditionResolvedOnce = false;
        this.audioAboveSince = null;
        this.hooks.onEnterNode?.(scene, node);

        if (node.type === 'scene') {
            await this.activateShaderNode(node);
        } else if (node.type === 'uniform') {
            await this.applyUniformNode(node);
        } else if (node.type === 'overlay') {
            if (node.data.overlayAction === 'hide' || !node.data.shaderRef) {
                this.desiredOverlay = null;
            } else {
                const state = this.buildOverlayState(node.data.shaderRef, node.data.overlayOpacity ?? 1, node.data.overlayBlendMode ?? 'additive');
                if (state) this.desiredOverlay = state;
            }
            this.flushOverlay();
        }
    }

    private async activateShaderNode(node: SceneNode): Promise<void> {
        if (!node.data.shaderRef) return;
        const shader = this.hooks.resolveShader(node.data.shaderRef);
        if (!shader) {
            console.warn(`[shaderamp] could not resolve scene shader ref ${node.data.shaderRef}`);
            return;
        }
        await this.applyUniformOverrides(shader.shaderName, node.data.uniformOverrides);
        if (this.lastActivatedShaderName === shader.shaderName) return;
        this.lastActivatedShaderName = shader.shaderName;
        await this.hooks.activateShader(shader);
    }

    private async applyUniformNode(node: SceneNode): Promise<void> {
        const shaderName = node.data.shaderRef
            ? this.hooks.resolveShader(node.data.shaderRef)?.shaderName
            : this.hooks.currentShaderName();
        if (!shaderName) return;
        await this.applyUniformOverrides(shaderName, node.data.uniformOverrides);
    }

    private async applyUniformOverrides(shaderName: string, overrides: Record<string, any> = {}): Promise<void> {
        const values = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
        if (Object.keys(values).length === 0) return;
        await this.hooks.applyUniforms(shaderName, values);
    }

    private async evaluateChain(scene: SceneGraph, startNodeId: string, t: number, opts: { enter: boolean }): Promise<string | null> {
        const MAX_HOPS = 32;
        let nodeId: string | null = startNodeId;
        let vNodeStart = t;
        let vNodeBeatCount = 0;
        let vAudioAboveSince: number | null = null;

        for (let hop = 0; hop < MAX_HOPS; hop++) {
            if (!nodeId) break;
            const node = scene.nodes.find((n) => n.id === nodeId);
            if (!node) return nodeId;

            const nodeStart = opts.enter ? this.nodeStartShaderTime : vNodeStart;
            const nodeBeats = opts.enter ? this.nodeBeatCount : vNodeBeatCount;
            let audioAbove = opts.enter ? this.audioAboveSince : vAudioAboveSince;

            let target: string | null = null;

            if (node.type === 'condition') {
                const condition = node.data.condition;
                if (condition) {
                    let result: boolean | null;
                    if (condition.kind === 'random') {
                        if (!opts.enter) {
                            return null;
                        } else if (this.conditionResolvedOnce) {
                            result = null;
                        } else {
                            this.conditionResolvedOnce = true;
                            result = this.resolveCondition(condition);
                        }
                    } else {
                        result = this.resolveCondition(condition);
                    }
                    if (result !== null) {
                        const edge = scene.edges.find((e) => e.source === node.id && e.sourceHandle === (result ? 'true' : 'false'));
                        if (edge) target = edge.target;
                    }
                }
            } else {
                const elapsed = t - nodeStart;
                const outgoing = scene.edges.filter((e) => e.source === node.id);

                const audioEdges = outgoing.filter((e) => e.trigger.type === 'audio');
                if (audioEdges.length > 0) {
                    const met = audioEdges.some((e) => this.lastAudioLevel >= (e.trigger as { threshold: number }).threshold);
                    if (met && audioAbove === null) {
                        audioAbove = t;
                        if (opts.enter) this.audioAboveSince = t; else vAudioAboveSince = t;
                    } else if (!met && audioAbove !== null) {
                        audioAbove = null;
                        if (opts.enter) this.audioAboveSince = null; else vAudioAboveSince = null;
                    }
                }

                for (const edge of outgoing) {
                    const tr = edge.trigger;
                    if (tr.type === 'time' && elapsed >= tr.durationSeconds) { target = edge.target; break; }
                    if (tr.type === 'beat' && nodeBeats >= tr.beatCount) { target = edge.target; break; }
                    if (tr.type === 'audio' && audioAbove !== null &&
                        this.lastAudioLevel >= tr.threshold && t - audioAbove >= (tr.holdSeconds || 0.2)) {
                        target = edge.target;
                        break;
                    }
                }

                if (target === null && (node.type === 'scene' || node.type === 'overlay') && node.data.durationSeconds && elapsed >= node.data.durationSeconds && outgoing.length > 0) {
                    target = outgoing[0].target;
                }
            }

            if (target === null) return nodeId;
            nodeId = target;
            if (opts.enter) {
                await this.enterNode(nodeId, scene);
            } else {
                vNodeStart = t;
                vNodeBeatCount = 0;
                vAudioAboveSince = null;
            }
        }
        return nodeId;
    }

    private compareValues(actual: any, operator: string, expected: any): boolean {
        const a = typeof actual === 'string' && !isNaN(Number(actual)) ? Number(actual) : actual;
        const b = typeof expected === 'string' && !isNaN(Number(expected)) ? Number(expected) : expected;
        switch (operator) {
            case '==': return a == b;
            case '!=': return a != b;
            case '>': return a > b;
            case '>=': return a >= b;
            case '<': return a < b;
            case '<=': return a <= b;
            default: return false;
        }
    }

    private resolveCondition(condition: SceneCondition): boolean {
        switch (condition.kind) {
            case 'audio':
                return this.compareValues(this.lastAudioLevel, condition.operator, condition.value);
            case 'time':
                return this.lastShaderTime >= condition.seconds;
            case 'beat':
                return this.graphBeatCount >= condition.count;
            case 'uniform': {
                const shaderName = condition.shaderRef
                    ? (this.hooks.resolveShader(condition.shaderRef)?.shaderName ?? condition.shaderRef)
                    : this.hooks.currentShaderName();
                if (!shaderName) return false;
                const actual = this.hooks.getUniform(shaderName, condition.name);
                return this.compareValues(actual, condition.operator, condition.value);
            }
            case 'random':
                return Math.random() < condition.probability;
            default:
                return false;
        }
    }

    private resolveShaderTime(clock: SceneClock): number | undefined {
        const source = this.activeScene?.timeSource ?? 'auto';
        if (source === 'auto') {
            return typeof clock.time === 'number' && isFinite(clock.time) ? clock.time : undefined;
        }
        const picked = source === 'iTime' ? clock.iTime : clock.iAmplifiedTime;
        return typeof picked === 'number' && isFinite(picked) ? picked : undefined;
    }
}
