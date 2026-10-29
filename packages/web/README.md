# shaderamp

Audio-reactive Shadertoy-style shader visualizer for any website — the web-library sibling of the [ShaderAmp browser extension](../../README.md). Feed it an `<audio>`/`<video>` element, a `MediaStream`, or an existing Web Audio node, and it renders the same 185 bundled shaders (plus your own) into a canvas on your page.

## Install

```bash
npm install shaderamp three
```

`three` (>= 0.159, < 0.170) is a peer dependency. `react` (>= 17) is an optional peer, only needed for `shaderamp/react`.

## Quick start

### Vanilla

```ts
import { ShaderAmp } from 'shaderamp';

const amp = await ShaderAmp.create({
    container: document.getElementById('viz')!, // or canvas: myCanvas
    source: document.querySelector('audio')!,
    shader: 'AGiftForYou.frag',                 // file name or display name
    controls: { pip: true, fullscreen: true, navigation: true, credits: true },
});

pipButton.onclick = () => amp.togglePictureInPicture(); // must be in a user gesture
```

### React

```tsx
import { ShaderAmpCanvas } from 'shaderamp/react';

const audioRef = useRef<HTMLAudioElement>(null);
<ShaderAmpCanvas
    source={audioRef}
    assetBaseUrl="/shaderamp-assets/"
    controls
    onReady={(amp) => console.log(amp.currentShader)}
/>;
```

## Try it

From `packages/web`:

```sh
npm install
npm run dev        # copies the shader assets, then starts Vite
```

Open the URL Vite prints (default `http://localhost:5173`) at:

- `/demo.html` — simplest demo: drag & drop a music file (or click to choose), pick a shader, PiP/fullscreen buttons
- `/demo/index.html` — vanilla demo with file input, microphone source and render-scale slider
- `/demo/react.html` — React `<ShaderAmpCanvas>` demo

For an automated check, `npm test` runs the unit tests and `npm run typecheck` type-checks everything.

## Options

| Option | Default | Notes |
|---|---|---|
| `container` | — | A `<div class="shaderamp-root">` + canvas is created inside. Exactly one of `container`/`canvas`. |
| `canvas` | — | Render into an existing canvas (no overlay controls). |
| `source` | `null` | `HTMLMediaElement` \| `MediaStream` \| `{ node: AudioNode }` \| `null` |
| `shader` | `3DAudioVisualizerNumber2.frag` | catalog file/display name, `ShaderObject`, or `CustomShader` |
| `assetBaseUrl` | jsDelivr CDN of this package | see "Assets" below |
| `mediaBaseUrl` | unset | base for `media/*.mp4` channel refs; unset → they map to `iVideo` |
| `audioContext` | created lazily | reuse the host page's context |
| `connectToDestination` | element: `true`, stream/node: `false` | |
| `renderScale` | `0.75` | render-resolution scale |
| `maxPixelRatio` | `2` | |
| `speedDivider` | `25` | audio-reactivity of `iAmplifiedTime` |
| `volumeAmplifier` | `1` | gain on the analyser branch only |
| `fade` | `true` (0.8 s) | `false` or `{ duration }` |
| `videoTexture` | `'auto'` | `'auto'` \| `'none'` \| `HTMLVideoElement` \| URL string → `iVideo` |
| `mouse` | `true` | pointer events on the canvas |
| `keyboard` | `'canvas'` | `'canvas'` \| `'window'` \| `false` |
| `controls` | `false` | `true` or `{ pip, fullscreen, navigation, credits }` |
| `autoStart` | `true` | |
| `pauseWhenHidden` | `true` | IntersectionObserver; never pauses while in PiP |
| `scenes` | `[]` | `SceneGraph[]` registered up front (see Scenes) |
| `midi` | `false` | `true` or `{ mappings }` — requests Web MIDI on create |
| `trackSync` | `false` | drive `iTime` from the media element's `currentTime` — seeks/pauses keep scene `time` conditions aligned to the track |
| `amplifiedTime` | `true` | `false` → `iAmplifiedTime` mirrors `iTime`; scene `'auto'` timeSource follows whichever clock is displayed |
| `eqGains` | all `0` | 10-band EQ in dB (31 Hz … 16 kHz, `EQ_FREQUENCIES`) on the analysed signal only (extension `settings.eqGains`) |
| `waitForAudio` | `false` | hold `iTime`/`iAmplifiedTime`/`iFrame` at 0 until audio is detected (extension `settings.waitForAudioStart`) |
| `videoFollowTime` | `false` | keep the `iVideo` element on `iTime` (mod duration) instead of rate-following the audio |
| `soundBuffer` | `true` | run a shader's sound pass (`metaData.soundShader` / `inlineSound`) on the GPU; it feeds the analyser and may read buffer/cube/volume passes and the keyboard via `soundChannels` |
| `soundOutput` | `true` | also play the sound pass through the speakers (`false` → analyser only) |
| `showCredits` | `false` | draw "name by author" bottom-left **into the image** (canvas mode, `captureStream()`) |
| `showFps` | `false` | draw an FPS counter top-left into the image |
| `size`, `frameLoop`, `frameRate`, `adaptiveScale`, `foreground` | — | off-DOM / `captureStream()` rendering; see the type docs |

