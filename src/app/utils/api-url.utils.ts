export interface UrlConfig {
    isBrowser: boolean;
    apiUrl: string;
    apiUrlServer?: string;
    origin?: string;
}

export function buildApiUrl(path: string, config: UrlConfig): string {
    const isAbsoluteUrl = /^https?:\/\//i.test(path);
    const requestExclude = ['/assets/', '/data/'];

    if (isAbsoluteUrl || requestExclude.some(exclude => path.includes(exclude))) {
        return path;
    }

    let baseUrl = config.apiUrl;

    if (!config.isBrowser) {
        baseUrl = config.apiUrlServer || config.apiUrl || 'http://localhost:3000/api';
    } else if (!baseUrl) {
        baseUrl = (config.origin || '') + '/api';
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');

    return `${cleanBase}/${cleanPath}`;
}
