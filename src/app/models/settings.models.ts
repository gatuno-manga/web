export interface ReaderSettings {
    grayScale: boolean;
    asidePosition: 'left' | 'right';
    showPageNumbers: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
    grayScale: false,
    asidePosition: 'right',
    showPageNumbers: false
};
