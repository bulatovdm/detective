import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { applyEdits, modify, parse as parseJson, printParseErrorCode } from 'jsonc-parser';
import { parse as parseToml, stringify } from 'smol-toml';

const [action, project] = process.argv.slice(2);
if (!project || !['connect', 'disconnect', 'status'].includes(action)) {
    throw new Error('Usage: project-mcp.mjs connect|disconnect|status project');
}

const command = ['detective', 'serve', '--config', 'detective.json'];
const clients = [
    { file: '.mcp.json', key: 'mcpServers', value: { type: 'stdio', command: command[0], args: command.slice(1) } },
    { file: existsSync(join(project, 'opencode.jsonc')) ? 'opencode.jsonc' : 'opencode.json', key: 'mcp', value: { type: 'local', command, enabled: true } },
    { file: '.codex/config.toml', key: 'mcp_servers', value: { command: command[0], args: command.slice(1) } },
];

const updates = clients.map(client => {
    const path = join(project, client.file);
    const original = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const toml = client.file.endsWith('.toml');
    const errors = [];
    const data = toml ? parseToml(original) : parseJson(original || '{}', errors, { allowTrailingComma: true });
    if (errors.length) throw new Error(`${client.file}: ${printParseErrorCode(errors[0].error)}`);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${client.file}: expected an object`);
    if (data[client.key] && (typeof data[client.key] !== 'object' || Array.isArray(data[client.key]))) {
        throw new Error(`${client.file}: invalid ${client.key}`);
    }
    if (action === 'status') {
        console.log(`  ${client.file}: detective ${data[client.key]?.detective ? 'configured' : 'not configured'}`);
        return null;
    }
    if (action === 'disconnect' && !data[client.key]?.detective) return null;
    const value = action === 'connect' ? client.value : undefined;
    let content;
    if (toml) {
        data[client.key] ??= {};
        if (value) data[client.key].detective = value;
        else delete data[client.key].detective;
        content = stringify(data);
    } else {
        content = applyEdits(original || '{}\n', modify(original || '{}\n', [client.key, 'detective'], value, {
            formattingOptions: { insertSpaces: true, tabSize: 2 },
        }));
    }
    return { path, content: content.endsWith('\n') ? content : `${content}\n`, file: client.file };
});

if (action === 'connect') {
    const ignorePath = join(project, '.gitignore');
    const original = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : '';
    const entries = ['/detective.local.json'];
    const missing = entries.filter(entry => !original.split(/\r?\n/).includes(entry));
    if (missing.length) writeFileSync(ignorePath, `${original}${original && !original.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`);
}
for (const update of updates.filter(Boolean)) {
    mkdirSync(dirname(update.path), { recursive: true });
    writeFileSync(update.path, update.content);
    console.log(`  ${update.file}: detective ${action === 'connect' ? 'configured' : 'removed'}`);
}
