const http = require('node:http');

const url =
	'http://localhost:9000/books/3a/019e5172-c3f6-7159-a251-cf912879273a.webp';
const origin = 'http://localhost:4200';

const testRequest = (name, extraHeaders = {}) => {
	return new Promise((resolve) => {
		console.log(`--- Testando: ${name} ---`);
		const options = {
			method: 'GET',
			headers: extraHeaders,
		};

		const req = http.request(url, options, (res) => {
			console.log(`Status: ${res.statusCode}`);
			console.log(
				`Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin'] || 'MISSING'}`,
			);
			console.log(`Vary: ${res.headers['vary'] || 'MISSING'}`);
			console.log('');
			resolve();
		});
		req.end();
	});
};

async function run() {
	await testRequest('Sem Origin (Simulando <img> padrão)');
	await testRequest('Com Origin (Simulando fetch/XHR)', { Origin: origin });
	console.log(
		'Se o Vary estiver MISSING, a cache do navegador pode causar problemas de CORS.',
	);
}

run();
