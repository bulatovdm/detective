import { describe, it, expect } from 'vitest';
import { executeCliCommand } from '../../../src/core/cli/CliExecutor.js';

describe('CliExecutor', () => {
  it('executes a simple command and captures stdout', async () => {
    const result = await executeCliCommand('{command}', 'echo hello');
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);
  });

  it('captures stderr', async () => {
    const result = await executeCliCommand('{command}', 'echo error >&2');
    expect(result.stderr.trim()).toBe('error');
  });

  it('returns non-zero exit code on failure', async () => {
    const result = await executeCliCommand('{command}', 'exit 42');
    expect(result.exitCode).toBe(42);
  });

  it('injects env variables as prefix into command', async () => {
    const result = await executeCliCommand(
      '{command}',
      'printenv MY_VAR',
      { MY_VAR: 'injected' },
    );
    expect(result.stdout.trim()).toBe('injected');
  });

  it('replaces {command} in exec template', async () => {
    const result = await executeCliCommand(
      'sh -c "{command}"',
      'echo from_template',
    );
    expect(result.stdout.trim()).toBe('from_template');
  });

  it('times out long-running commands', async () => {
    await expect(
      executeCliCommand('{command}', 'sleep 10', undefined, 100),
    ).rejects.toThrow('timed out');
  });

  it('combines env and template correctly', async () => {
    const result = await executeCliCommand(
      'sh -c "{command}"',
      'printenv XDEBUG_SESSION',
      { XDEBUG_SESSION: 'detective' },
    );
    expect(result.stdout.trim()).toBe('detective');
  });
});
