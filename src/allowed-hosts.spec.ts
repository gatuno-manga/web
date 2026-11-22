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

	it('rejects wildcard "*", bare "*.", single-label "*.tld", ports, schemes, paths, userinfo, and mixed invalid lists', () => {
		for (const invalid of [
			'*',
			'*.',
			'*.com',
			'example.com,*',
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
	it('accepts valid hostnames, ports, and IPv6 literals', () => {
		expect(validateRequestHost('example.com')).toBe('example.com');
		expect(validateRequestHost('localhost:4000')).toBe('localhost:4000');
		expect(validateRequestHost('[::1]:4000')).toBe('[::1]:4000');
	});

	it('rejects missing, array, whitespace, and control-character Host headers', () => {
		expect(validateRequestHost(undefined)).toBeNull();
		expect(validateRequestHost('')).toBeNull();
		expect(validateRequestHost(['a.com', 'b.com'])).toBeNull();
		expect(validateRequestHost('example.com evil')).toBeNull();
		expect(validateRequestHost('example.com\nevil')).toBeNull();
		expect(validateRequestHost('example.com\tevil')).toBeNull();
		expect(validateRequestHost('example.com ')).toBeNull();
		expect(validateRequestHost('example.com\x00')).toBeNull();
		expect(validateRequestHost('example.com\x7f')).toBeNull();
	});

	it('rejects userinfo, path, query, fragment, and bare-delimiter injections', () => {
		expect(validateRequestHost('evil.com@example.com')).toBeNull();
		expect(validateRequestHost(':pass@example.com')).toBeNull();
		expect(validateRequestHost('@example.com')).toBeNull();
		expect(validateRequestHost('example.com/route')).toBeNull();
		expect(validateRequestHost('example.com/')).toBeNull();
		expect(validateRequestHost('example.com\\')).toBeNull();
		expect(validateRequestHost('example.com?q=1')).toBeNull();
		expect(validateRequestHost('example.com?')).toBeNull();
		expect(validateRequestHost('example.com#frag')).toBeNull();
		expect(validateRequestHost('example.com#')).toBeNull();
		expect(validateRequestHost('example.com:')).toBeNull();
	});

	it('rejects malformed URL syntax and invalid ports', () => {
		expect(validateRequestHost('example.com:abc')).toBeNull();
		expect(validateRequestHost('example.com:99999')).toBeNull();
		expect(validateRequestHost('[')).toBeNull();
	});
});
