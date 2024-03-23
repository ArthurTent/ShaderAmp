# ShaderAmp

is a free browser plugin for visualizing music on any website. It works with YouTube, Spotify, Soundcloud and so on.

It started as a proof of concept project but with the help of Philipp and Eamon, I was able to create a reactified version of the original project.

***Note***: I'm not the original author of the shaders. I simply adapted them to run with THREE.js and made some of them more aware of the music input. (The authors of the shaders might say that I've screwd them up :D)

## Like what you get?

Consider [ShaderToy Patreon](https://www.patreon.com/shadertoy)

## Installation

If you don't know how to install an unpacked browser extension then you might find [this link](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked) usefull

After installation, you will find a new extension icon which you can click to open ShaderAmp.

We will also release the latest version on the Chrome Web Store soon. Save the date! 

[2024-05-25 @c-base Berlin](https://c-base.org/calendar/#view=month&date=2024-05-01&event=b7be3608-1875-455b-b162-8b201fc1a715)

## Usage hints

- Some shaders require a **powerful** GPU in order to run smooth. If you don't have a powerful GPU, then you shouldn't run the extension in fullscreen. We recommend a 720p resolution for fullscreen.

- Run it on your own risk. We are not responsible for any damage to your hardware.

## Keys

Use 'alt' + L to open ShaderAmp

Use 'alt' + O to open ShaderAmp options

## Development

### Prerequisites
- npm
- node

### Installing ShaderAmp dependencies

```bash
npm install
```

### Compiling ShaderAmp

```bash
npm run build
```

### Running the ShaderAmp in dev mode

```bash
npm run dev
```

## Shader Credits

You will find the original shader authors in the shader files.

## Thanks

- Philipp and Eamon for the help with the reactification of the PoC project
- react-three/fiber for the easy to use react-three-fiber library
- Ricardo Cabello aka mrdoob for creating the amazing [three.js](https://threejs.org/) library and [glsl-sandbox](https://glslsandbox.com/) platform
- Inigo Quilez and Pol Jeremias for creating the amazing [shadertoy](https://www.shadertoy.com/) platform
- The [shadertoy](https://www.shadertoy.com/) community
- To the original authors of the shaders <3
- To the creators of the two default videos included in the project
- @nyancat (X/Twitter) for the permission to use NyanCat in the project (www.nyan.cat)
- DemoScene for many years of visual inspiration
- Nullsoft for creating [Winamp](https://www.winamp.com/)
- And last but not least to MilkDrop for the first visualizer that really whipped the llama's ass.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
However, the shaders are licensed under different licenses. Most of them are licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
Some are using Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License or MIT License.
You can find more information about the license in the [shaders](dist/shaders) folder.
Each Shader file has a link to the original shader and the license. DO NOT REMOVE THIS INFORMATION.

ShaderAmp
<sup><sup>All your BASS are belong to us!<sup></sup>