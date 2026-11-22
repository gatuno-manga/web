import { parseAllowedHosts } from './allowed-hosts';

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
			parseAllowedHosts(
				'  example.com ,  *.example.com  , localhost:4000 ',
			),
		).toEqual(['example.com', '*.example.com', 'localhost:4000']);
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
});
