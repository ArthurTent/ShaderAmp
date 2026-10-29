import browser from 'webextension-polyfill';
import { findOpenContentTab } from '@src/helpers/tabActions';
import { MEDIA_CONTROL } from '@src/helpers/constants';

/**
 * Relay media transport control (seek/pause/play) to the captured source tab.
 * Callable from the service worker (runtime.sendMessage does not reach the
 * background's own listener).
 */
export async function relayMediaControl(action: 'seek' | 'pause' | 'play', time?: number): Promise<void> {
    const mapping = await findOpenContentTab();
    if (mapping?.sourceTabId) {
        browser.tabs.sendMessage(mapping.sourceTabId, { type: MEDIA_CONTROL, action, time }).catch(() => {});
    }
}
