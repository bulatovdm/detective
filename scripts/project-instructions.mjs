import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const [action, file, template] = process.argv.slice(2);
const content = readFileSync(file, 'utf8');
const section = /<!-- detective:start -->[\s\S]*?<!-- detective:end -->/;
const replacement = action === 'update'
    ? `<!-- detective:start -->\n${readFileSync(template, 'utf8')}\n<!-- detective:end -->`
    : '';
const updated = content.replace(section, replacement).trim();
if (updated) writeFileSync(file, `${updated}\n`);
else unlinkSync(file);
