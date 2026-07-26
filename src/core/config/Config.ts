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

export interface FormAuthConfig {
  type: 'form';
  url: string;
  method: string;
  credentials: Record<string, string>;
  cookieNames: string[];
}

export interface HeaderAuthConfig {
  type: 'header';
  header: string;
  value?: string;
  valueEnv?: string;
}

export type AuthenticatorConfig = FormAuthConfig | HeaderAuthConfig;

export type AuthConfig = AuthenticatorConfig | AuthenticatorConfig[];

export interface DetectiveConfig {
  adapter: string;
  app: AppConfig;
  auth?: AuthConfig;
  php: PhpConfig;
  pathMapping: Record<string, string>;
  defaults: DefaultsConfig;
  skipTlsVerification: boolean;
}
