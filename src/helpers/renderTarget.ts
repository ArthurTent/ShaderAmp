import { isFirefox } from "./browserDetect";

export const SIDEPANEL_PAGE = "content.html";

export type ParsedRenderTarget =
    | { mode: "tab" }
    | { mode: "sidepanel"; sourceTabId: number };

export const buildSidePanelPath = (sourceTabId: number): string =>
    `${SIDEPANEL_PAGE}?mode=sidepanel&sourceTabId=${sourceTabId}`;

export const parseRenderTarget = (search: string): ParsedRenderTarget => {
    const params = new URLSearchParams(search);
    if (params.get("mode") !== "sidepanel") return { mode: "tab" };
    const sourceTabId = Number(params.get("sourceTabId"));
    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0)
        return { mode: "tab" };
    return { mode: "sidepanel", sourceTabId };
};

// URLSearchParams comparison (not substring) so sourceTabId=12 doesn't
// accidentally match sourceTabId=123.
export const sidePanelUrlMatchesSource = (
    documentUrl: string | undefined,
    sourceTabId: number,
): boolean => {
    if (!documentUrl) return false;
    try {
        const url = new URL(documentUrl);
        return (
            url.pathname.endsWith(`/${SIDEPANEL_PAGE}`) &&
            url.searchParams.get("mode") === "sidepanel" &&
            url.searchParams.get("sourceTabId") === String(sourceTabId)
        );
    } catch {
        return false;
    }
};

export const isSidePanelSupported = (): boolean =>
    !isFirefox() &&
    typeof chrome !== "undefined" &&
    typeof chrome.sidePanel?.open === "function";
