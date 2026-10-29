/**
 * Per-site opt-in for the ShaderAmp virtual camera.
 *
 * Nothing is injected anywhere by default. The user enables a site from the
 * popup, which grants an optional host permission for exactly that site and
 * stores it in SETTINGS_VCAM_SITES. The background page keeps the dynamically
 * registered content scripts in sync with that list ∩ granted permissions.
 */
import { SETTINGS_VCAM_SITES } from '../storage/storageConstants';
import { VCAM_SCRIPT_ID_ISOLATED, VCAM_SCRIPT_ID_MAIN } from '../vcam/protocol';

/**
 * The site key for a tab URL: `scheme://hostname` (no port — Firefox match
 * patterns can't carry one, so a site covers all its ports). Only http(s).
 */
export function vcamSiteOf(url: string | undefined): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
        return `${u.protocol}//${u.hostname}`;
    } catch {
        return null;
    }
}

export const vcamSitePattern = (site: string): string => `${site}/*`;

export function buildVcamScripts(patterns: string[]): chrome.scripting.RegisteredContentScript[] {
    if (patterns.length === 0) return [];
    const common = { matches: patterns, runAt: 'document_start' as const, allFrames: true, persistAcrossSessions: true };
    return [
        // Isolated first so its listeners exist before the page can ask for the camera.
        { ...common, id: VCAM_SCRIPT_ID_ISOLATED, js: ['js/vcamContent.js'], world: 'ISOLATED' as chrome.scripting.ExecutionWorld },
        { ...common, id: VCAM_SCRIPT_ID_MAIN, js: ['js/vcamPage.js'], world: 'MAIN' as chrome.scripting.ExecutionWorld },
    ];
}

export async function getVcamSites(): Promise<string[]> {
    const res = await chrome.storage.local.get(SETTINGS_VCAM_SITES);
    const list = res?.[SETTINGS_VCAM_SITES];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
}

export async function setVcamSites(sites: string[]): Promise<void> {
    await chrome.storage.local.set({ [SETTINGS_VCAM_SITES]: Array.from(new Set(sites)).sort() });
}

let syncChain: Promise<void> = Promise.resolve();

/** Re-register the virtual-camera content scripts for enabled + permitted sites. */
export function syncVcamContentScripts(): Promise<void> {
    syncChain = syncChain.then(async () => {
        const sites = await getVcamSites();
        const patterns: string[] = [];
        for (const site of sites) {
            const pattern = vcamSitePattern(site);
            if (await chrome.permissions.contains({ origins: [pattern] })) patterns.push(pattern);
        }
        const ids = [VCAM_SCRIPT_ID_ISOLATED, VCAM_SCRIPT_ID_MAIN];
        const existing = await chrome.scripting.getRegisteredContentScripts({ ids });
        if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map(s => s.id) });
        const scripts = buildVcamScripts(patterns);
        if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
    }).catch(err => console.error('[ShaderAmp] virtual camera registration failed', err));
    return syncChain;
}

/** Background-page wiring: keep registrations in sync with storage and permissions. */
export function initVcamRegistration(): void {
    chrome.runtime.onInstalled.addListener(() => void syncVcamContentScripts());
    chrome.runtime.onStartup.addListener(() => void syncVcamContentScripts());
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[SETTINGS_VCAM_SITES]) void syncVcamContentScripts();
    });
    // Granted from the popup (Firefox may close the popup during the prompt).
    chrome.permissions.onAdded.addListener(() => void syncVcamContentScripts());
    // Revoked in the browser's extension settings: forget those sites too.
    chrome.permissions.onRemoved.addListener(async (removed) => {
        const gone = new Set(removed.origins ?? []);
        if (gone.size) {
            const sites = await getVcamSites();
            const kept = sites.filter(s => !gone.has(vcamSitePattern(s)));
            if (kept.length !== sites.length) await setVcamSites(kept);
        }
        void syncVcamContentScripts();
    });
}
