// MIT Licensed
// Copyright 2023 by Arthur Tent

var video = document.getElementById('video-bg');
if (video) {
	// start the background video
	setTimeout(() => { video.play(); }, 300);
}

// GLSL Shaders require to be part of the DOM
// to do: make this smarter
function loadShadersToDOM() {
	document.getElementById('symbolism_frag').innerHTML = symbolism_frag;
	document.getElementById('GatoNegroPasa_frag').innerHTML = GatoNegroPasa_frag;
	document.getElementById('PsychedelicEye_frag').innerHTML = PsychedelicEye_frag;
	document.getElementById('SolumObject_frag').innerHTML = SolumObject_frag;
	document.getElementById('AudioReactiveScene1stAttempt_frag').innerHTML = AudioReactiveScene1stAttempt_frag;
	document.getElementById('Hexagone_frag').innerHTML = Hexagone_frag;
	document.getElementById('StarFieldArtOfCode_frag').innerHTML = StarFieldArtOfCode_frag;
	document.getElementById('Warpspeed_frag').innerHTML = Warpspeed_frag;
	document.getElementById('VinylVisualizer_frag').innerHTML = VinylVisualizer_frag;
	document.getElementById('Otherworldy_frag').innerHTML = Otherworldy_frag;

	document.getElementById('Iloveyouall_frag').innerHTML = Iloveyouall_frag;
	document.getElementById('fftexperiment_frag').innerHTML = fftexperiment_frag;
	document.getElementById('frequencyballs_frag').innerHTML = frequencyballs_frag;
	document.getElementById('inFX_frag').innerHTML = inFX_frag;
	document.getElementById('BasicAudioVisualizer_frag').innerHTML = BasicAudioVisualizer_frag;
	document.getElementById('DDDAudioVisualizer_frag').innerHTML = DDDAudioVisualizer_frag;
	document.getElementById('AbstractMusic_frag').innerHTML = AbstractMusic_frag;
	document.getElementById('MovingWithoutTravelling_frag').innerHTML = MovingWithoutTravelling_frag;
	document.getElementById('SoundOscilloscopeFromSpectrum_frag').innerHTML = SoundOscilloscopeFromSpectrum_frag;

	document.getElementById('ReadyPlayerOne_frag').innerHTML = ReadyPlayerOne_frag;
	document.getElementById('NeonOctagonalAudioVisualizer_frag').innerHTML = NeonOctagonalAudioVisualizer_frag;
	document.getElementById('SonicPulse_frag').innerHTML = SonicPulse_frag;
	document.getElementById('FluidicSpace_frag').innerHTML = FluidicSpace_frag;
	document.getElementById('MusicalHeart_frag').innerHTML = MusicalHeart_frag;
	document.getElementById('Informer_frag').innerHTML = Informer_frag;
	document.getElementById('FFTStrings_frag').innerHTML = FFTStrings_frag;
	document.getElementById('ShitJustGotReal_frag').innerHTML = ShitJustGotReal_frag;
	document.getElementById('ShatterFlake_frag').innerHTML = ShatterFlake_frag;
}
loadShadersToDOM();

var canvas, // analyzer canvas
	ctx, // 2d anayzer rendering context
	fill_color = "#4087A0", // fill color for the 2d analyzer
	audioContext,
	analyser,
	fbc_array,
	bar_count,
	bar_pos,
	bar_width,
	bar_height,
	min_speed,
	speed_devider,
	shader_factor;

var threejs_canvas, renderer, scene, camera, clock, tuniform, mat;
let draw_analyzer = false;
let show_credits = false;
let auto_random_shader = false;
let webcam;
const fftSize = 128;


min_speed = 0.3;
speed_devider = 25.1;
shader_factor = 1.0;

function tabCapture() {
	return new Promise((resolve) => {
		chrome.tabCapture.capture(
			{
				audio: true,
				video: false,
			},
			(stream) => {
				resolve(stream);
			}
		);
	});
}

function sendMessageToTab(tabId, data) {
	return new Promise((resolve) => {
		chrome.tabs.sendMessage(tabId, data, (res) => {
			resolve(res);
		});
	});
}

function enableShaders() {
	video_bg = document.getElementById("video-bg");
	video_bg.setAttribute("hidden", "hidden");
	document.getElementById("threejs").setAttribute("style", "visibility: visible;")
	mat.vertexShader = document.getElementById('general_purpose_vertex_shader').textContent;
}

