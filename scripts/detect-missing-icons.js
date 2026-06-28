const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '../src');
const iconsDir = path.join(__dirname, '../public/assets/icons');

console.log('🔍 Iniciando verificação de ícones...');

// 1. Obter todos os ícones disponíveis
const availableIcons = new Set();
if (fs.existsSync(iconsDir)) {
	const files = fs.readdirSync(iconsDir);
	files.forEach(file => {
		if (file.endsWith('.svg')) {
			availableIcons.add(file.replace('.svg', ''));
		}
	});
	console.log(`✅ Encontrados ${availableIcons.size} ícones disponíveis em ${path.relative(path.join(__dirname, '..'), iconsDir)}`);
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
	/<app-icons[^>]*\sname=["']([^"']+)["']/g,
	/<app-icon-button[^>]*\sname=["']([^"']+)["']/g,
	
	// Pega usos literais com property binding: [name]="'icon-name'" ou [name]='"icon-name"'
	/<app-icons[^>]*\s\[name\]=["'](['"])([^'"]+)\1["']/g,
	/<app-icon-button[^>]*\s\[name\]=["'](['"])([^'"]+)\1["']/g,
];

allFiles.forEach(filePath => {
	const content = fs.readFileSync(filePath, 'utf8');
	
	regexes.forEach((regex, index) => {
		let match;
		while ((match = regex.exec(content)) !== null) {
			// Para os property bindings, o nome está no grupo 2. Para estáticos, no grupo 1.
			const iconName = index > 1 ? match[2] : match[1];
			
			if (!usedIcons.has(iconName)) {
				usedIcons.set(iconName, new Set());
			}
			usedIcons.get(iconName).add(filePath);
		}
	});
});

console.log(`✅ Encontradas ${usedIcons.size} referências únicas a ícones nos templates.`);

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
	console.log('✨ Sucesso: Todos os ícones referenciados no sistema existem na pasta public/assets/icons.');
	process.exit(0);
} else {
	console.error('❌ ATENÇÃO: Foram encontrados ícones ausentes (sendo referenciados mas não existem arquivos SVG):\n');
	missingIcons.forEach(item => {
		console.error(`Ícone: "${item.icon}"`);
		console.error(`Usado em:`);
		item.files.forEach(f => console.error(`  - ${path.relative(path.join(__dirname, '..'), f)}`));
		console.error('');
	});
	process.exit(1);
}
