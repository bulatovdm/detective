import { spawn } from 'node:child_process';
import type { CommandOutput } from '../adapter/types.js';

export function executeCliCommand(
  execTemplate: string,
  command: string,
  env?: Record<string, string>,
  timeoutMs?: number,
): Promise<CommandOutput> {
  const envPrefix = env
    ? Object.entries(env).map(([k, v]) => `${k}='${v}'`).join(' ') + ' '
    : '';
  const commandWithEnv = `${envPrefix}${command}`;
  const fullCommand = execTemplate.replace('{command}', commandWithEnv);

  return new Promise((resolve, reject) => {
    const proc = spawn('sh', ['-c', fullCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
    });

    const timer = timeoutMs
      ? setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`CLI command timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : undefined;

    proc.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    proc.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });
}
