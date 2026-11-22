import { parseAllowedHosts, validateRequestHost } from './allowed-hosts';

describe('parseAllowedHosts', () => {
	it('parses a single host', () => {
		expect(parseAllowedHosts('example.com')).toEqual(['example.com']);
	});

	it('parses multiple comma-separated hosts', () => {
		expect(parseAllowedHosts('example.com,www.example.com')).toEqual([
			'example.com',
			'www.example.com',
		]);
	});

	it('trims whitespace around commas and entries', () => {
		expect(
			parseAllowedHosts('  example.com ,  *.example.com  , 127.0.0.1 '),
		).toEqual(['example.com', '*.example.com', '127.0.0.1']);
	});

	it('drops empty entries from leading, trailing, and consecutive commas', () => {
		expect(parseAllowedHosts(',example.com,,www.example.com,')).toEqual([
			'example.com',
			'www.example.com',
		]);
	});

	it('throws when ALLOWED_HOSTS is unset', () => {
		expect(() => parseAllowedHosts(undefined)).toThrowError(
			/ALLOWED_HOSTS/,
		);
	});

	it('throws when ALLOWED_HOSTS is an empty string', () => {
		expect(() => parseAllowedHosts('')).toThrowError(/ALLOWED_HOSTS/);
	});

	it('throws when ALLOWED_HOSTS contains only whitespace and commas', () => {
		expect(() => parseAllowedHosts('   ,  , ')).toThrowError(
			/ALLOWED_HOSTS/,
		);
	});

	it('rejects wildcard "*", bare "*.", ports, schemes, paths, and userinfo', () => {
		for (const invalid of [
			'*',
			'*.',
			'localhost:4000',
			'https://example.com',
			'example.com/path',
			'user@example.com',
			'bad host.com',
		]) {
			expect(() => parseAllowedHosts(invalid)).toThrowError(
				/Invalid ALLOWED_HOSTS entry/,
			);
		}
	});
});

describe('validateRequestHost', () => {
	it('accepts valid hostnames with or without port', () => {
		expect(validateRequestHost('example.com')).toBe('example.com');
		expect(validateRequestHost('localhost:4000')).toBe('localhost:4000');
	});

	it('rejects missing, array, or whitespace-containing Host headers', () => {
		expect(validateRequestHost(undefined)).toBeNull();
		expect(validateRequestHost('')).toBeNull();
		expect(validateRequestHost(['a.com', 'b.com'])).toBeNull();
		expect(validateRequestHost('example.com evil')).toBeNull();
	});

	it('rejects userinfo, path, query, and fragment injections', () => {
		expect(validateRequestHost('evil.com@example.com')).toBeNull();
		expect(validateRequestHost('example.com/route')).toBeNull();
		expect(validateRequestHost('example.com?q=1')).toBeNull();
		expect(validateRequestHost('example.com#frag')).toBeNull();
	});
});
