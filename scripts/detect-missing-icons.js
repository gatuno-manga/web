const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '../src');
const iconsDir = path.join(__dirname, '../public/assets/icons');

console.log('🔍 Iniciando verificação de ícones...');

// 1. Obter todos os ícones disponíveis
const availableIcons = new Set();
if (fs.existsSync(iconsDir)) {
	const files = fs.readdirSync(iconsDir);
	files.forEach((file) => {
		if (file.endsWith('.svg')) {
			availableIcons.add(file.replace('.svg', ''));
		}
	});
	console.log(
		`✅ Encontrados ${availableIcons.size} ícones disponíveis em ${path.relative(path.join(__dirname, '..'), iconsDir)}`,
	);
} else {
	console.error(`❌ Diretório de ícones não encontrado: ${iconsDir}`);
	process.exit(1);
}

// 2. Percorrer arquivos em busca de uso
function getAllFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		if (fs.statSync(filePath).isDirectory()) {
			getAllFiles(filePath, fileList);
		} else if (filePath.endsWith('.html') || filePath.endsWith('.ts')) {
			fileList.push(filePath);
		}
	}
	return fileList;
}

const allFiles = getAllFiles(srcDir);

// 3. Extrair ícones usados via Regex
const usedIcons = new Map(); // iconName -> Set of filePaths
const regexes = [
	// Pega usos estáticos: name="icon-name" ou name='icon-name'
	{ pattern: /<app-icons[^>]*\sname=["']([^"']+)["']/g, group: 1 },
	{ pattern: /<app-icon-button[^>]*\sname=["']([^"']+)["']/g, group: 1 },

	// Pega usos literais com property binding: [name]="'icon-name'" ou [name]='"icon-name"'
	{ pattern: /<app-icons[^>]*\s\[name\]=["'](['"])([^'"]+)\1["']/g, group: 2 },
	{ pattern: /<app-icon-button[^>]*\s\[name\]=["'](['"])([^'"]+)\1["']/g, group: 2 },

	// Pega usos estáticos do atributo icon em botões, inputs, etc: icon="icon-name"
	{ pattern: /\sicon=["']([^"']+)["']/g, group: 1 },

	// Pega usos literais do atributo icon: [icon]="'icon-name'" ou [icon]='"icon-name"'
	{ pattern: /\s\[icon\]=["'](['"])([^'"]+)\1["']/g, group: 2 },

	// Pega usos em objetos TS como ContextMenuItem: icon: 'icon-name'
	{ pattern: /icon:\s*['"]([^'"]+)['"]/g, group: 1 },
];

allFiles.forEach((filePath) => {
	const content = fs.readFileSync(filePath, 'utf8');

	regexes.forEach(({ pattern, group }) => {
		let match = pattern.exec(content);
		while (match !== null) {
			const iconName = match[group];

			if (!usedIcons.has(iconName)) {
				usedIcons.set(iconName, new Set());
			}
			usedIcons.get(iconName).add(filePath);
			match = pattern.exec(content);
		}
	});
});

console.log(
	`✅ Encontradas ${usedIcons.size} referências únicas a ícones nos templates.`,
);

// 4. Cruzar dados para encontrar ícones ausentes
const missingIcons = [];
for (const [icon, files] of usedIcons.entries()) {
	if (!availableIcons.has(icon)) {
		missingIcons.push({ icon, files: Array.from(files) });
	}
}

// 5. Relatório final
console.log('\n--- Relatório ---');
if (missingIcons.length === 0) {
	console.log(
		'✨ Sucesso: Todos os ícones referenciados no sistema existem na pasta public/assets/icons.',
	);
	process.exit(0);
} else {
	console.error(
		'❌ ATENÇÃO: Foram encontrados ícones ausentes (sendo referenciados mas não existem arquivos SVG):\n',
	);
	missingIcons.forEach((item) => {
		console.error(`Ícone: "${item.icon}"`);
		console.error(`Usado em:`);
		item.files.forEach((f) => {
			console.error(
				`  - ${path.relative(path.join(__dirname, '..'), f)}`,
			);
		});
		console.error('');
	});
	process.exit(1);
}
