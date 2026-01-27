# Porting a Shadertoy Shader to ShaderAmp

This document describes how to take a shader from https://shadertoy.com and make it work in **ShaderAmp** (this repository).

ShaderAmp’s fragment shaders are stored in `dist/shaders` as `*.frag` files accompanied by a `*.frag.meta` JSON file that describes metadata and runtime options.

## 1) Understand the main differences

On Shadertoy you typically write:

- `void mainImage(out vec4 fragColor, in vec2 fragCoord)`
- plus Shadertoy-provided uniforms like `iResolution`, `iTime`, `iMouse`, `iChannel0..3`, etc.

In ShaderAmp, the shader runs in a WebGL/Three.js pipeline and you need:

- A `main()` entry point.
- A `vUv` varying (UV coordinates for the full-screen quad).
- A small wrapper that converts `vUv` to a Shadertoy-like `fragCoord` and calls `mainImage`.

A working example of this wrapper is in:

- `dist/shaders/MerryChristmasKishimisu.frag`

## 2) Start from a minimal ShaderAmp template

Create a new file in `dist/shaders`, e.g. `MyShader.frag`.

Minimal structure:

```glsl
uniform float iAmplifiedTime;
uniform float iTime;
uniform vec3  iResolution;
uniform vec4  iMouse;

uniform sampler2D iAudioData;
uniform sampler2D iVideo;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

varying vec2 vUv;

/*
Replace this part with the code from shadertoy.com shader
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Paste/port your Shadertoy code here.
    // fragCoord is in pixel coordinates (0..iResolution)
    fragColor = vec4(0.0);
}
*/

void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(gl_FragColor, fragCoord);
}
```

Notes:

- `fragCoord = vUv * iResolution.xy` converts normalized UV coordinates to pixel coordinates.
- If your Shadertoy code uses normalized coordinates, adapt inside `mainImage`, e.g. `vec2 uv = fragCoord / iResolution.xy;`.

## 3) Paste your Shadertoy code

Recommended workflow:

- Keep Shadertoy’s `mainImage(...)` function signature.
- Paste everything from Shadertoy above/around `mainImage` (helpers, SDFs, noise functions, etc.).
- Keep the original Shadertoy uniforms (names like `iTime`, `iResolution`, `iMouse`, `iChannel0`) and declare them as `uniform` at the top.

If the original shader uses Shadertoy-only macros or includes, replace them with local code (ShaderAmp does not run Shadertoy’s include system).

## 4) Map common Shadertoy uniforms to ShaderAmp

ShaderAmp commonly provides the following Shadertoy-style uniforms (seen in `MerryChristmasKishimisu.frag` and in the runtime code):

- `uniform vec3 iResolution;`
  - Viewport size in pixels (xy) and pixel aspect ratio (z, typically 1.0). Matches Shadertoy convention.
- `uniform float iTime;`
  - Time in seconds.
- `uniform float iAmplifiedTime;`
  - A time value that may be “amplified” by audio/reactive logic (useful for music visualizers). If you don’t need it, ignore it.
- `uniform vec4 iMouse;`
  - Mouse input, Shadertoy-style.
- `uniform sampler2D iAudioData;`
  - Audio analysis texture (FFT / waveform depending on how the shader uses it).
- `uniform sampler2D iVideo;`
  - A video texture (configured via `.meta`, see below).
- `uniform sampler2D iChannel0..iChannel3;`
  - Optional texture inputs.

### Audio texture access (FFT)

Many shaders read FFT via `texelFetch(iAudioData, ivec2(x, 0), 0)`.

Example pattern (from `MerryChristmasKishimisu.frag`):

```glsl
#define FFT(a) pow(texelFetch(iAudioData, ivec2(a, 0), 0).x, 5.)
```

If your Shadertoy shader reads `iChannel0` for audio, you will likely need to switch it to `iAudioData` in ShaderAmp.

## 5) Provide a `.meta` file (recommended)

Next to your shader file, create `MyShader.frag.meta` (JSON).

Example (based on `MerryChristmasKishimisu.frag.meta` and the app types):

