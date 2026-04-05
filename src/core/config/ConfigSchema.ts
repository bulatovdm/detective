import { z } from 'zod';

const xdebugSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(9003),
  ideKey: z.string().default('detective'),
});

const cliSchema = z.object({
  exec: z.string().default('{command}'),
});

const phpSchema = z.object({
  xdebug: xdebugSchema.default({}),
  binary: z.string().default('php'),
  artisanPath: z.string().default('./artisan'),
  cli: cliSchema.default({}),
});

const appSchema = z.object({
  url: z.string().url(),
  basePath: z.string().default(''),
});

const defaultsSchema = z.object({
  maxDepth: z.number().int().min(1).default(3),
  maxDataSize: z.number().int().min(1024).default(65536),
  maxChildren: z.number().int().min(1).default(128),
  timeout: z.number().min(1).default(30),
  maxResponseBodyLength: z.number().int().min(100).default(10000),
});

export const configSchema = z.object({
  adapter: z.string().default('php'),
  app: appSchema,
  php: phpSchema.default({}),
  pathMapping: z.record(z.string(), z.string()).default({}),
  defaults: defaultsSchema.default({}),
  skipTlsVerification: z.boolean().default(true),
});

export type RawConfig = z.input<typeof configSchema>;
