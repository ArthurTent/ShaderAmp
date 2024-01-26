
export const hash = (input?: string) => {
    if (!input) return '';
    let h = 0
    for(let i = 0, h = 0; i < input.length; i++)
        h = Math.imul(31, h) + input.charCodeAt(i) | 0;
    return h.toString();
}
