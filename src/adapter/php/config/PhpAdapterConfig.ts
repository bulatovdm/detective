import type { DetectiveConfig, PhpConfig, DefaultsConfig } from '../../../core/config/Config.js';

export interface PhpAdapterFullConfig {
  php: PhpConfig;
  appUrl: string;
  appBasePath: string;
  pathMapping: Record<string, string>;
  defaults: DefaultsConfig;
  projectRoot: string;
}

export function extractPhpConfig(config: DetectiveConfig, projectRoot: string): PhpAdapterFullConfig {
  return {
    php: config.php,
    appUrl: config.app.url,
    appBasePath: config.app.basePath,
    pathMapping: config.pathMapping,
    defaults: config.defaults,
    projectRoot,
  };
}
