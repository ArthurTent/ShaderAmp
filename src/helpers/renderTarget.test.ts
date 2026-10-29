import {
    buildSidePanelPath,
    parseRenderTarget,
    sidePanelUrlMatchesSource,
    isSidePanelSupported,
} from "./renderTarget";

describe("buildSidePanelPath", () => {
    it("builds the panel URL for a source tab", () => {
        expect(buildSidePanelPath(42)).toBe(
            "content.html?mode=sidepanel&sourceTabId=42",
        );
    });
});

describe("parseRenderTarget", () => {
    it("parses a side-panel target", () => {
        expect(parseRenderTarget("?mode=sidepanel&sourceTabId=42")).toEqual({
            mode: "sidepanel",
            sourceTabId: 42,
        });
    });

    it("defaults to tab mode", () => {
        expect(parseRenderTarget("")).toEqual({ mode: "tab" });
        expect(parseRenderTarget("?mode=tab")).toEqual({ mode: "tab" });
    });

    it("treats a missing or invalid sourceTabId as tab mode", () => {
        expect(parseRenderTarget("?mode=sidepanel")).toEqual({ mode: "tab" });
        expect(parseRenderTarget("?mode=sidepanel&sourceTabId=abc")).toEqual({
            mode: "tab",
        });
        expect(parseRenderTarget("?mode=sidepanel&sourceTabId=-5")).toEqual({
            mode: "tab",
        });
        expect(parseRenderTarget("?mode=sidepanel&sourceTabId=2.5")).toEqual({
            mode: "tab",
        });
    });
});

describe("sidePanelUrlMatchesSource", () => {
    const url = (id: string | number) =>
        `chrome-extension://abcdefghijklmnop/content.html?mode=sidepanel&sourceTabId=${id}`;

    it("matches an exact source tab id", () => {
        expect(sidePanelUrlMatchesSource(url(123), 123)).toBe(true);
    });

    it("does not match a different id or a prefix", () => {
        expect(sidePanelUrlMatchesSource(url(12), 123)).toBe(false);
        expect(sidePanelUrlMatchesSource(url(123), 12)).toBe(false);
    });

    it("does not match non-panel urls", () => {
        expect(
            sidePanelUrlMatchesSource(
                "chrome-extension://abc/content.html",
                123,
            ),
        ).toBe(false);
        expect(
            sidePanelUrlMatchesSource(
                "chrome-extension://abc/options.html?mode=sidepanel&sourceTabId=123",
                123,
            ),
        ).toBe(false);
        expect(sidePanelUrlMatchesSource(undefined, 123)).toBe(false);
        expect(sidePanelUrlMatchesSource("not a url", 123)).toBe(false);
    });
});

describe("isSidePanelSupported", () => {
    const chromeHolder = globalThis as unknown as { chrome: unknown };
    const originalChrome = chromeHolder.chrome;

    afterEach(() => {
        chromeHolder.chrome = originalChrome;
    });

    it("is false without the chrome.sidePanel API", () => {
        chromeHolder.chrome = {};
        expect(isSidePanelSupported()).toBe(false);
        chromeHolder.chrome = undefined;
        expect(isSidePanelSupported()).toBe(false);
    });

    it("is true when chrome.sidePanel.open exists", () => {
        chromeHolder.chrome = {
            sidePanel: { open: () => Promise.resolve() },
        };
        expect(isSidePanelSupported()).toBe(true);
    });
});
