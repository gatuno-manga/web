import fs from 'node:fs';
import path from 'node:path';

const swagger = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));

const validEndpoints = [];
for (const [swaggerPath, methods] of Object.entries(swagger.paths)) {
	for (const method of Object.keys(methods)) {
		let normalizedPath = swaggerPath;
		if (normalizedPath.startsWith('/api/v1/')) {
			normalizedPath = normalizedPath.substring('/api/v1/'.length);
		} else if (normalizedPath.startsWith('/api/')) {
			normalizedPath = normalizedPath.substring('/api/'.length);
		} else if (normalizedPath.startsWith('/')) {
			normalizedPath = normalizedPath.substring(1);
		}

		validEndpoints.push({
			method: method.toLowerCase(),
			originalPath: swaggerPath,
			normalizedPath: normalizedPath,
			regex: new RegExp(
				`^${normalizedPath.replace(/\{[^}]+\}/g, '[^/]+')}$`,
			),
		});
	}
}

function getAllFiles(dirPath, arrayOfFiles) {
	const files = fs.readdirSync(dirPath);
	arrayOfFiles = arrayOfFiles || [];
	for (const file of files) {
		if (fs.statSync(`${dirPath}/${file}`).isDirectory()) {
			arrayOfFiles = getAllFiles(`${dirPath}/${file}`, arrayOfFiles);
		} else {
			if (file.endsWith('.ts')) {
				arrayOfFiles.push(path.join(dirPath, '/', file));
			}
		}
	}
	return arrayOfFiles;
}

const files = getAllFiles('src/app');

// Matches this.http.post<Type>('path' or `path`
const httpRegex =
	/this\.http\s*\.\s*(get|post|put|patch|delete)(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\2/g;

let allValid = true;
let totalRequests = 0;

for (const file of files) {
	const content = fs.readFileSync(file, 'utf8');
	const matches = [...content.matchAll(httpRegex)];

	for (const match of matches) {
		const method = match[1].toLowerCase();
		let rawPath = match[3];
		// Skip external urls or ones we know are absolute
		if (rawPath.startsWith('http')) continue;
		if (rawPath.startsWith('/')) {
			rawPath = rawPath.substring(1);
		}

		totalRequests++;

		// Convert string interpolation vars to test dummy values
		let testPath = rawPath.replace(/\$\{[^}]+\}/g, '123');
		testPath = testPath.split('?')[0];

		// specific to some services removing their baseUrl logic
		testPath = testPath.replace(`\${this.baseUrl}/`, '');
		testPath = testPath.replace(`\${this.baseUrl}`, '');

		const isValid = validEndpoints.some(
			(ep) => ep.method === method && ep.regex.test(testPath),
		);

		if (!isValid) {
			console.log(
				`INVALID: ${method.toUpperCase()} ${rawPath} in ${file}`,
			);
			const testPrefix = testPath.split('/')[0];
			const closest = validEndpoints.filter(
				(ep) =>
					ep.method === method &&
					ep.normalizedPath.startsWith(testPrefix),
			);
			if (closest.length > 0) {
				console.log(`  Closest valid endpoints:`);
				closest.slice(0, 3).forEach((c) => {
					console.log(
						`   - ${c.method.toUpperCase()} ${c.originalPath}`,
					);
				});
			} else {
				console.log(
					`  No matching endpoints found starting with '${testPrefix}'.`,
				);
			}
			allValid = false;
		}
	}
}

if (allValid) {
	console.log(`All ${totalRequests} endpoints are VALID!`);
} else {
	console.log('Some endpoints are invalid.');
}
