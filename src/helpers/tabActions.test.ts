import {
    isSessionAlive,
    findOpenContentTab,
    sendToSession,
} from "./tabActions";
import type { TabInfo } from "./types";
import browser from "webextension-polyfill";

jest.mock("webextension-polyfill", () => ({
    __esModule: true,
    default: {
        tabs: {
            query: jest.fn(() =>
                Promise.resolve([{ id: 1, url: "about:blank" }]),
            ),
            sendMessage: jest.fn(() => Promise.resolve()),
        },
        runtime: {
            sendMessage: jest.fn(() => Promise.resolve()),
        },
        windows: {},
        extension: {},
    },
}));

const mockedTabsQuery = browser.tabs.query as jest.Mock;
const mockedTabsSendMessage = browser.tabs.sendMessage as jest.Mock;
const mockedRuntimeSendMessage = browser.runtime.sendMessage as jest.Mock;

const sidePanelContext = (sourceTabId: number) => ({
    contextType: "SIDE_PANEL",
    documentUrl: `chrome-extension://abcdef/content.html?mode=sidepanel&sourceTabId=${sourceTabId}`,
    frameId: 0,
    incognito: false,
    tabId: -1,
    windowId: 1,
});

// tabActions -> tabMappingService -> storage/storage uses
// chrome.storage.local.get; isSessionAlive uses chrome.runtime.getContexts.
let storedMapping: Record<number, TabInfo> = {};
let getContextsImpl: jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    storedMapping = {};
    getContextsImpl = jest.fn(() => Promise.resolve([]));
    (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: {
            local: {
                get: jest.fn(
                    (
                        _keys: unknown,
                        cb: (r: Record<string, unknown>) => void,
                    ) => cb({ tabMapping: storedMapping }),
                ),
            },
        },
        runtime: {
            getContexts: getContextsImpl,
        },
        tabCapture: {},
        tabs: {},
    };
    mockedTabsQuery.mockResolvedValue([{ id: 1, url: "about:blank" }]);
});

describe("isSessionAlive", () => {
    it("is alive for a tab session whose content tab exists", async () => {
        const info: TabInfo = { sourceTabId: 1, contentTabId: 2, kind: "tab" };
        mockedTabsQuery.mockResolvedValue([{ id: 2 }]);
        await expect(isSessionAlive(info)).resolves.toBe(true);
    });

    it("is dead for a tab session whose content tab is gone", async () => {
        const info: TabInfo = { sourceTabId: 1, contentTabId: 2, kind: "tab" };
        mockedTabsQuery.mockResolvedValue([{ id: 3 }]);
        await expect(isSessionAlive(info)).resolves.toBe(false);
    });

    it("is dead for a tab session without a contentTabId", async () => {
        const info: TabInfo = { sourceTabId: 1 };
        await expect(isSessionAlive(info)).resolves.toBe(false);
    });

    it("is alive for a sidepanel session while a matching context exists", async () => {
        const info: TabInfo = {
            sourceTabId: 7,
            kind: "sidepanel",
            windowId: 1,
        };
        getContextsImpl.mockResolvedValue([sidePanelContext(7)]);
        await expect(isSessionAlive(info)).resolves.toBe(true);
        expect(getContextsImpl).toHaveBeenCalledWith({
            contextTypes: ["SIDE_PANEL"],
        });
    });

    it("is dead for a sidepanel session without a matching context", async () => {
        const info: TabInfo = {
            sourceTabId: 7,
            kind: "sidepanel",
            windowId: 1,
        };
        getContextsImpl.mockResolvedValue([sidePanelContext(77)]);
        await expect(isSessionAlive(info)).resolves.toBe(false);
    });

    it("is dead for a sidepanel session when getContexts is unavailable", async () => {
        const info: TabInfo = {
            sourceTabId: 7,
            kind: "sidepanel",
            windowId: 1,
        };
        getContextsImpl.mockRejectedValue(new Error("unknown api"));
        await expect(isSessionAlive(info)).resolves.toBe(false);
    });
});

describe("findOpenContentTab", () => {
    it("returns a live sidepanel session, not only content tabs", async () => {
        storedMapping[7] = {
            sourceTabId: 7,
            kind: "sidepanel",
            windowId: 1,
            stream: "s",
        };
        getContextsImpl.mockResolvedValue([sidePanelContext(7)]);
        const found = await findOpenContentTab();
        expect(found).toEqual(storedMapping[7]);
    });

    it("skips dead sessions", async () => {
        storedMapping[7] = { sourceTabId: 7, kind: "sidepanel", windowId: 1 };
        storedMapping[9] = { sourceTabId: 9, contentTabId: 2, kind: "tab" };
        mockedTabsQuery.mockResolvedValue([{ id: 2 }]);
        const found = await findOpenContentTab();
        expect(found?.contentTabId).toBe(2);
    });
});

describe("sendToSession", () => {
    it("uses tabs.sendMessage for tab sessions", () => {
        sendToSession(
            { sourceTabId: 1, contentTabId: 5, kind: "tab" },
            { type: "X" },
        );
        expect(mockedTabsSendMessage).toHaveBeenCalledWith(5, { type: "X" });
        expect(mockedRuntimeSendMessage).not.toHaveBeenCalled();
    });

    it("broadcasts tagged messages for sidepanel sessions", () => {
        sendToSession(
            { sourceTabId: 9, kind: "sidepanel", windowId: 1 },
            { type: "X" },
        );
        expect(mockedRuntimeSendMessage).toHaveBeenCalledWith({
            type: "X",
            sessionSourceTabId: 9,
        });
        expect(mockedTabsSendMessage).not.toHaveBeenCalled();
    });
});
