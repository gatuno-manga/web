import { buildApiUrl } from './api-url.utils';

describe('buildApiUrl', () => {
	it('deve montar URL da API para caminhos relativos', () => {
		const url = buildApiUrl('/auth/refresh', {
			isBrowser: true,
			apiUrl: 'http://localhost:3000/api',
			origin: 'http://localhost:4200',
		});

		expect(url).toBe('http://localhost:3000/api/auth/refresh');
	});

	it('deve manter URL absoluta inalterada', () => {
		const url = buildApiUrl('https://example.com/health', {
			isBrowser: true,
			apiUrl: 'http://localhost:3000/api',
			origin: 'http://localhost:4200',
		});

		expect(url).toBe('https://example.com/health');
	});

	it('deve alinhar host loopback da API com o host da origem do browser', () => {
		const url = buildApiUrl('/auth/refresh', {
			isBrowser: true,
			apiUrl: 'http://localhost:3000/api',
			origin: 'http://127.0.0.1:4200',
		});

		expect(url).toBe('http://127.0.0.1:3000/api/auth/refresh');
	});

	it('não deve alterar hosts não-loopback', () => {
		const url = buildApiUrl('/auth/refresh', {
			isBrowser: true,
			apiUrl: 'https://api.gatuno.dev/api',
			origin: 'http://localhost:4200',
		});

		expect(url).toBe('https://api.gatuno.dev/api/auth/refresh');
	});
});
