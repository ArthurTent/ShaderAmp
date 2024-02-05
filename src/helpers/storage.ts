
export const getStorage = <T>(key: string): Promise<T> => {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
        });
    });
}

export const setStorage = (key: string, value: any) => {
    return new Promise((resolve) => {
        chrome.storage.local.set(
            {
                [key]: value,
            },
            () => {
                resolve(value);
            }
        );
    });
}

export const removeFromStorage = async (key_prefix : string) => {
    const items = await chrome.storage.local.get(null);
    const objectKeys = Object.keys(items);
    objectKeys.filter(key => key.startsWith(key_prefix)).forEach(async (key : string) => {
        await chrome.storage.local.remove(key);
    });
}