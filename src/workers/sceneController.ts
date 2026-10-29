import browser from "webextension-polyfill";
import { getStorage, setStorage, setStorageMany } from "@src/storage/storage";
import { STATE_CURRENT_SHADER, STATE_SCENES, STATE_ACTIVE_SCENE_ID, STATE_SCENE_PLAYING, STATE_SCENE_PLAY_MODE, STATE_SCENE_CURRENT_NODE_ID, STATE_SCENE_GRAPH_BEAT_COUNT, STATE_SCENE_NODE_START_TIME, STATE_SCENE_NODE_BEAT_COUNT, STATE_SCENE_CLOCK_PAUSED, STATE_SCENE_HOLD, STATE_OVERLAY } from "@src/storage/storageConstants";
import { RESET_TIME } from "@src/helpers/constants";
import type { SceneGraph, SceneNode, SceneEdge, SceneTrigger, SceneCondition, ShaderObject, ShaderOptions, OverlayState, OverlayBlendMode } from "@src/helpers/types";
import WorkerState from "./workerState";
import { relayMediaControl } from "@src/helpers/mediaControlRelay";
import { logger } from "@src/helpers/logger";
import type { OverlayManualAction } from "@src/helpers/overlayMappingActions";

export type ScenePlayMode = 'reset' | 'keep';

export type UnifiedShaderEntry =
    | { kind: 'builtin'; catalogIndex: number; shader: ShaderObject }
    | { kind: 'imported'; importedId: string; shader: ShaderObject }
    | { kind: 'custom'; customId: string; shader: ShaderObject };

export class SceneController {
    workerState: WorkerState;
    private scenes: SceneGraph[] = [];
    private activeSceneId: string | null = null;
    private isPlaying = false;
    private currentNodeId: string | null = null;
    // Shader-clock fields, in seconds. Driven by SCENE_TICK messages from the
    // content page carrying the shader's displayed time (iAmplifiedTime when
    // enabled, iTime otherwise). If/Else time conditions compare against this
    // absolute shader clock directly; per-node timing (time edges, Duration,
    // audio hold) is relative to nodeStartShaderTime.
    private lastShaderTime = 0;
    private nodeStartShaderTime = 0;
    private nodeBeatCount = 0;
    private lastAudioLevel = 0;
    private graphBeatCount = 0;
    private tickTimer: ReturnType<typeof setInterval> | null = null;
    private lastActivatedShaderName: string | null = null;
    private conditionResolvedOnce = false;
    private lastMissingWarnAt = 0;
    // Clock jumps bigger than this (media scrub, RESET_TIME/SET_TIME seeks)
    // re-enter the scene graph at the new position instead of just re-clamping
    // the per-node hold. Limitation: extreme shaderSpeed values could cross
    // this between 100 ms ticks on an iAmplifiedTime scene.
    private static readonly SEEK_JUMP_THRESHOLD_S = 2.0;
    private hasTicked = false;
    // Editor transport: clockPaused freezes the shader clock AND the scene graph;
    // sceneHold freezes only the graph (the shader clock keeps running).
    private clockPaused = false;
    private sceneHold = false;
    // Mirrors of the last values SEEN in storage. The onChanged listener uses
    // these (not this.activeSceneId/this.isPlaying) to fill in the missing key
    // of a partial change event, because the queued setActive may not have run
    // yet and the controller fields would be stale.
    private storedActiveSceneId: string | null = null;
    private storedPlaying = false;
    // Audio-edge hold is measured from the moment the level first met the
    // current node's audio thresholds (not from node entry).
    private audioAboveSince: number | null = null;
    // All stateful entry points are serialized through this promise chain so
    // concurrent ticks/beats/seeks can't interleave storage writes.
    private queue: Promise<void> = Promise.resolve();
    private tickPending = false;
    private lastMessageTickAt = 0;
    private lastPersistedSnapshot: string | null = null;
    private desiredOverlay: OverlayState | null = null;
    // Manual overlay layer (MIDI/joystick/shader-list triggers). Takes priority
    // over the scene layer (desiredOverlay); releasing it restores the scene's.
    private manualOverlay: { ref: string; state: OverlayState } | null = null;
    private lastWrittenOverlayJson: string | undefined = undefined;