async function startRecord(option) {

	const stream = await tabCapture();
	if (stream) {
		// call when the stream is inactive
		stream.oninactive = () => {
			window.close();
		};
		let analyserDataArray = null;
		const audioDataCache = [];
		audioContext = new AudioContext();
		const mediaStream = audioContext.createMediaStreamSource(stream);
		const recorder = audioContext.createScriptProcessor(0, 1, 1);


		analyser = audioContext.createAnalyser();
		mediaStream.connect(analyser);

		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		clock = new THREE.Clock();

		renderer = new THREE.WebGLRenderer();
		renderer.setSize(window.innerWidth, window.innerHeight);
		threejs_canvas = renderer.domElement;
		renderer.domElement.setAttribute("id", "threejs")
		document.body.appendChild(renderer.domElement);

		const planeGeometry = new THREE.PlaneGeometry(2, 2, 1, 1);
		const geometry = new THREE.BoxGeometry(1, 1, 1);
		const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

		const format = (renderer.capabilities.isWebGL2) ? THREE.RedFormat : THREE.LuminanceFormat;
		webcam = document.getElementById("video-bg");
		var video_texture = new THREE.VideoTexture(webcam);

		tuniform = {
			iGlobalTime: { type: 'f', value: 0.1 },
			//iChannel0: { type: 't', value: new THREE.TextureLoader().load('images/hypnotoad.jpeg') },
			iChannel0:  { type: 't', value: new THREE.TextureLoader().load( 'images/pexels-eberhard-grossgasteiger-966927.jpg') },
			iChannel1: { type: 't', value: new THREE.TextureLoader().load('images/beton_3_pexels-photo-5622880.jpeg') },
			iAudioData: { value: new THREE.DataTexture(analyser.data, fftSize / 2, 1, format) },
			iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
			iVideo: { value: video_texture },
			iMouse: { value: new THREE.Vector4(window.innerWidth / 2, window.innerHeight / 2), type: 'v4', },
			iTime: { type: 'f', value: 0.1 }

		};
		tuniform.iChannel0.value.wrapS = tuniform.iChannel0.value.wrapT = THREE.RepeatWrapping;
		tuniform.iChannel1.value.wrapS = tuniform.iChannel1.value.wrapT = THREE.RepeatWrapping;
		mat = new THREE.ShaderMaterial({
			uniforms: tuniform,
			vertexShader: document.getElementById('general_purpose_vertex_shader').textContent,
			fragmentShader: document.getElementById('MusicalHeart_frag').textContent,
			side: THREE.DoubleSide
		});

		var tobject = new THREE.Mesh(new THREE.PlaneGeometry(228, 138, 1, 1), mat); // fits quite nice... but not perfect
		scene.add(tobject);
		camera.position.z = 90;

		// deprecated :-(
		recorder.onaudioprocess = async (event) => {
			if (!audioContext) {
				return;
			}
			canvas = document.getElementById("analyzerCanvas");
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;

			ctx = canvas.getContext("2d");
			ctx.fillStyle = fill_color;
			analyser.connect(audioContext.destination);

			if (audioDataCache.length > 1280) {

				// You can pass some data to current tab
				await sendMessageToTab(option.currentTabId, {
					type: "FROM_OPTION",
					data: audioDataArray.length,
				});

				audioDataCache.length = 0;
			}
		};

		// Prevent page mute
		mediaStream.connect(recorder);
		recorder.connect(audioContext.destination);

		// set starting effect
		// let video_bg = document.getElementById("video-bg");
		// video_bg.removeAttribute("hidden");
		// document.getElementById("threejs").setAttribute("style", "visibility: hidden;")
		// shader_factor = 1.0;

		// precompile slow compiling shader 
		mat.fragmentShader = document.getElementById('Informer_frag').textContent
		mat.needsUpdate = true;


		// video shader stuff
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			const constraints = { video: { width: 1280, height: 720, facingMode: 'user' } };
			navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
				// apply the stream to the video element used in the texture
				webcam.srcObject = stream;
				webcam.play();
			}).catch(function (error) {
				console.error('Unable to access the camera/webcam.', error);
			});

		} else {
			console.error('MediaDevices interface not available.');
		}
		//end of video shader stuff

		FrameLooper();
	} else {
		window.close();
	}
}

