import React, { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import css from "../styles.module.css";
import { getVcamSites, setVcamSites, vcamSiteOf, vcamSitePattern } from "@src/helpers/vcamSites";

/**
 * Per-site opt-in for the "ShaderAmp Camera" virtual webcam. Enabling grants an
 * optional host permission for exactly this site; nothing runs anywhere else.
 */
export function VirtualCameraToggle({ tab }: { tab?: browser.Tabs.Tab }) {
    const site = vcamSiteOf(tab?.url);
    const [enabled, setEnabled] = useState(false);
    const [needsReload, setNeedsReload] = useState(false);

    useEffect(() => {
        if (!site) return;
        (async () => {
            const sites = await getVcamSites();
            const granted = await chrome.permissions.contains({ origins: [vcamSitePattern(site)] });
            setEnabled(sites.includes(site) && granted);
        })().catch(() => {});
    }, [site]);

    if (!site) return null;
    const host = new URL(site).hostname;

    const enable = () => {
        // permissions.request() needs the click's user activation: call it
        // synchronously. The site is stored in parallel because Firefox may
        // close the popup while its permission prompt is open.
        const stored = getVcamSites().then(sites => setVcamSites([...sites, site]));
        chrome.permissions.request({ origins: [vcamSitePattern(site)] }).then(async granted => {
            await stored;
            if (!granted) {
                await setVcamSites((await getVcamSites()).filter(s => s !== site));
                return;
            }
            setEnabled(true);
            setNeedsReload(true);
        }).catch(err => console.error('Error enabling virtual camera:', err));
    };

    const disable = async () => {
        await setVcamSites((await getVcamSites()).filter(s => s !== site));
        await chrome.permissions.remove({ origins: [vcamSitePattern(site)] }).catch(() => {});
        setEnabled(false);
        setNeedsReload(true);
    };

    const reload = async () => {
        if (tab?.id !== undefined) await browser.tabs.reload(tab.id);
        window.close();
    };

    return (
        <div className={css.modeToggle}>
            <label className={css.toggleLabel} title="Adds a 'ShaderAmp Camera' to this site's camera list: your webcam with the person cut out, in front of the current shader.">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => (e.target.checked ? enable() : void disable())}
                    className={css.toggleInput}
                />
                <span className={css.toggleText}>ShaderAmp Camera on {host}</span>
            </label>
            {needsReload && (
                <button className={css.buttonSecondary} onClick={reload}>
                    Reload page to apply
                </button>
            )}
        </div>
    );
}