    constructor(workerState: WorkerState) {
        this.workerState = workerState;
    }

    async initialize() {
        await this.loadScenes();
        this.registerStorageListener();
    }

    private async loadScenes() {
        const [scenes, activeSceneId, isPlaying, currentNodeId, graphBeatCount, nodeStartTime, nodeBeatCount, clockPaused, sceneHold] = await Promise.all([
            getStorage<SceneGraph[]>(STATE_SCENES, []),
            getStorage<string | null>(STATE_ACTIVE_SCENE_ID, null),
            getStorage<boolean>(STATE_SCENE_PLAYING, false),
            getStorage<string | null>(STATE_SCENE_CURRENT_NODE_ID, null),
            getStorage<number | null>(STATE_SCENE_GRAPH_BEAT_COUNT, null),
            getStorage<number | null>(STATE_SCENE_NODE_START_TIME, null),
            getStorage<number | null>(STATE_SCENE_NODE_BEAT_COUNT, null),
            getStorage<boolean>(STATE_SCENE_CLOCK_PAUSED, false),
            getStorage<boolean>(STATE_SCENE_HOLD, false),
        ]);
        this.scenes = scenes || [];
        this.storedActiveSceneId = activeSceneId || null;
        this.storedPlaying = !!isPlaying;
        this.currentNodeId = currentNodeId || null;
        this.clockPaused = !!clockPaused;
        this.sceneHold = !!sceneHold;
        if (graphBeatCount !== null) this.graphBeatCount = graphBeatCount;
        if (nodeStartTime !== null) this.nodeStartShaderTime = nodeStartTime;
        if (nodeBeatCount !== null) this.nodeBeatCount = nodeBeatCount;
        // Service-worker restart: never re-send RESET_TIME here, that would yank the
        // running visualizer's clock back to 0 every time the popup wakes the worker.
        await this.setActive(activeSceneId, isPlaying, { fromRestart: true });
    }

