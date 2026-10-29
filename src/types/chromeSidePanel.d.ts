// Missing typings for chrome.sidePanel.open/close and chrome.runtime.getContexts.
// @types/chrome@0.0.248 declares sidePanel.getOptions/setOptions/getPanelBehavior
// but not open() (Chrome 116+) or close() (Chrome 141+), and does not declare
// runtime.getContexts (Chrome 116+).

declare namespace chrome.sidePanel {
    export interface OpenOptions {
        windowId?: number;
        tabId?: number;
    }

    export function open(options: OpenOptions): Promise<void>;
    export function close(options: OpenOptions): Promise<void>;
}

declare namespace chrome.runtime {
    export interface ExtensionContext {
        contextType: string;
        documentId?: string;
        documentUrl?: string;
        documentOrigin?: string;
        frameId: number;
        incognito: boolean;
        tabId: number;
        windowId: number;
    }

    export function getContexts(filter: {
        contextTypes?: string[];
        documentIds?: string[];
        documentUrls?: string[];
        documentOrigins?: string[];
        frameIds?: number[];
        tabIds?: number[];
        windowIds?: number[];
    }): Promise<ExtensionContext[]>;
}
