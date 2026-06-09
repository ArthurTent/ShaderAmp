// State keys
export const STATE_SHADERLIST = 'state.shaderlist';
export const STATE_SHADERINDEX = 'state.shaderindex';
export const STATE_SHADERNAME = 'state.shadername';
export const STATE_SHOWPREVIEW = 'state.showpreview';
export const STATE_CURRENT_SHADER = 'state.currentshader'
export const STATE_SHOWSHADERCREDITS = 'state.showshadercredits';
export const STATE_IMPORTED_SHADERS = 'state.importedshaders';

// Setting keys
export const SETTINGS_SPEEDDIVIDER = 'settings.speedDivider';
export const SETTINGS_RANDOMIZE_SHADERS = 'settings.randomizeShaders';
export const SETTINGS_RANDOMIZE_TIME = 'settings.randomizeTime';
export const SETTINGS_RANDOMIZE_VARIATION = 'settings.randomizeVariation';
export const SETTINGS_RANDOMIZE_BEAT = 'settings.randomizeBeat';
export const SETTINGS_RANDOMIZE_BEAT_INTERVAL = 'settings.randomizeBeatInterval';
export const SETTINGS_WEBCAM = 'settings.useWebcam';
export const SETTINGS_WEBCAM_AUDIO = 'settings.useWebcamAudio';
export const SETTINGS_SHADEROPTIONS = 'settings.shaderOptions';
export const SETTINGS_VOLUME_AMPLIFIER = 'settings.volumeAmplifier';
export const SETTINGS_EQ_GAINS = 'settings.eqGains';
export const SETTINGS_EQ_APPLY_TO_OUTPUT = 'settings.eqApplyToOutput';
export const SETTINGS_EQ_MODE_ONLY = 'settings.eqModeOnly';
export const STATE_EQ_MODE_ACTIVE = 'state.eqModeActive';
export const STATE_EQ_TARGET_TAB_ID = 'state.eqTargetTabId';
export const SETTINGS_SHOW_TAB_TITLE = 'settings.showTabTitle';
export const SETTINGS_SHOW_FPS = 'settings.showFps';
export const SETTINGS_SHADER_FADE = 'settings.shaderFade';
export const SETTINGS_RENDER_SCALE = 'settings.renderScale';
export const SETTINGS_USE_IAMPLIFIED_TIME = 'settings.useIAmplifiedTime';
export const SETTINGS_ENABLE_IAMPLIFIED_TIME = 'settings.enableIAmplifiedTime';
export const SETTINGS_DISPLAY_CAPTURE = 'settings.useDisplayCapture';
export const SETTINGS_DOWNLOAD_SHADERTOY_ASSETS = 'settings.downloadShadertoyAssets';
export const SETTINGS_DOWNLOAD_SHADERTOY_ASSETS_CONFIRMED = 'settings.downloadShadertoyAssetsConfirmed';

// MIDI settings
export const SETTINGS_MIDI_ENABLED = 'settings.midiEnabled';
export const SETTINGS_MIDI_MAPPINGS = 'settings.midiMappings';

// Joystick settings
export const SETTINGS_JOYSTICK_ENABLED = 'settings.joystickEnabled';
export const SETTINGS_JOYSTICK_MAPPINGS = 'settings.joystickMappings';

// AI settings
export const SETTINGS_AI_PROVIDER = 'settings.aiProvider'; // 'chrome' | 'gemini' | 'openrouter' | 'ollama'
export const SETTINGS_GEMINI_API_KEY = 'settings.geminiApiKey';
export const SETTINGS_GEMINI_MODEL = 'settings.geminiModel'; // 'gemini-1.5-flash' | 'gemini-1.5-pro' | etc.
export const SETTINGS_OPENROUTER_API_KEY = 'settings.openrouterApiKey';
export const SETTINGS_OPENROUTER_MODEL = 'settings.openrouterModel'; // 'openai/gpt-4o' | 'anthropic/claude-3.5-sonnet' | etc.
export const SETTINGS_OLLAMA_BASE_URL = 'settings.ollamaBaseUrl'; // 'http://localhost:11434'
export const SETTINGS_OLLAMA_MODEL = 'settings.ollamaModel'; // 'llama3.2', 'codellama', etc.
export const SETTINGS_AI_PROMPT_FIX = 'settings.aiPromptFix';
export const SETTINGS_AI_PROMPT_GENERATE = 'settings.aiPromptGenerate';

// UI theme
export const SETTINGS_UI_THEME = 'settings.uiTheme'; // 'classic' | 'audio'

// Green skin section open/close state
export const SETTINGS_UI_SPEED_OPEN = 'settings.ui.speedOpen';
export const SETTINGS_UI_RANDOMIZE_OPEN = 'settings.ui.randomizeOpen';

// Debug logging
export const SETTINGS_DEBUG_LOGGING = 'settings.debugLogging';
export const STATE_DEBUG_LOGS = 'state.debugLogs';
export const DEBUG_LOGS_MAX_ENTRIES = 500;

export interface DebugLogEntry {
    id: string;
    timestamp: number;
    source: 'background' | 'content' | 'options' | 'renderer' | 'offscreen';
    level: 'log' | 'warn' | 'error' | 'info';
    prefix: string;
    message: string;
    args?: any[];
}
