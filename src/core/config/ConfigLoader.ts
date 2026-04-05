import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { configSchema, type RawConfig } from './ConfigSchema.js';
import type { DetectiveConfig } from './Config.js';

const DEFAULT_CONFIG_FILENAME = 'detective.json';

export async function loadConfig(configPath?: string): Promise<DetectiveConfig> {
  const filePath = configPath ?? resolve(process.cwd(), DEFAULT_CONFIG_FILENAME);

  const raw = await readFile(filePath, 'utf-8');
  const json: unknown = JSON.parse(raw);

  return configSchema.parse(json) as DetectiveConfig;
}

export function parseConfig(raw: RawConfig): DetectiveConfig {
  return configSchema.parse(raw) as DetectiveConfig;
}
