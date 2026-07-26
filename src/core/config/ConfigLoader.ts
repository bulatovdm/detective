import { readFile } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
import { configSchema, type RawConfig } from './ConfigSchema.js';
import type { DetectiveConfig } from './Config.js';

const DEFAULT_CONFIG_FILENAME = 'detective.json';
const LOCAL_CONFIG_SUFFIX = '.local.json';

export async function loadConfig(configPath?: string): Promise<DetectiveConfig> {
  const filePath = configPath ?? resolve(process.cwd(), DEFAULT_CONFIG_FILENAME);

  const raw = await readFile(filePath, 'utf-8');
  const json: unknown = JSON.parse(raw);

  const local = await readLocalConfig(filePath);

  return configSchema.parse(
    mergeConfigLayers(json, local),
  ) as DetectiveConfig;
}

export function parseConfig(raw: RawConfig): DetectiveConfig {
  return configSchema.parse(raw) as DetectiveConfig;
}

export function localConfigPath(configPath: string): string {
  const name = basename(configPath).replace(/\.json$/, '');

  return join(dirname(configPath), `${name}${LOCAL_CONFIG_SUFFIX}`);
}

export function mergeConfigLayers(base: unknown, local: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(local)) {
    return local === undefined ? base : local;
  }

  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(local)) {
    result[key] = isPlainObject(value) && isPlainObject(base[key])
      ? mergeConfigLayers(base[key], value)
      : value;
  }

  return result;
}

async function readLocalConfig(configPath: string): Promise<unknown> {
  try {
    const raw = await readFile(localConfigPath(configPath), 'utf-8');

    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
