const fs = require('node:fs');
const path = require('node:path');

const envDirectory = path.join(__dirname, 'src/environments');
const targetPath = path.join(envDirectory, 'environment.prod.ts');

if (!fs.existsSync(envDirectory)) {
	fs.mkdirSync(envDirectory, { recursive: true });
}

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
	try {
		// Tenta usar a função nativa do Node 20.6+
		if (typeof process.loadEnvFile === 'function') {
			process.loadEnvFile(envPath);
		} else {
			// Fallback para leitura manual
			const envContent = fs.readFileSync(envPath, 'utf8');
			envContent.split('\n').forEach((line: string) => {
				const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
				if (match) {
					const key = match[1];
					let value = match[2] || '';
					if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
					if (!process.env[key]) process.env[key] = value;
				}
			});
		}
	} catch (e) {
		console.warn('Não foi possível carregar o arquivo .env:', e);
	}
}

const envConfigFile = `// This file was generated automatically by the generate-env.ts script
export const environment = {
	production: true,
	apiURL: '${process.env.API_URL || 'http://localhost:3000'}/api',
	apiURLServer: '${process.env.API_URL_SERVER || process.env.API_URL || 'http://localhost:3000'}/api',
	mqttBrokerUrl: '${process.env.MQTT_BROKER_URL || 'ws://localhost:8083/mqtt'}',
};
`;

fs.writeFile(
	targetPath,
	envConfigFile,
	'utf8',
	(err: NodeJS.ErrnoException | null) => {
		if (err) {
			console.error('Error generating environment.prod.ts file:', err);
			process.exit(1);
		} else {
			console.log(
				`Successfully generated environment.prod.ts at ${targetPath}`,
			);
		}
	},
);
