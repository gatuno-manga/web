import * as fs from 'node:fs';
import * as path from 'node:path';

const envDirectory = path.join(import.meta.dirname, 'src/environments');
const targetPath = path.join(envDirectory, 'environment.prod.ts');

if (!fs.existsSync(envDirectory)) {
	fs.mkdirSync(envDirectory, { recursive: true });
}

const envConfigFile = `// This file was generated automatically by the generate-env.ts script
export const environment = {
	production: true,
	apiUrl: '${process.env.API_URL || 'http://localhost:3001/api'}',
	apiUrlServer: '${process.env.API_URL_SERVER || 'http://api:3000/api'}'
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