    private registerStorageListener() {
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') return;
            if (changes[STATE_ACTIVE_SCENE_ID]) {
                this.storedActiveSceneId = changes[STATE_ACTIVE_SCENE_ID].newValue ?? null;
            }
            if (changes[STATE_SCENE_PLAYING]) {
                this.storedPlaying = !!changes[STATE_SCENE_PLAYING].newValue;
            }
            if (changes[STATE_SCENES]) {
                // Update the scene definitions but do NOT restart traversal: resetting
                // currentNodeId on every editor write would prevent time- and
                // beat-based conditions from ever accumulating enough history.
                this.scenes = changes[STATE_SCENES].newValue || [];
            }
            if (changes[STATE_SCENE_CLOCK_PAUSED]) {
                this.clockPaused = !!changes[STATE_SCENE_CLOCK_PAUSED].newValue;
            }
            if (changes[STATE_SCENE_HOLD]) {
                this.sceneHold = !!changes[STATE_SCENE_HOLD].newValue;
            }
            if (changes[STATE_ACTIVE_SCENE_ID] || changes[STATE_SCENE_PLAYING]) {
                const newActive = changes[STATE_ACTIVE_SCENE_ID]?.newValue ?? this.storedActiveSceneId;
                const newPlaying = changes[STATE_SCENE_PLAYING]?.newValue ?? this.storedPlaying;
                logger.background.log('Scene', 'storage change -> setActive %s playing=%s', newActive, newPlaying);
                this.setActive(newActive, newPlaying);
                return;
            }
        });
    }

    private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.queue.then(fn);
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    private async setActive(sceneId: string | null, isPlaying: boolean, opts: { fromRestart?: boolean } = {}) {
        return this.runExclusive(() => this.setActiveInner(sceneId, isPlaying, opts));
    }

    private async setActiveInner(sceneId: string | null, isPlaying: boolean, opts: { fromRestart?: boolean } = {}) {
        const wasPlaying = this.isPlaying;
        const previousSceneId = this.activeSceneId;
        this.activeSceneId = sceneId || null;
        this.isPlaying = !!isPlaying && !!this.activeSceneId && this.findScene(this.activeSceneId) !== null;
        this.workerState.setScenePlaying(this.isPlaying);

        if (!this.isPlaying) {
            this.stopTick();
            this.currentNodeId = null;
            this.clockPaused = false;
            this.sceneHold = false;
            this.hasTicked = false;
            this.desiredOverlay = null;
            await this.flushOverlay();
            await this.clearPersistedSceneState();
            return;
        }

        const sceneChanged = wasPlaying && previousSceneId !== null && previousSceneId !== this.activeSceneId;
        const scene = this.findScene(this.activeSceneId!)!;
        const canResume = !sceneChanged && !!this.currentNodeId && scene.nodes.some(n => n.id === this.currentNodeId);
        logger.background.log('Scene', 'setActive %s playing=%s wasPlaying=%s sceneChanged=%s fromRestart=%s',
            sceneId, isPlaying, wasPlaying, sceneChanged, !!opts.fromRestart);

        if (wasPlaying && !sceneChanged && this.currentNodeId !== null) {
            // Nothing to do: already playing this scene.
            logger.background.log('Scene', 'setActive %s: already playing, nothing to do', sceneId);
            return;
        }

        await this.seedLastActivatedShaderName();

        if (canResume && opts.fromRestart) {
            // Resume from the persisted node without rewriting the active shader.
            logger.background.log('Scene', 'setActive %s: resume from persisted node', sceneId);
            this.startTick();
            return;
        }

        // Fresh start (user pressed Play, or switched to a different scene while playing).
        if (!opts.fromRestart) {
            await this.applyPlayMode();
        }
        logger.background.log('Scene', 'setActive %s: fresh start', sceneId);
        this.lastActivatedShaderName = sceneChanged ? this.lastActivatedShaderName : null;
        await this.resetGraph();
        this.startTick();
    }

    /**
     * Honour the play mode chosen in the editor: 'reset' rewinds the visualizer's
     * shader clock (iTime / iAmplifiedTime / iFrame) to 0 so If/Else time
     * conditions start from scratch; 'keep' leaves the clock running.
     */
    private async applyPlayMode() {
        const mode = await getStorage<ScenePlayMode>(STATE_SCENE_PLAY_MODE, 'keep');
        if (mode === 'reset') {
            this.lastShaderTime = 0;
            browser.runtime.sendMessage({ command: RESET_TIME }).catch(() => {});
        }
    }

    /** Restart the currently playing scene from its start node, optionally rewinding shader time. */
    async restart(mode: ScenePlayMode) {
        return this.runExclusive(() => this.restartInner(mode));
    }

    private async restartInner(mode: ScenePlayMode) {
        if (!this.isPlaying || !this.activeSceneId) return;
        logger.background.log('Scene', 'restart %s mode=%s', this.activeSceneId, mode);
        if (mode === 'reset') {
            this.lastShaderTime = 0;
            browser.runtime.sendMessage({ command: RESET_TIME }).catch(() => {});
        }
        await this.resetGraph();
    }

    /**
     * Start a scene by id (MIDI/joystick "Play scene" mappings). Writes the
     * storage keys the storage listener reacts to rather than calling
     * setActive directly, so the listener's setActive does the start.
     */
    async playSceneById(sceneId: string, mode: ScenePlayMode = 'keep') {
        return this.runExclusive(async () => {
            const scene = this.findScene(sceneId);
            logger.background.log('Scene', 'playSceneById %s mode=%s isPlaying=%s activeSceneId=%s found=%s',
                sceneId, mode, this.isPlaying, this.activeSceneId, !!scene);
            if (!scene) return;
            await setStorage(STATE_SCENE_CLOCK_PAUSED, false);
            await setStorage(STATE_SCENE_PLAY_MODE, mode);
            if (this.isPlaying && this.activeSceneId === sceneId) {
                // Storage keys won't change, so restart explicitly.
                await this.restartInner(mode);
            } else {
                // One write so the storage listener sees both keys in a single
                // change event — separate writes would fill the missing key
                // from state that is still stale while runExclusive holds the lock.
                await setStorageMany({ [STATE_ACTIVE_SCENE_ID]: sceneId, [STATE_SCENE_PLAYING]: true });
            }
            void relayMediaControl('play');
        });
    }

    /** Stop scene playback (mirrors the editor's Stop). */
    async stopScene() {
        return this.runExclusive(async () => {
            await setStorage(STATE_SCENE_CLOCK_PAUSED, false);
            await setStorage(STATE_SCENE_PLAYING, false);
        });
    }

    /** Toggle the editor clock pause while a scene is playing. */
    async togglePause() {
        return this.runExclusive(async () => {
            if (!this.isPlaying) return;
            const next = !this.clockPaused;
            await setStorage(STATE_SCENE_CLOCK_PAUSED, next);
            void relayMediaControl(next ? 'pause' : 'play');
        });
    }

    private async seedLastActivatedShaderName() {
        const current = await getStorage<ShaderObject>(STATE_CURRENT_SHADER, undefined as any);
        this.lastActivatedShaderName = current?.shaderName || null;
    }

    private async persistSceneState() {
        await Promise.all([
            setStorage(STATE_SCENE_CURRENT_NODE_ID, this.currentNodeId),
            setStorage(STATE_SCENE_GRAPH_BEAT_COUNT, this.graphBeatCount),
            setStorage(STATE_SCENE_NODE_START_TIME, this.nodeStartShaderTime),
            setStorage(STATE_SCENE_NODE_BEAT_COUNT, this.nodeBeatCount),
        ]);
    }

    private async clearPersistedSceneState() {
        await chrome.storage.local.remove([
            STATE_SCENE_CURRENT_NODE_ID,
            STATE_SCENE_GRAPH_BEAT_COUNT,
            STATE_SCENE_NODE_START_TIME,
            STATE_SCENE_NODE_BEAT_COUNT,
            STATE_SCENE_CLOCK_PAUSED,
            STATE_SCENE_HOLD,
        ]);
    }

    private startTick() {
        if (this.tickTimer) return;
        this.tickTimer = setInterval(() => {
            // Fallback cadence only — SCENE_TICK messages carry the clock while
            // the content page is alive; the interval covers a silent page.
            if (Date.now() - this.lastMessageTickAt > 1000) void this.tick();
        }, 100);
    }

    private stopTick() {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
    }

    private findScene(id: string): SceneGraph | null {
        return this.scenes.find(s => s.id === id) || null;
    }

    private getStartNode(scene: SceneGraph): SceneNode | null {
        return scene.nodes.find(n => n.type === 'start') || scene.nodes[0] || null;
    }

    // Persist only when the public state actually moved — chained evaluation
    // can enter several nodes per tick and must not write per hop.
    private async persistIfChanged() {
        await this.flushOverlay();
        const snap = JSON.stringify([this.currentNodeId, this.nodeStartShaderTime, this.nodeBeatCount, this.graphBeatCount]);
        if (snap === this.lastPersistedSnapshot) return;
        this.lastPersistedSnapshot = snap;
        await this.persistSceneState();
    }

    private async resetGraph() {
        const scene = this.activeSceneId ? this.findScene(this.activeSceneId) : null;
        if (!scene) {
            this.currentNodeId = null;
            return;
        }
        this.graphBeatCount = 0;
        this.audioAboveSince = null;
        const start = this.getStartNode(scene);
        if (!start) return;
        const firstEdge = scene.edges.find(e => e.source === start.id);
        if (firstEdge) {
            this.desiredOverlay = null;
            await this.enterNode(firstEdge.target, scene);
            await this.evaluateChain(scene, firstEdge.target, this.lastShaderTime, { enter: true });
        }
        await this.persistIfChanged();
    }

    // Entering a node only activates its shader/uniforms and resets the
    // per-node anchors. Evaluation is the caller's job (evaluateChain).
    private async enterNode(nodeId: string, scene: SceneGraph) {
        const node = scene.nodes.find(n => n.id === nodeId);
        if (!node) return;
        this.currentNodeId = nodeId;
        this.nodeStartShaderTime = this.lastShaderTime;
        this.nodeBeatCount = 0;
        this.conditionResolvedOnce = false;
        this.audioAboveSince = null;

        if (node.type === 'scene') {
            await this.activateShaderNode(node);
        } else if (node.type === 'uniform') {
            await this.applyUniformNode(node);
        } else if (node.type === 'overlay') {
            this.applyOverlayNode(node);
        }
    }

    private async flushOverlay() {
        const effective = this.manualOverlay?.state ?? this.desiredOverlay;
        const json = JSON.stringify(effective);
        if (json === this.lastWrittenOverlayJson) return;
        this.lastWrittenOverlayJson = json;
        await setStorage(STATE_OVERLAY, effective);
    }

    private buildOverlayState(shaderRef: string, opacity = 1, blendMode: OverlayBlendMode = 'additive'): OverlayState | null {
        const entry = this.resolveShaderEntry(shaderRef);
        if (!entry) {
            console.warn(`[ShaderAmp SceneController] Could not resolve overlay shader ref ${shaderRef}`);
            return null;
        }
        return { shader: entry.shader, opacity: Math.min(1, Math.max(0, opacity)), blendMode: blendMode === 'normal' ? 'normal' : 'additive' };
    }

    private applyOverlayNode(node: SceneNode) {
        if (node.data.overlayAction === 'hide' || !node.data.shaderRef) {
            this.desiredOverlay = null;
            return;
        }
        const state = this.buildOverlayState(node.data.shaderRef, node.data.overlayOpacity ?? 1, node.data.overlayBlendMode ?? 'additive');
        if (state) this.desiredOverlay = state;
    }

    /**
     * Manual overlay triggers (MIDI/joystick mappings, shader-list hold button,
     * scene-editor preview). The manual layer sits on top of the scene layer:
     * releasing/hiding it restores whatever the scene last asked for.
     */
    async manualOverlayAction(msg: { action: OverlayManualAction; shaderRef?: string | null; opacity?: number; blendMode?: OverlayBlendMode }) {
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
            await this.flushOverlay();
        });
    }

    async previewOverlay(shaderRef: string | null, opacity = 1, blendMode: OverlayBlendMode = 'additive') {
        return this.manualOverlayAction(shaderRef ? { action: 'show', shaderRef, opacity, blendMode } : { action: 'hide' });
    }

    // Walk the graph from `startNodeId`, following whichever edge fires at
    // clock time `t`, until nothing fires (max 32 hops guards zero-time cycles).
    // Returns the node id the chain ends on.
    //
    // enter:true  — real traversal: each hop calls enterNode and mutates state.
    // enter:false — virtual traversal (loop preview): no state is touched, so
    //               per-hop anchors are simulated locally. Random conditions
    //               "stay" in virtual mode (stop the chain).
    private async evaluateChain(scene: SceneGraph, startNodeId: string, t: number, opts: { enter: boolean }): Promise<string | null> {
        const MAX_HOPS = 32;
        let nodeId: string | null = startNodeId;
        // Virtual per-hop state mirrors what enterNode would reset.
        let vNodeStart = t;
        let vNodeBeatCount = 0;
        let vAudioAboveSince: number | null = null;

        for (let hop = 0; hop < MAX_HOPS; hop++) {
            if (!nodeId) break;
            const node = scene.nodes.find(n => n.id === nodeId);
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
                            // Virtual randomness is unknowable — signal "no
                            // change" so the loop check doesn't churn.
                            return null;
                        } else if (this.conditionResolvedOnce) {
                            result = null; // already resolved for this entry
                        } else {
                            this.conditionResolvedOnce = true;
                            result = await this.resolveCondition(condition);
                        }
                    } else {
                        result = await this.resolveCondition(condition);
                    }
                    if (result !== null) {
                        const edge = scene.edges.find(e => e.source === node.id && e.sourceHandle === (result ? 'true' : 'false'));
                        if (edge) target = edge.target;
                    }
                }
            } else {
                const elapsed = t - nodeStart;
                const outgoing = scene.edges.filter(e => e.source === node.id);

                // Audio edges: track when the level first met any of this
                // node's thresholds; reset when it drops below all of them.
                const audioEdges = outgoing.filter(e => e.trigger.type === 'audio');
                if (audioEdges.length > 0) {
                    const met = audioEdges.some(e => this.lastAudioLevel >= (e.trigger as { threshold: number }).threshold);
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

                // Scene/overlay-node auto-advance after its duration.
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

    private async applyUniformNode(node: SceneNode) {
        const shaderName = node.data.shaderRef
            ? this.resolveShaderEntry(node.data.shaderRef)?.shader.shaderName
            : (await getStorage<ShaderObject | undefined>(STATE_CURRENT_SHADER))?.shaderName;
        if (!shaderName) return;
        await this.applyUniformOverrides(shaderName, node.data.uniformOverrides);
    }

    private async applyUniformOverrides(shaderName: string, overrides: Record<string, any> = {}) {
        const values = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
        if (Object.keys(values).length === 0) return;
        const key = `customUniforms_${shaderName}`;
        const saved = await getStorage<Record<string, any>>(key, {});
        await setStorage(key, { ...saved, ...values });
    }

    private async activateShaderNode(node: SceneNode) {
        if (!node.data.shaderRef) return;
        const entry = this.resolveShaderEntry(node.data.shaderRef);
        if (!entry) {
            console.warn(`[ShaderAmp SceneController] Could not resolve shader ref ${node.data.shaderRef}`);
            return;
        }

        const shader = entry.shader;
        await this.applyUniformOverrides(shader.shaderName, node.data.uniformOverrides);

        if (this.lastActivatedShaderName === shader.shaderName) {
            logger.background.log('Scene', 'skip %s: already active', shader.shaderName);
            return;
        }
        this.lastActivatedShaderName = shader.shaderName;
        logger.background.log('Scene', 'activate %s (%s)', shader.shaderName, entry.kind);

        if (entry.kind === 'builtin') {
            await setStorage(STATE_CURRENT_SHADER, shader);
        } else {
            await browser.storage.local.set({ 'state.currentshader': shader });
        }
    }

    private resolveShaderEntry(shaderRef: string): UnifiedShaderEntry | null {
        const builtinIndex = this.workerState.shaderCatalog.shaders.findIndex(s => s.shaderName === shaderRef);
        if (builtinIndex !== -1) {
            return { kind: 'builtin', catalogIndex: builtinIndex, shader: this.workerState.shaderCatalog.shaders[builtinIndex] };
        }
        const imported = (this.workerState.importedShaders || []).find(imp => imp.id === shaderRef);
        if (imported) {
            const inlineBuffers: { [filename: string]: string } = {};
            for (const buffer of imported.bufferShaders || []) {
                inlineBuffers[buffer.filename] = buffer.code;
            }
            return {
                kind: 'imported',
                importedId: imported.id,
                shader: {
                    shaderName: imported.mainShader.filename,
                    metaData: imported.mainShader.meta as any,
                    inlineCode: imported.mainShader.code,
                    inlineBuffers: Object.keys(inlineBuffers).length > 0 ? inlineBuffers : undefined,
                    inlineSound: imported.soundShader?.code,
                }
            };
        }
        const custom = (this.workerState.customShaders || []).find((c: any) => c.id === shaderRef);
        if (custom) {
            return {
                kind: 'custom',
                customId: custom.id,
                shader: {
                    shaderName: custom.shaderName,
                    metaData: custom.metaData,
                    inlineCode: custom.inlineCode,
                    inlineBuffers: custom.inlineBuffers,
                    inlineSound: custom.inlineSound,
                }
            };
        }
        return null;
    }

    private async performTransition(scene: SceneGraph, edge: SceneEdge) {
        await this.enterNode(edge.target, scene);
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

    private async resolveCondition(condition: SceneCondition): Promise<boolean> {
        switch (condition.kind) {
            case 'audio':
                return this.compareValues(this.lastAudioLevel, condition.operator, condition.value);
            case 'time':
                // Absolute shader clock: fires once iTime / iAmplifiedTime itself reaches the threshold.
                return this.lastShaderTime >= condition.seconds;
            case 'beat':
                return this.graphBeatCount >= condition.count;
            case 'uniform': {
                const current = await getStorage<ShaderObject>(STATE_CURRENT_SHADER, undefined as any);
                const shaderName = condition.shaderRef || current?.shaderName;
                if (!shaderName) return false;
                const values = await getStorage<Record<string, any>>(`customUniforms_${shaderName}`, {} as any);
                const actual = values?.[condition.name];
                return this.compareValues(actual, condition.operator, condition.value);
            }
            case 'random':
                return Math.random() < condition.probability;
            default:
                return false;
        }
    }

    // Resolves which reported clock drives scene timing for the active scene's
    // timeSource. 'auto' uses the displayed `time`; an explicit source with a
    // missing/non-finite field returns undefined rather than silently falling
    // back to a different clock.
    private resolveShaderTime(clock: { time?: number; iTime?: number; iAmplifiedTime?: number; gateOpened?: boolean }): number | undefined {
        const source = this.activeSceneId ? (this.findScene(this.activeSceneId)?.timeSource ?? 'auto') : 'auto';
        if (source === 'auto') {
            return typeof clock.time === 'number' && isFinite(clock.time) ? clock.time : undefined;
        }
        const picked = source === 'iTime' ? clock.iTime : clock.iAmplifiedTime;
        if (typeof picked !== 'number' || !isFinite(picked)) {
            const now = Date.now();
            if (now - this.lastMissingWarnAt > 5000) {
                console.warn('[ShaderAmp Scene] SCENE_TICK missing', source, clock);
                this.lastMissingWarnAt = now;
            }
            return undefined;
        }
        return picked;
    }

    async tick(clock?: number | { time?: number; iTime?: number; iAmplifiedTime?: number; gateOpened?: boolean }) {
        if (typeof clock === 'object' && clock !== null) {
            this.lastMessageTickAt = Date.now();
        }
        // Drop (don't queue) a tick while one is in flight — a slow storage
        // write must not build a backlog of stale evaluations.
        if (this.tickPending) return;
        this.tickPending = true;
        try {
            await this.runExclusive(() => this.tickInner(clock));
        } finally {
            this.tickPending = false;
        }
    }

    private async tickInner(clock?: number | { time?: number; iTime?: number; iAmplifiedTime?: number; gateOpened?: boolean }) {
        // The wait-for-audio gate just opened: the shader clock restarted from 0,
        // so the scene restarts from its start node on the same footing.
        if (typeof clock === 'object' && clock?.gateOpened && this.isPlaying) {
            this.lastShaderTime = 0;
            this.nodeStartShaderTime = 0;
            await this.resetGraph();
        }
        const gateOpenedThisTick = typeof clock === 'object' && clock?.gateOpened === true;
        const shaderTime = typeof clock === 'object' && clock !== null ? this.resolveShaderTime(clock) : clock;
        if (typeof shaderTime === 'number' && isFinite(shaderTime)) {
            // A large clock jump (media scrub, RESET_TIME/SET_TIME) means the
            // scene position is stale — re-enter the graph at the new time and
            // let the rest of this tick evaluate conditions there immediately.
            if (this.isPlaying && this.hasTicked && !gateOpenedThisTick &&
                Math.abs(shaderTime - this.lastShaderTime) > SceneController.SEEK_JUMP_THRESHOLD_S) {
                await this.seekInner(shaderTime);
            }
            this.lastShaderTime = shaderTime;
            this.hasTicked = true;
            if (shaderTime < this.nodeStartShaderTime) {
                // Shader clock was rewound (Reset Time) — restart the per-node hold too.
                this.nodeStartShaderTime = shaderTime;
            }
        }
        // Transport paused or scene held: keep recording the clock but freeze
        // the graph (no conditions, edges, or durations evaluate).
        if (this.clockPaused || this.sceneHold) return;
        if (!this.isPlaying || !this.currentNodeId) return;
        const scene = this.findScene(this.activeSceneId!);
        if (!scene) return;
        let node = scene.nodes.find(n => n.id === this.currentNodeId);
        if (!node) {
            await this.resetGraph();
            return;
        }

        await this.evaluateChain(scene, node.id, this.lastShaderTime, { enter: true });

        // Looping: a terminal node idles until re-running the graph from the
        // start would land somewhere different — then restart for real.
        node = scene.nodes.find(n => n.id === this.currentNodeId);
        if (node && scene.isLooping && scene.edges.every(e => e.source !== node!.id)) {
            const start = this.getStartNode(scene);
            const firstEdge = start ? scene.edges.find(e => e.source === start.id) : null;
            if (firstEdge) {
                const virtualEnd = await this.evaluateChain(scene, firstEdge.target, this.lastShaderTime, { enter: false });
                if (virtualEnd && virtualEnd !== this.currentNodeId) {
                    this.desiredOverlay = null;
                    await this.enterNode(firstEdge.target, scene);
                    await this.evaluateChain(scene, firstEdge.target, this.lastShaderTime, { enter: true });
                }
            }
        }

        await this.persistIfChanged();
    }

    async onBeat() {
        return this.runExclusive(() => this.onBeatInner());
    }

    private async onBeatInner() {
        if (this.clockPaused || this.sceneHold) return;
        if (!this.isPlaying || !this.currentNodeId) return;
        const scene = this.findScene(this.activeSceneId!);
        if (!scene) return;
        const node = scene.nodes.find(n => n.id === this.currentNodeId);
        if (!node) {
            await this.resetGraph();
            return;
        }

        this.nodeBeatCount++;
        this.graphBeatCount++;
        await this.evaluateChain(scene, node.id, this.lastShaderTime, { enter: true });
        await this.persistIfChanged();
    }

    onAudioLevel(level: number) {
        this.lastAudioLevel = level;
    }

    async manualAdvance() {
        return this.runExclusive(() => this.manualAdvanceInner());
    }

    private async manualAdvanceInner() {
        if (this.clockPaused || this.sceneHold) return;
        if (!this.isPlaying || !this.currentNodeId) return;
        const scene = this.findScene(this.activeSceneId!);
        if (!scene) return;
        const node = scene.nodes.find(n => n.id === this.currentNodeId);
        if (!node) return;
        const outgoing = scene.edges.filter(e => e.source === node.id);
        let hopped = false;
        for (const edge of outgoing) {
            if (edge.trigger.type === 'manual') {
                await this.performTransition(scene, edge);
                hopped = true;
                break;
            }
        }
        // If no manual edge, fall back to the first available edge
        if (!hopped && outgoing.length > 0) {
            await this.performTransition(scene, outgoing[0]);
            hopped = true;
        }
        if (hopped) {
            await this.evaluateChain(scene, this.currentNodeId!, this.lastShaderTime, { enter: true });
        }
        await this.persistIfChanged();
    }

    /** Editor timeline seek: jump the shader clock and re-evaluate the graph at that time. */
    async seek(time: number) {
        return this.runExclusive(() => this.seekInner(time));
    }

    private async seekInner(time: number) {
        if (typeof time !== 'number' || !isFinite(time)) return;
        logger.background.log('Scene', 'seek %s -> %s', this.lastShaderTime, time);
        this.lastShaderTime = time;
        this.nodeStartShaderTime = time;
        this.graphBeatCount = 0;
        this.nodeBeatCount = 0;
        this.audioAboveSince = null;
        // Re-seed the activation dedupe so a shader the user changed manually
        // gets restored by the graph instead of being skipped as "unchanged".
        await this.seedLastActivatedShaderName();
        if (this.isPlaying && this.activeSceneId) {
            const scene = this.findScene(this.activeSceneId);
            const start = scene ? this.getStartNode(scene) : null;
            const firstEdge = scene && start ? scene.edges.find(e => e.source === start.id) : null;
            if (scene && firstEdge) {
                this.desiredOverlay = null;
                await this.enterNode(firstEdge.target, scene);
                await this.evaluateChain(scene, firstEdge.target, time, { enter: true });
            }
            await this.persistIfChanged();
        }
    }
}
