#!/usr/bin/env node

import { resolve, dirname } from 'node:path';
import { loadConfig } from './core/config/ConfigLoader.js';
import { DetectiveServer } from './core/DetectiveServer.js';
import { Logger } from './core/util/Logger.js';

const logger = new Logger('main');

async function main(): Promise<void> {
  const configArg = process.argv.find((_, i, arr) => arr[i - 1] === '--config');
  const configPath = configArg ? resolve(configArg) : undefined;
  const projectRoot = configPath ? dirname(configPath) : process.cwd();

  try {
    const config = await loadConfig(configPath);

    if (config.skipTlsVerification) {
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    }

    const server = new DetectiveServer(config, projectRoot);
    await server.start();

    let shuttingDown = false;
    const shutdownGracefully = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info('Received shutdown signal');
      await server.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdownGracefully);
    process.on('SIGTERM', shutdownGracefully);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to start: ${message}`);
    process.exit(1);
  }
}

main();
