import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	APPROVED_VALUES_HELP_BLOCK_END,
	APPROVED_VALUES_HELP_BLOCK_START,
	renderApprovedValuesReferenceHtml
} from '../approved-values.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function updateHelpHtml(helpPath = path.join(__dirname, '..', 'help.html')) {
	const original = fs.readFileSync(helpPath, 'utf-8');
	const startIndex = original.indexOf(APPROVED_VALUES_HELP_BLOCK_START);
	const endIndex = original.indexOf(APPROVED_VALUES_HELP_BLOCK_END);
	if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
		throw new Error('Could not find approved values markers in help.html');
	}
	const replacement = [
		APPROVED_VALUES_HELP_BLOCK_START,
		renderApprovedValuesReferenceHtml({ includeSamples: false }),
		APPROVED_VALUES_HELP_BLOCK_END
	].join('\n');
	const updated = original.slice(0, startIndex) + replacement + original.slice(endIndex + APPROVED_VALUES_HELP_BLOCK_END.length);
	fs.writeFileSync(helpPath, updated);
	return helpPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const helpPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'help.html');
	updateHelpHtml(helpPath);
}