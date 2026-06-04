import fs from 'node:fs';
import { env } from 'node:process';

/**
 * Swagger Helper for AI
 *
 * Usage:
 * node scripts/swagger-helper.mjs --summary          # List all endpoints
 * node scripts/swagger-helper.mjs --path /api/user   # Show detail for a specific path
 * node scripts/swagger-helper.mjs --model User       # Show schema for a specific model
 * node scripts/swagger-helper.mjs --fetch [url]     # Update local swagger.json
 */

const CACHE_FILE = 'swagger.json';
const getBaseUrl = () => {
	let base = env.API_URL || 'http://localhost:3000';
	if (!base.includes('/api')) {
		base = base.endsWith('/') ? `${base}api` : `${base}/api`;
	}
	return base;
};

const baseUrl = getBaseUrl();
const DEFAULT_URL = `${baseUrl}/docs-json`;

async function main() {
	const args = process.argv.slice(2);
	const command = args[0];
	const value = args[1];

	if (command === '--fetch') {
		await fetchSwagger(value || DEFAULT_URL);
		return;
	}

	if (!fs.existsSync(CACHE_FILE)) {
		console.log('Cache file not found. Fetching from default URL...');
		await fetchSwagger(DEFAULT_URL);
	}

	const swagger = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

	switch (command) {
		case '--summary':
			printSummary(swagger);
			break;
		case '--path':
			printPathDetail(swagger, value);
			break;
		case '--model':
			printModelDetail(swagger, value);
			break;
		default:
			console.log(
				'Usage: node scripts/swagger-helper.mjs [--summary | --path <path> | --model <model> | --fetch <url>]',
			);
	}
}

async function fetchSwagger(url) {
	try {
		console.error(`Fetching from ${url}...`);
		const response = await fetch(url);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();
		fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
		console.error('Saved to swagger.json');
	} catch (e) {
		console.error('Failed to fetch swagger:', e.message);
		process.exit(1);
	}
}

function printSummary(swagger) {
	console.log(`API: ${swagger.info.title} (${swagger.info.version})`);
	console.log('='.repeat(50));
	for (const [path, methods] of Object.entries(swagger.paths)) {
		for (const [method, detail] of Object.entries(methods)) {
			console.log(
				`${method.toUpperCase().padEnd(7)} ${path.padEnd(40)} | ${detail.summary || detail.operationId || ''}`,
			);
		}
	}
}

function printPathDetail(swagger, targetPath) {
	const detail = swagger.paths[targetPath];
	if (!detail) {
		console.log(`Path ${targetPath} not found.`);
		return;
	}
	console.log(JSON.stringify(detail, null, 2));
}

function printModelDetail(swagger, modelName) {
	const schemas = swagger.components?.schemas || swagger.definitions;
	const model = schemas?.[modelName];
	if (!model) {
		console.log(`Model ${modelName} not found.`);
		return;
	}
	console.log(JSON.stringify({ [modelName]: model }, null, 2));
}

main();