`setOptions()` changes `renderScale`, `maxPixelRatio`, `speedDivider`, `volumeAmplifier`, `eqGains`, `fade`, `trackSync`, `amplifiedTime`, `waitForAudio`, `videoTexture`, `videoFollowTime`, `soundBuffer`, `soundOutput`, `showCredits` and `showFps` live. A `renderScale` change resizes the render targets in place, without reloading the shader. An explicit `videoTexture` element (e.g. a webcam) takes precedence over a shader's own `metaData.video`.

### Multipass

Buffer A–D (`metaData.buffers`, read as `bufferN`) are double-buffered float targets, so a pass can read its own previous frame. Shadertoy cubemap passes (`metaData.cubemapPasses`, read as `cubemapX`; 1024² per face; `iCubeFace`) and volume passes (`metaData.volumePasses`, read as `volumeX`; `resolution`³, default 128; `iVolumeSlice`) render in the same order as the extension: volume, then cube, then buffers, then image. A volume whose code reads no time, audio, mouse or channels is baked once.

## Methods & events

```ts
amp.setSource(src);            amp.resumeAudio();
await amp.loadShader(input);   await amp.next() / amp.prev() / amp.random();
await amp.listShaders();       amp.setUniform(name, value);
amp.setOptions(partial);       amp.resetTime();
amp.setCustomUniformValues(shaderName, { iFoo: 0.5 }); // stored per-shader values, applied on (re)load
amp.start(); amp.stop();       amp.toggleFullscreen();
await amp.enterPictureInPicture({ mode, width, height }); // user gesture required
await amp.exitPictureInPicture();  await amp.togglePictureInPicture();
amp.on('ready'|'shaderchange'|'beat'|'error'|'pipenter'|'pipexit'|'scenechange'|'scenenode'|'midievent'|'clock', cb); // returns unsubscribe
amp.destroy();                 // idempotent; does not close a user-provided AudioContext
```

Readonly: `canvas`, `root`, `currentShader`, `analyser`, `audioContext`, `isPictureInPicture`, `activeScene`, `isScenePlaying`, `isScenePaused`, `isMidiActive`. Statics: `ShaderAmp.isSupported()`, `ShaderAmp.isPictureInPictureSupported()`.

## Scenes

Scene graphs authored in the extension's scene editor (`start`/`scene`/`uniform`/`condition`/`overlay` nodes wired by `time`/`beat`/`audio`/`manual` edges) play back identically here — ticked by the render loop, driven by the shader clock, detected beats and the audio RMS level.

```ts
// Register a scene from a .zip package exported by the extension
const file = await fetch('/my-scene.shaderamp.zip').then(r => r.blob());
const scene = await amp.importScene(file);   // packaged shaders + media come along

// …or hand it a SceneGraph object / JSON
await amp.importScene(sceneGraphJson);

await amp.playScene(scene.id, { mode: 'reset' }); // 'reset' rewinds the shader clock to 0 (use it for timeline scenes)
await amp.advanceScene();                    // follow a 'manual' edge
await amp.toggleScenePause();                // freeze the graph (clock keeps running)
await amp.seekScene(30);                     // re-evaluate at t=30s
await amp.stopScene();
amp.listScenes();  amp.removeScene(id);
amp.listImportedShaders();                   // shaders that arrived via scene imports

// Overlay layer (same feature as scene overlay nodes / overlay mappings)
amp.setOverlay('OverlayBassRing.frag', { opacity: 0.8, blendMode: 'additive' });
amp.setOverlay(null);
```

Packaged `custom_images/`, `custom_videos/`, `custom_cubemaps/` and `custom_volumes/` media are unpacked to blob URLs / 3D textures and resolve automatically in shader channels. Imported shaders also join `next()`/`prev()`/`random()` navigation and resolve via `loadShader(name)` — like the extension's unified shader list.