// Receive data from Current Tab or Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	const { type, data } = request;

	switch (type) {
		case "START_RECORD":
			console.log("START_RECORD");
			startRecord(data);
			break;
		default:
			break;
	}
	sendResponse({});
});


// https://orangeable.com/javascript/equalizer-web-audio-api
function FrameLooper() {
	window.RequestAnimationFrame =
		window.requestAnimationFrame(FrameLooper) ||
		window.msRequestAnimationFrame(FrameLooper) ||
		window.mozRequestAnimationFrame(FrameLooper) ||
		window.webkitRequestAnimationFrame(FrameLooper);

	fbc_array = new Uint8Array(analyser.frequencyBinCount);
	bar_count = window.innerWidth / 2;

	analyser.getByteFrequencyData(fbc_array);
	if (ctx) {
		if (draw_analyzer) {
			ctx.fillStyle = fill_color;

			for (var i = 0; i < bar_count; i++) {
				bar_pos = i * 4;
				bar_width = 2;
				bar_height = -(fbc_array[i] / 2);

				ctx.fillRect(bar_pos, canvas.height, bar_width, bar_height);
			}
		}
	}
	const sum = fbc_array.reduce((a, b) => a + b, 0);
	const avg = (sum / fbc_array.length) || 0.1;

	const rate = min_speed + avg / (speed_devider == 0 ? 0.1 : speed_devider);
	if (rate > 15) rate = 15;
	if (rate < 0) rate = 0;

	//THREE.js stuff
	delta = clock.getDelta();
	renderer.render(scene, camera);
	tuniform.iGlobalTime.value += (delta * rate * shader_factor); //* shader_factor;
	tuniform['iTime'].value += delta;

	// music related shader updates
	const format = (renderer.capabilities.isWebGL2) ? THREE.RedFormat : THREE.LuminanceFormat;
	//fbc_array = new Uint8Array(analyser.frequencyBinCount);
	//analyser.getByteFrequencyData(fbc_array);
	mat.uniforms.iAudioData = { value: new THREE.DataTexture(fbc_array, fftSize / 2, 1, format) };
	tuniform.iAudioData.value.needsUpdate = true;
	//end of THREE.js stuff

	var video = document.getElementById('video-bg');
	if (video) {
		video.playbackRate = rate;
	}
	//video.playbackRate = min_speed + avg/(speed_devider==0?0.1:speed_devider);
}

function randomIntFromInterval(min, max) { // min and max included 
	return Math.floor(Math.random() * (max - min + 1) + min)
}

var randomTimeoutID = null;
function randomShader() {
	clearInterval(randomTimeoutID);

	var number = randomIntFromInterval(65, 90).toString();
	number = String.fromCharCode(number);
	var key = "Key" + number;

	// we want to see the cat... so we jump to a valid timestamp (maped to key 1-9)
	if (key === "KeyG") {
		console.log("meow")
		var timeNumber = randomIntFromInterval(1, 9).toString();
		var timeKey = "Digit" + timeNumber;
		var e = new KeyboardEvent('keypress', { isTrusted: true, keyCode: number, code: timeKey, key: timeNumber, view: window, which: 50, charCode: timeNumber.charCodeAt(0) });
		e.isTrusted = true;
		document.dispatchEvent(e);
	}

	var e = new KeyboardEvent('keypress', { isTrusted: true, keyCode: number, code: key, key: number, view: window, which: 50, charCode: number.charCodeAt(0) });
	e.isTrusted = true;
	document.dispatchEvent(e);

	if (auto_random_shader) {
		randTimeout = randomIntFromInterval(1, 8) * 500;
		randomTimeoutID = setTimeout(randomShader, randTimeout);
	}
}

window.addEventListener('resize', setWindowSize);
function setWindowSize() {
	if (typeof (window.innerWidth) == 'number') {
		threejs_canvas.width = window.innerWidth;
		threejs_canvas.height = window.innerHeight;
		renderer.setSize(window.innerWidth, window.innerHeight);
	} else {
		if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
			threejs_canvas.width = document.documentElement.clientWidth;
			threejs_canvas.height = document.documentElement.clientHeight
			renderer.setSize(window.innerWidth, window.innerHeight);
		} else {
			if (document.body && (document.body.clientWidth || document.body.clientHeight)) {
				threejs_canvas.width = document.body.clientWidth;
				threejs_canvas.height = document.body.clientHeight;
				renderer.setSize(window.innerWidth, window.innerHeight);
			}
		}
	}
}
