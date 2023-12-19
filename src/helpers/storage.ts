
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