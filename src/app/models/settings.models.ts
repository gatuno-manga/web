export interface ReaderSettings {
	grayScale: boolean;
	asidePosition: 'left' | 'right';
	progressBarPosition?: 'top' | 'bottom';
	showPageNumbers: boolean;
	brightness?: number;
	contrast?: number;
	invert?: number;
	nightMode?: boolean;

	// Text Reader Settings
	fontSize?: number;
	fontFamily?: string;
	lineHeight?: number;
	letterSpacing?: number;
	textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export const DEFAULT_SETTINGS: ReaderSettings = {
	grayScale: false,
	asidePosition: 'right',
	progressBarPosition: 'top',
	showPageNumbers: false,
	brightness: 100,
	contrast: 100,
	invert: 0,
	nightMode: false,
	fontSize: 18,
	fontFamily: 'system-ui, -apple-system, sans-serif',
	lineHeight: 1.8,
	letterSpacing: 0,
	textAlign: 'justify',
};
