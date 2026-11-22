const ALLOWED_HOST_PATTERN = /^(\*\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/;

/**
 * Parses a comma-separated list of allowed hosts for Angular SSR `CommonEngine`.
 *
 * Trims whitespace around entries, drops empty values, and rejects wildcards
 * (`*`, `*.`), schemes, userinfo, paths, ports, or malformed hostnames. Throws
 * if unset or empty after filtering so misconfigured deploys fail fast.
 */
export function parseAllowedHosts(raw: string | undefined): string[] {
	const hosts = (raw ?? '')
		.split(',')
		.map((host) => host.trim())
		.filter(Boolean);

	if (hosts.length === 0) {
		throw new Error(
			'ALLOWED_HOSTS environment variable must be set to at least one non-empty host',
		);
	}

	for (const host of hosts) {
		if (!ALLOWED_HOST_PATTERN.test(host)) {
			throw new Error(
				`Invalid ALLOWED_HOSTS entry "${host}": expected a hostname or "*.domain" without scheme, port, path, or wildcard "*"`,
			);
		}
	}

	return hosts;
}

/**
 * Validates an incoming HTTP `Host` header before interpolating it into an SSR URL.
 *
 * Returns the validated host string, or `null` when missing or containing
 * userinfo, paths, queries, fragments, whitespace, or invalid URL syntax.
 */
export function validateRequestHost(
	hostHeader: string | string[] | undefined,
): string | null {
	if (typeof hostHeader !== 'string' || hostHeader.length === 0) {
		return null;
	}

	if (/\s/.test(hostHeader)) {
		return null;
	}

	try {
		const parsed = new URL(`http://${hostHeader}`);
		if (
			parsed.hostname === '' ||
			parsed.username !== '' ||
			parsed.password !== '' ||
			parsed.pathname !== '/' ||
			parsed.search !== '' ||
			parsed.hash !== ''
		) {
			return null;
		}
		return hostHeader;
	} catch {
		return null;
	}
}
