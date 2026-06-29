const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '../src');
const assetsDir = path.join(__dirname, '../public/assets/scss');

function getAllFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		if (fs.statSync(filePath).isDirectory()) {
			getAllFiles(filePath, fileList);
		} else if (filePath.endsWith('.scss')) {
			fileList.push(filePath);
		}
	}
	return fileList;
}

const allFiles = [...getAllFiles(srcDir), ...getAllFiles(assetsDir)];

// Regex to catch backdrop-filter and optional -webkit-backdrop-filter
const blurRegex =
	/([ \t]*)backdrop-filter:\s*blur\(([^)]+)\)(?:\s*saturate\(([^)]+)\))?;(?:[ \t]*\n[ \t]*-webkit-backdrop-filter:[^;]+;)?/g;

let updatedFiles = 0;

allFiles.forEach((filePath) => {
	// Skip mixins itself
	if (filePath.endsWith('_mixins.scss')) return;

	let content = fs.readFileSync(filePath, 'utf8');
	let modified = false;

	content = content.replace(blurRegex, (_match, indent, blurVal, satVal) => {
		modified = true;

		let mixin = 'glass-overlay'; // default fallback

		if (blurVal === '4px' || blurVal === '5px') mixin = 'glass-light';
		else if (blurVal === '8px') mixin = 'glass-medium';
		else if (blurVal === '12px') mixin = 'glass-overlay';
		else if (blurVal === '15px' || blurVal === '16px') {
			if (satVal) mixin = 'glass-dropdown';
			else mixin = 'glass-overlay';
		} else if (blurVal === '24px') mixin = 'glass-panel';
		else if (blurVal === '96px') mixin = 'glass-heavy';

		return `${indent}@include ${mixin};`;
	});

	if (modified) {
		// If the file does not have an import for mixins, add it at the top
		if (
			!content.includes('@use') &&
			!content.includes("@import 'mixins'") &&
			!content.includes('@import "mixins"')
		) {
			content = `@import 'mixins';\n${content}`;
		}

		fs.writeFileSync(filePath, content, 'utf8');
		console.log(
			`✅ Atualizado: ${path.relative(path.join(__dirname, '..'), filePath)}`,
		);
		updatedFiles++;
	}
});

console.log(`\n🎉 Total de arquivos padronizados: ${updatedFiles}`);
