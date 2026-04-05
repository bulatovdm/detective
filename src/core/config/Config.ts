export interface XdebugConfig {
  host: string;
  port: number;
  ideKey: string;
}

export interface CliConfig {
  exec: string;
}

export interface PhpConfig {
  xdebug: XdebugConfig;
  binary: string;
  artisanPath: string;
  cli: CliConfig;
}

export interface AppConfig {
  url: string;
  basePath: string;
}

export interface DefaultsConfig {
  maxDepth: number;
  maxDataSize: number;
  maxChildren: number;
  timeout: number;
  maxResponseBodyLength: number;
}

export interface DetectiveConfig {
  adapter: string;
  app: AppConfig;
  php: PhpConfig;
  pathMapping: Record<string, string>;
  defaults: DefaultsConfig;
  skipTlsVerification: boolean;
}
