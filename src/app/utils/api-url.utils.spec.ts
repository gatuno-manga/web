import { buildApiUrl } from './api-url.utils';

describe('buildApiUrl', () => {
	type RuntimeAccess = {
		process?: {
			env?: Record<string, string | undefined>;
		};
	};

	const runtimeAccess = globalThis as unknown as RuntimeAccess;
	let originalProcess: RuntimeAccess['process'];

	beforeEach(() => {
		originalProcess = runtimeAccess.process;
	});

	afterEach(() => {
		runtimeAccess.process = originalProcess;
	});

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

	it('deve priorizar API_URL_SERVER em SSR quando disponível no runtime', () => {
		runtimeAccess.process = {
			env: {
				API_URL_SERVER: 'http://api:3000',
				API_URL: 'http://localhost:3000',
			},
		};

		const url = buildApiUrl('/auth/refresh', {
			isBrowser: false,
			apiUrl: 'http://localhost:3000/api',
			apiUrlServer: 'http://localhost:3000/api',
		});

		expect(url).toBe('http://api:3000/api/auth/refresh');
	});

	it('deve usar API_URL em SSR quando API_URL_SERVER não estiver definida', () => {
		runtimeAccess.process = {
			env: {
				API_URL: 'http://api:3000',
			},
		};

		const url = buildApiUrl('/auth/refresh', {
			isBrowser: false,
			apiUrl: 'http://localhost:3000/api',
			apiUrlServer: 'http://localhost:3000/api',
		});

		expect(url).toBe('http://api:3000/api/auth/refresh');
	});

	it('deve substituir loopback por serviço api em SSR quando rodando em container', () => {
		runtimeAccess.process = {
			env: {
				HOSTNAME: 'a1b2c3d4e5f6',
			},
		};

		const url = buildApiUrl('/auth/refresh', {
			isBrowser: false,
			apiUrl: 'http://localhost:3000/api',
			apiUrlServer: 'http://localhost:3000/api',
		});

		expect(url).toBe('http://api:3000/api/auth/refresh');
	});
});
