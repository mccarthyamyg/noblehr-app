const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

export function createPageUrl(pageName: string) {
    const path = '/' + pageName.replace(/ /g, '-');
    return BASE === '/' ? path : BASE.replace(/\/$/, '') + path;
}