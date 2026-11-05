import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'smol-toml';

beforeAll(() => execFileSync('npm', ['run', 'build'], { stdio: 'pipe' }));

const projects: string[] = [];
const run = (project: string, action = 'connect') => execFileSync('bash', [resolve('scripts/link.sh'), action, project,
  ...(action === 'connect' ? ['--preset', 'docker', '--url', 'https://app.local', '--container', 'app', '--ide-key', 'detective', '--container-path', '/var/www/app', '--lang', 'en'] : [])], { encoding: 'utf8' });
const fixture = () => {
  const project = mkdtempSync(join(tmpdir(), "detective project's "));
  projects.push(project);
  return project;
};
afterEach(() => projects.splice(0).forEach(project => rmSync(project, { recursive: true, force: true })));

describe('project connection', () => {
  it('connects all clients portably, preserves other servers and local credentials on reconnect and disconnect', () => {
    const project = fixture();
    writeFileSync(join(project, '.mcp.json'), '{"mcpServers":{"other":{"command":"other"}}}');
    writeFileSync(join(project, 'opencode.jsonc'), '// keep me\n{"mcp":{"other":{"type":"local","command":["other"]}},}');
    mkdirSync(join(project, '.codex'));
    writeFileSync(join(project, '.codex/config.toml'), 'model = "example"\n[mcp_servers.other]\ncommand = "other"\n');
    run(project);
    const local = join(project, 'detective.local.json');
    const config = JSON.parse(readFileSync(local, 'utf8'));
    expect(config.pathMapping).toEqual({ '/var/www/app': '.' });
    config.auth = { type: 'header', header: 'X-Token', value: 'private' };
    writeFileSync(local, JSON.stringify(config));
    run(project);
    for (const file of ['.mcp.json', 'opencode.jsonc', '.codex/config.toml']) {
      const content = readFileSync(join(project, file), 'utf8');
      expect(content).toContain('detective');
      expect(content).toContain('other');
      expect(content).not.toContain(project);
      expect(content).not.toContain(process.cwd());
      expect(readFileSync(join(project, '.gitignore'), 'utf8')).not.toContain(file);
    }
    expect(readFileSync(join(project, '.gitignore'), 'utf8')).toContain('/detective.local.json');
    expect(readFileSync(join(project, 'opencode.jsonc'), 'utf8')).toContain('// keep me');
    expect(parse(readFileSync(join(project, '.codex/config.toml'), 'utf8')).model).toBe('example');
    run(project, 'disconnect');
    expect(JSON.parse(readFileSync(local, 'utf8')).auth.value).toBe('private');
    expect(JSON.parse(readFileSync(join(project, '.mcp.json'), 'utf8')).mcpServers).toEqual({ other: { command: 'other' } });
    expect(readFileSync(join(project, '.codex/config.toml'), 'utf8')).not.toContain('detective');
  });

  it('leaves all client files unchanged when one contains invalid configuration', () => {
    const project = fixture();
    const original = '{"mcpServers":{"other":{"command":"other"}}}';
    writeFileSync(join(project, '.mcp.json'), original);
    writeFileSync(join(project, 'opencode.json'), '{broken');
    expect(() => run(project)).toThrow();
    expect(readFileSync(join(project, '.mcp.json'), 'utf8')).toBe(original);
  });
});
