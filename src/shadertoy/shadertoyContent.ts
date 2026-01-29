/**
 * Shadertoy Content Script
 * 
 * Detects when user is on a Shadertoy shader page and injects
 * a "Load to ShaderAmp" button.
 */

import browser from "webextension-polyfill";
import { 
    extractShaderIdFromUrl, 
    fetchShadertoyShader, 
    convertShadertoyShader,
    ConversionResult 
} from "@src/helpers/shadertoyConverter";

// CSS styles for the button - integrated into Shadertoy's playerBar
const BUTTON_STYLES = `
.shaderamp-load-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: linear-gradient(135deg, #4087A0 0%, #2d5f73 100%);
    color: white;
    border: none;
    border-radius: 4px;
    font-family: Tahoma, Arial, sans-serif;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    height: 22px;
    white-space: nowrap;
}

.shaderamp-load-btn:hover {
    background: linear-gradient(135deg, #4a9bb8 0%, #3a7a94 100%);
    box-shadow: inset 0px 0px 1px 1px #808080, 0px 0px 1px 1px #808080;
}

.shaderamp-load-btn:active {
    background: linear-gradient(135deg, #2d5f73 0%, #1e4050 100%);
}

.shaderamp-load-btn:disabled {
    background: #555;
    cursor: not-allowed;
    opacity: 0.7;
}

.shaderamp-load-btn .icon {
    width: 14px;
    height: 14px;
}

.shaderamp-load-btn.loading .icon {
    animation: shaderamp-spin 1s linear infinite;
}

@keyframes shaderamp-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.shaderamp-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    padding: 12px 20px;
    background: #333;
    color: white;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
}

.shaderamp-toast.show {
    opacity: 1;
    transform: translateY(0);
}

.shaderamp-toast.success {
    background: #2e7d32;
}

.shaderamp-toast.error {
    background: #c62828;
}
`;

const LOADING_ICON = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="2" x2="12" y2="6"></line>
    <line x1="12" y1="18" x2="12" y2="22"></line>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
    <line x1="2" y1="12" x2="6" y2="12"></line>
    <line x1="18" y1="12" x2="22" y2="12"></line>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
</svg>`;

let button: HTMLButtonElement | null = null;
let toastTimeout: number | null = null;

/**
 * Check if current page is a Shadertoy shader view page
 */
function isShaderPage(): boolean {
    return /shadertoy\.com\/view\/[a-zA-Z0-9]+/.test(window.location.href);
}

/**
 * Show a toast notification
 */
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.shaderamp-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `shaderamp-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Auto-hide after 3 seconds
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    toastTimeout = window.setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Set button loading state
 */
function setButtonLoading(loading: boolean) {
    if (!button) return;
    
    if (loading) {
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = `${LOADING_ICON} Loading...`;
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = "Load to ShaderAmp";
    }
}

/**
 * Handle the load shader button click
 */
async function handleLoadShader() {
    const shaderId = extractShaderIdFromUrl(window.location.href);
    if (!shaderId) {
        showToast('Could not extract shader ID from URL', 'error');
        return;
    }
    
    setButtonLoading(true);
    
    try {
        // Fetch shader data from Shadertoy
        console.log(`[ShaderAmp] Fetching shader: ${shaderId}`);
        const shaderData = await fetchShadertoyShader(shaderId);
        
        if (!shaderData) {
            showToast('Failed to fetch shader data', 'error');
            setButtonLoading(false);
            return;
        }
        
        console.log(`[ShaderAmp] Converting shader: ${shaderData.info.name}`);
        
        // Convert to ShaderAmp format
        const result: ConversionResult = convertShadertoyShader(shaderData);
        
        if (!result.success) {
            showToast(`Conversion failed: ${result.error}`, 'error');
            setButtonLoading(false);
            return;
        }
        
        console.log(`[ShaderAmp] Conversion successful, sending to extension...`);
        
        // Send to background script to save and load the shader
        const response = await browser.runtime.sendMessage({
            command: 'LOAD_SHADERTOY_SHADER',
            data: {
                mainShader: result.mainShader,
                bufferShaders: result.bufferShaders,
                shaderId: shaderId
            }
        });
        
        if (response?.success) {
            showToast(`Loaded: ${result.mainShader.meta.shaderName}`, 'success');
        } else {
            showToast(response?.error || 'Failed to load shader', 'error');
        }
        
    } catch (error) {
        console.error('[ShaderAmp] Error loading shader:', error);
        showToast('Error loading shader', 'error');
    } finally {
        setButtonLoading(false);
    }
}

/**
 * Inject the styles into the page
 */
function injectStyles() {
    if (document.getElementById('shaderamp-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'shaderamp-styles';
    style.textContent = BUTTON_STYLES;
    document.head.appendChild(style);
}

/**
 * Create and inject the load button into Shadertoy's playerBar
 */
function injectButton() {
    if (button) return;
    
    button = document.createElement('button');
    button.className = 'shaderamp-load-btn';
    button.innerHTML = "Load to ShaderAmp";
    button.title = 'Load this shader into ShaderAmp';
    button.addEventListener('click', handleLoadShader);
    
    // Try to find Shadertoy's playerBar and insert the button there
    const playerBar = document.getElementById('playerBar');
    if (playerBar) {
        // Insert into the third div (right side controls) of playerBar
        const rightControls = playerBar.querySelector(':scope > div:nth-child(3)');
        if (rightControls) {
            // Insert at the beginning of the right controls
            rightControls.insertBefore(button, rightControls.firstChild);
            console.log('[ShaderAmp] Button injected into playerBar');
            return;
        }
    }
    
    // Fallback: Try to insert near the shader info area
    const shaderInfo = document.getElementById('shaderInfo');
    if (shaderInfo) {
        const shaderInfoA = shaderInfo.querySelector('.shaderInfoA');
        if (shaderInfoA) {
            // Find the second child (where share button is) and add our button
            const shareRow = shaderInfoA.querySelector(':scope > div:nth-child(2)');
            if (shareRow) {
                button.style.marginRight = '12px';
                shareRow.insertBefore(button, shareRow.firstChild);
                console.log('[ShaderAmp] Button injected into shaderInfo');
                return;
            }
        }
    }
    
    // Last fallback: append to body with fixed positioning
    button.style.cssText = 'position: fixed; top: 60px; right: 10px; z-index: 99999;';
    document.body.appendChild(button);
    console.log('[ShaderAmp] Button injected as fixed overlay (fallback)');
}

/**
 * Remove the button from the page
 */
function removeButton() {
    if (button) {
        button.remove();
        button = null;
    }
}

/**
 * Initialize the content script
 */
function init() {
    if (isShaderPage()) {
        console.log('[ShaderAmp] Shadertoy shader page detected');
        injectStyles();
        injectButton();
    }
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Also watch for URL changes (SPA navigation)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        if (isShaderPage()) {
            injectStyles();
            injectButton();
        } else {
            removeButton();
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });
