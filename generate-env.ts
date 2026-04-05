const fs = require('node:fs');
const path = require('node:path');

const envDirectory = path.join(__dirname, 'src/environments');
const targetPath = path.join(envDirectory, 'environment.prod.ts');

if (!fs.existsSync(envDirectory)) {
	fs.mkdirSync(envDirectory, { recursive: true });
}

const envConfigFile = `// This file was generated automatically by the generate-env.ts script
export const environment = {
	production: true,
	apiURL: '${process.env.API_URL || 'http://localhost:3001'}/api',
	apiURLServer: '${process.env.API_URL_SERVER || process.env.API_URL || 'http://localhost:3001'}/api'
};
`;

fs.writeFile(targetPath, envConfigFile, 'utf8', (err) => {
	if (err) {
		console.error('Error generating environment.prod.ts file:', err);
		process.exit(1);
	} else {
		console.log(
			`Successfully generated environment.prod.ts at ${targetPath}`,
		);
	}
});
