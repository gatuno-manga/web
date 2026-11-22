/**
 * Parses a comma-separated list of allowed hosts for Angular SSR `CommonEngine`.
 *
 * Trims whitespace around entries and drops empty values. Throws if the input
 * is unset or contains no non-empty hosts so misconfigured deploys fail fast.
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

	return hosts;
}