## MIDI mappings

```ts
await amp.enableMidi(mappings);   // navigator.requestMIDIAccess; false when unsupported/denied
amp.setMidiMappings(mappings);
amp.getMidiInputs();              // [{ id, name }]
amp.disableMidi();
```

Uses the extension's `MidiMapping` format (`source: { type: 'cc'|'noteon', channel, number }`, `target`, `min`, `max`, `encoderMode`, `buttonMode`, `step`, `overlayOpacity`, `overlayBlendMode`). Supported targets: `prevShader`, `nextShader`, `resetTime`, `toggleShaderFade`, `renderScale`, `speedDivider`, `volumeAmplifier`, `fftInject`, `uniform:<name>`, `selectShader:<ref>`, `sceneStop`, `sceneTogglePause`, `playScene:<id>`, `overlay:<ref>`, `overlayHide`. Note events also feed the `iMidi` texture (rows: held / just-pressed / just-released / velocity).

## Audio sources & CORS

- For an `<audio>`/`<video>` element playing cross-origin content, set `crossorigin="anonymous"` on the element and make sure the server sends CORS headers — otherwise the analyser outputs silence (the library logs a warning). Same-origin, `blob:`, and `data:` URLs are fine.
- `createMediaElementSource` can be called **only once per element for its whole lifetime**. shaderamp caches the node per element, so recreating a `ShaderAmp` on the same element is safe — but you cannot create a second `MediaElementAudioSourceNode` for it anywhere else either.
- Autoplay policies may leave the `AudioContext` `suspended`; shaderamp resumes it on `play`/first pointer or key gesture. Call `amp.resumeAudio()` inside a user gesture if you need it earlier.
- `MediaStream` (e.g. microphone) and `{ node }` sources are **not** connected to the destination by default (avoids feedback / respects host routing).

## Picture-in-Picture

- `enterPictureInPicture` must be called from a user gesture (transient activation).
- **Document PiP** (Chrome/Edge 116+): the canvas moves into a real window — mouse/keyboard keep working and rendering continues even while the main tab is hidden.
- **Video PiP** (Safari): the canvas streams into a `<video>` in PiP — no interaction, and rendering is driven by a 33 ms timer while the tab is hidden.
- **Firefox**: no PiP API — `isPictureInPictureSupported()` is `false` and the overlay PiP button hides itself.

## Assets

Shaders/textures default to the CDN (`https://cdn.jsdelivr.net/npm/shaderamp@<version>/assets/`). To self-host, copy `node_modules/shaderamp/assets` into your public folder and set `assetBaseUrl`, e.g. `'/shaderamp-assets/'`. The bundled `media/*.mp4` videos from the extension are **not shipped**; point `mediaBaseUrl` at your own copies if a shader references them.

## Writing custom shaders

Pass a `CustomShader` to `loadShader`: `{ code, name?, buffers?: [{ code, output, channels? }], channels?, shaderSpeed?, customUniforms? }`. Bundled shaders use the ShaderAmp dialect documented in [SHADER_PARAMETERS.md](../../SHADER_PARAMETERS.md): they declare their own uniforms (`uniform float iTime;` etc.), render with `void main()` writing `gl_FragColor`, and get `vUv * iResolution.xy` as `fragCoord`. Uniforms include `iTime`, `iAmplifiedTime`, `iTimeDelta`, `iFrameRate`, `iFrame`, `iDate`, `iAudioData`, `iSampleRate`, `iResolution`, `iVideo`, `iMouse`, `iKeyboard`, `iChannel0..3`, `iChannelResolution`, `iChannelTime`, `iTransitionOpacity`, `iMidi`, `iJoystick`, `iVRMode`.

## Licenses

- **Library code: MIT** (see `LICENSE`).
- **Each bundled shader keeps its own license.** Most are CC BY-NC-SA — non-commercial and attribution required. See `assets/SHADER_LICENSES.md` for the full list, enable `controls.credits` or `showCredits`, or read `amp.currentShader.metaData` for attribution. Do not use NC shaders on commercial sites.

## Limitations

No VR rendering (`mainVR` shaders still run flat), no joystick, no webcam/screen capture of its own (pass a `<video>` as `videoTexture`), bundled `media/*.mp4` videos not shipped. Extension-only MIDI targets tied to settings storage (`randomize*`, `toggleWebcam`, `eqBand:*`, …) are ignored.
