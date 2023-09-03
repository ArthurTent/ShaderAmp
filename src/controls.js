// MIT Licensed
// Copyright 2023 by Arthur Tent

setTimeout(() => {
    enableShaders();
    // var e = new KeyboardEvent('keypress', { isTrusted: true, keyCode: 103, code:"KeyG", key: "g", view:window, which:50, charCode: 103});
    var e = new KeyboardEvent('keypress', { isTrusted: true, keyCode: 46, code: "Period", key: ".", view: window, which: 50, charCode: 46 });
    e.isTrusted = true;
    document.dispatchEvent(e);
}, 500);

const hammerTime = null; // can't touch this
let video_bg = document.getElementById("video-bg");
insert_mode = false;

function keypress(e) {
    if (insert_mode) {
        if (e.code == "Enter") {
            document.getElementById("caption").innerHTML += "<br>"
        } else {
            document.getElementById("caption").innerHTML += e.key;
        }

    } else {
        // console.log(e.code)
        // Todo: Make this available for each shader with different position so it can jump to different timestamps per shader.
        // currently this is specifically for "Gato Negro Pasa"
        if (e.code == "Digit1") {
            tuniform.iGlobalTime.value = 0.0;
        }
        if (e.code == "Digit2") {
            tuniform.iGlobalTime.value = 30.0;
        }
        if (e.code == "Digit3") {
            tuniform.iGlobalTime.value = 54.0;
        }
        if (e.code == "Digit4") {
            tuniform.iGlobalTime.value = 61.0;
        }
        if (e.code == "Digit5") {
            tuniform.iGlobalTime.value = 150.0;
        }
        if (e.code == "Digit6") {
            tuniform.iGlobalTime.value = 161.0;
        }
        if (e.code == "Digit7") {
            tuniform.iGlobalTime.value = 181.5;
        }
        if (e.code == "Digit8") {
            tuniform.iGlobalTime.value = 223.0;
        }
        if (e.code == "Digit9") {
            tuniform.iGlobalTime.value = 252.0;
        }
        if (e.code == "Digit0") {
            tuniform.iGlobalTime.value = 332.0;
        }

        if (e.code == "KeyQ") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('Otherworldy_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Otherworldy by lherm";
        }
        if (e.code == "KeyW") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('ShitJustGotReal_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Shit just got real by db0x90";
        }
        if (e.code == "KeyE") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('fftexperiment_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "fft experiment by nshelton";
        }
        if (e.code == "KeyR") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('frequencyballs_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "frequency balls by nshelton";
        }
        if (e.code == "KeyT") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('inFX_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "inFX.1b by patu";
        }
        if (e.code == "KeyY") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('BasicAudioVisualizer_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Basic Audio Visualizer by chronos";
        }
        if (e.code == "KeyU") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('DDDAudioVisualizer_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "3D Audio Visualizer by kishimisu";
        }
        if (e.code == "KeyI") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('AbstractMusic_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Abstract Music by MatHack";
        }
        if (e.code == "KeyO") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('SoundOscilloscopeFromSpectrum_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Sound Oscilloscope from spectrum  by jaszunio15";
        }
        if (e.code == "KeyP") {
            enableShaders();
            shader_factor = 0.25;
            mat.fragmentShader = document.getElementById('MovingWithoutTravelling_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Moving without travelling by mrange";
        }
        if (e.code == "KeyA") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('SolumObject_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Solum Object 0.52.230509 by QuantumSuper";
        }
        if (e.code == "KeyS") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('AudioReactiveScene1stAttempt_frag').textContent
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Audio-reactive scene 1st attempt by kishimisu";
        }
        if (e.code == "KeyD") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('TheVoiceless_frag').textContent
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "The Voiceless by python273";
            /*
            // only available in "VJ" mode
            if (auto_random_shader) {
                randomShader()
            } else {
                enableShaders();
                shader_factor = 1.0;
                mat.fragmentShader = document.getElementById('PsychedelicEye_frag').textContent
                mat.needsUpdate = true;
                if (show_credits) document.getElementById("caption").innerHTML = "Psychedelic Eye by mrange";
            }
            //*/
        }
        if (e.code == "KeyF") {
            enableShaders();
            shader_factor = 0.75;
            mat.fragmentShader = document.getElementById('symbolism_frag').textContent
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Symbolism 0.74.230405 by QuantumSuper";
        }
        if (e.code == "KeyG") {
            // special shader <3
            if (auto_random_shader) {
                randomShader()
            } else {
                enableShaders();
                shader_factor = 0.41;//0.35;
                mat.fragmentShader = document.getElementById('GatoNegroPasa_frag').textContent
                mat.needsUpdate = true;
                if (show_credits) document.getElementById("caption").innerHTML = "\"Gato Negro Pasa\" by Kali";
            }

        }
        if (e.code == "KeyH") {
            enableShaders();
            shader_factor = 0.35;
            mat.fragmentShader = document.getElementById('Hexagone_frag').textContent
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Hexagone by Martijn Steinrucken aka BigWings";
        }
        if (e.code == "KeyJ") {
            // this is a special shader.
            // a) it shows how to use a video signal within a shader
            // b) the style is completely different to the other shaders. therefore I only want to use it when I select it on purpose in VJ mode.
            if (auto_random_shader) {
                randomShader()
            } else {
                enableShaders();
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const constraints = { video: { width: 1280, height: 720, facingMode: 'user' } };
                    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
                        if (video_bg.srcObject == null) {
                            video_bg.srcObject = stream;
                        } else {
                            video_bg.srcObject = null;
                            video_bg.setAttribute("src", "media/SpaceTravel1Min.mp4");
                            video_bg.setAttribute("type", "video/mp4");
                            video_bg.load();
                            video_bg.play();
                        }
                        video_bg.play();

                    }).catch(function (error) {
                        console.error('Unable to access the camera/webcam.', error);
                    });

                } else {
                    console.error('MediaDevices interface not available.');
                }
                mat.fragmentShader = document.getElementById('StarFieldArtOfCode_frag').textContent
                mat.needsUpdate = true;
                if (show_credits) document.getElementById("caption").innerHTML = "Star Field - the Art of code by Chriscamplin";
            }
        }
        if (e.code == "KeyK") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('Warpspeed_frag').textContent
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Warp Speed by David Hoskins 2013";
        }

        if (e.code == "KeyL") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('ForkDancingGlowLights_frag').textContent
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Fork: Dancing Glow Lights by QuantumSuper";
        }

        if (e.code == "KeyZ") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('ReadyPlayerOne_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "READY PLAYER ONE by  Nestor Vina aka Nesvi7";
        }
        if (e.code == "KeyX") {
            enableShaders();
            shader_factor = 0.25;
            mat.fragmentShader = document.getElementById('NeonOctagonalAudioVisualizer_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Neon Octagonal Audio Visualizer by Emiel";
        }

        if (e.code == "KeyC") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('SonicPulse_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Sonic Pulse by WillKirkby";
        }
        if (e.code == "KeyV") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('FluidicSpace_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Fluidic Space by EnigmaCurry";
        }
        if (e.code == "KeyB") {
            enableShaders();
            shader_factor = 1.0;
            mat.fragmentShader = document.getElementById('MusicalHeart_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Musical Heart by hunter";
        }
        if (e.code == "KeyN") {
            enableShaders();
            shader_factor = 0.35;
            mat.fragmentShader = document.getElementById('Informer_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Informer by voz";
        }
        if (e.code == "KeyM") {
            enableShaders();
            shader_factor = 0.5;
            mat.fragmentShader = document.getElementById('ShatterFlake_frag').textContent;
            mat.needsUpdate = true;
            if (show_credits) document.getElementById("caption").innerHTML = "Shatter Flake by QuantumSuper";
        }

        // enable/disable auto switching of shaders 
        if (e.code == "Period") {
            clearInterval(randomTimeoutID);
            randomTimeoutID = null;
            auto_random_shader = auto_random_shader ? false : true;
            if (auto_random_shader) {
                randomShader();
            }
        }

        if (e.code == "Slash") {
            draw_analyzer = draw_analyzer ? false : true;
        }
        if (e.code == "Comma") {
            show_credits = show_credits ? false : true;
            if (show_credits == false) {
                setTimeout(() => {
                    document.getElementById("caption").innerHTML = "";
                }, 500);
            }
        }
    }

    // why is the e.code for the '#'-key named "Backslash" :-/
    if (e.code == "Backslash") {
        if (insert_mode) {
            insert_mode = false;
            document.getElementById("caption").innerHTML = "";
        } else {
            insert_mode = true;
            document.getElementById("caption").innerHTML = "";
        }
    }

}
document.addEventListener("keypress", keypress);

// arrow keys 
document.onkeydown = (e) => {
    e = e || window.event;
    if (e.keyCode === 38) {
        // arrow key up 
        document.getElementById("caption").innerHTML = Math.round(speed_devider);
        setTimeout(() => { document.getElementById("caption").innerHTML = "" }, 300)
        speed_devider -= 0.5;
        console.log(speed_devider);
    } else if (e.keyCode === 40) {
        // arrow key down
        document.getElementById("caption").innerHTML = Math.round(speed_devider);
        setTimeout(() => { document.getElementById("caption").innerHTML = "" }, 300)
        speed_devider += 0.5;
        console.log(speed_devider);
    } else if (e.keyCode === 37) {
        // arrow key left
        tuniform.iGlobalTime.value -= 5.0;
    } else if (e.keyCode === 39) {
        // arrow key right
        tuniform.iGlobalTime.value += 5.0;
    }
};