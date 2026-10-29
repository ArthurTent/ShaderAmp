import { ShaderAmp } from '../src/index';

const audio = document.getElementById('audio') as HTMLAudioElement;
const fileInput = document.getElementById('file') as HTMLInputElement;
const micBtn = document.getElementById('mic') as HTMLButtonElement;
const select = document.getElementById('shader') as HTMLSelectElement;
const scale = document.getElementById('scale') as HTMLInputElement;

async function main() {
    const amp = await ShaderAmp.create({
        container: document.getElementById('viz')!,
        source: audio,
        assetBaseUrl: '/assets/',
        controls: true,
        trackSync: true,
    });

    fileInput.addEventListener('change', () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        if (/\.(zip|json)$/i.test(f.name)) {
            void (async () => {
                const scene = await amp.importScene(f);
                await amp.playScene(scene.id, { mode: 'reset' });
                populateShaders();
            })().catch((e) => console.error('[demo] scene import failed', e));
            return;
        }
        audio.src = URL.createObjectURL(f);
        void audio.play();
    });

    micBtn.addEventListener('click', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        amp.setSource(stream);
    });

    async function populateShaders() {
        const current = select.value;
        select.textContent = '';
        for (const s of await amp.listShaders()) {
            const opt = document.createElement('option');
            opt.value = s.shaderName;
            opt.textContent = s.metaData?.shaderName ?? s.shaderName;
            select.appendChild(opt);
        }
        for (const s of amp.listImportedShaders()) {
            const opt = document.createElement('option');
            opt.value = s.shaderName;
            opt.textContent = `⭳ ${s.metaData?.shaderName ?? s.shaderName}`;
            select.appendChild(opt);
        }
        if (current) select.value = current;
    }
    await populateShaders();
    const updateSelect = () => {
        if (amp.currentShader) select.value = amp.currentShader.shaderName;
    };
    updateSelect();
    amp.on('shaderchange', updateSelect);
    select.addEventListener('change', () => void amp.loadShader(select.value));

    document.getElementById('prev')!.addEventListener('click', () => void amp.prev());
    document.getElementById('next')!.addEventListener('click', () => void amp.next());
    document.getElementById('random')!.addEventListener('click', () => void amp.random());
    scale.addEventListener('input', () => amp.setOptions({ renderScale: Number(scale.value) }));
    document.getElementById('pip')!.addEventListener('click', () => void amp.togglePictureInPicture().catch((e) => console.warn(e)));
    document.getElementById('fs')!.addEventListener('click', () => void amp.toggleFullscreen());

    amp.on('error', ({ error, phase }) => console.error('[demo]', phase, error));
    (window as any).amp = amp;
}

main().catch((e) => console.error(e));