```json
{
  "author": "OriginalAuthor",
  "modifiedBy": "YourName",
  "shaderName": "My Shader Display Name",
  "url": "https://www.shadertoy.com/view/XXXXX",
  "license": "<license name>",
  "licenseURL": "<license url>",
  "shaderSpeed": 1.0,
  "description": "Optional description.",
  "tab": ["My Tab"],
  "experimental": false,
  "hidden": false
}
```

### Supported/commonly used `.meta` fields

From the codebase (`src/helpers/types.ts`, `src/types/shader.ts`, `src/content/AnalyzerMesh.tsx`, `src/options/TabbedShaderList.tsx`), these fields are used or supported:

- `author`, `modifiedBy`, `shaderName`, `url`, `license`, `licenseURL`
- `shaderSpeed` (number)
- `description` (string)
- `tab`
  - Used for UI grouping. Some shaders use an array (e.g. `["Mouse Input"]`).
- `experimental` (boolean)
- `hidden` (boolean)
  - Shaders with `"hidden": true` are filtered out when building the shader list.

Texture/video inputs:

- `iChannel0`, `iChannel1`, `iChannel2`, `iChannel3`
  - String paths to textures in the extension bundle, e.g. `"images/yourTexture.png"`.
- `video`
  - Path to a video, e.g. `"media/SpaceTravel1Min.mp4"`.
- `usesWebcam`
  - If supported by your build/config, indicates webcam usage.
- `fftSize`
  - FFT size for audio analysis (default mentioned in types: `1024`).

Texture sampling options:

- `textureWrap`: set to `"repeat"` to enable repeat wrapping; otherwise clamp-to-edge is used.
- `textureFlipY`: set to `false` to disable Y flipping for loaded textures (default is flipped).

Custom UI-controlled uniforms:

- `customUniforms`
  - An array describing extra uniforms exposed in the UI (name/type/default/min/max/etc.).
  - See `SHADER_PARAMETERS.md` for details.

## 6) Multipass (buffers) notes

Shadertoy supports multiple passes (Buffer A/B/C/D + Image). ShaderAmp can emulate some multipass behavior via metadata channel references.

In the runtime (`AnalyzerMesh.tsx`) there is logic that treats meta channel values like `"buffer0"`, `"buffer1"`, ... as special buffer references (instead of loading a file texture).

If you want to port a multipass shader:

- Split Shadertoy’s Buffer passes into separate `*.frag` files.
- Configure the main pass and buffers through `.meta` so channels that should read from a buffer are set to `"bufferN"`.

The exact multipass setup depends on ShaderAmp’s current implementation, so use existing multipass examples in `dist/shaders` as reference (files containing `BufferA`, `BufferB`, etc.).

## 7) Add the shader to ShaderAmp

ShaderAmp uses `dist/shaders/list.json` as a catalog. This file is generated by `src/buildShaderList.js` by scanning `dist/shaders` for `*.frag` files and reading matching `.meta` files.

Practical steps:

- Put `MyShader.frag` and `MyShader.frag.meta` into `dist/shaders/`.
- Rebuild/re-run the build step that regenerates `dist/shaders/list.json` (project-specific; see repo scripts).

## 8) Typical porting fixes / troubleshooting

- **Black screen / compile error**
  - Check the browser console for GLSL compile errors.
  - Common issues are missing precision qualifiers (rare in Three.js setups), missing function definitions, or name collisions.

- **Shader uses `fragCoord` but looks stretched**
  - Ensure you compute it in pixels: `fragCoord = vUv * iResolution`.
  - Then inside `mainImage` use `uv = fragCoord / iResolution.xy` as needed.

- **Shader expects Shadertoy `iChannelResolution[]` or `iDate`**
  - Those uniforms may not exist in ShaderAmp. You must remove/replace that logic.

- **Audio looks wrong**
  - Verify you are reading from `iAudioData`.
  - Try adjusting how you interpret the FFT bins (some shaders expect log spacing or different scaling).

- **Textures are upside down**
  - Set `"textureFlipY": false` in `.meta` if needed.

- **Need repeat wrapping**
  - Set `"textureWrap": "repeat"` in `.meta`.

## 9) Reference example

For a concrete, working port including the `main()` wrapper, see:

- `dist/shaders/MerryChristmasKishimisu.frag`
- `dist/shaders/MerryChristmasKishimisu.frag.meta`
