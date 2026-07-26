import type { AuthConfig, FormAuthConfig, HeaderAuthConfig } from '../config/Config.js';

export interface AuthFetch {
  (url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{
    status: number;
    headers: { getSetCookie?: () => string[]; get: (name: string) => string | null };
  }>;
}

export class AuthResolver {
  private cachedCookie?: string;

  constructor(
    private readonly config: AuthConfig | undefined,
    private readonly appUrl: string,
    private readonly fetchImpl: AuthFetch,
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  async headers(): Promise<Record<string, string>> {
    if (this.config === undefined) {
      return {};
    }

    if (this.config.type === 'header') {
      return this.headerAuth(this.config);
    }

    return this.formAuth(this.config);
  }

  invalidate(): void {
    this.cachedCookie = undefined;
  }

  private headerAuth(config: HeaderAuthConfig): Record<string, string> {
    const value = config.value ?? (config.valueEnv ? this.env[config.valueEnv] : undefined);

    if (value === undefined || value === '') {
      throw new Error(
        `Detective auth: no value for header "${config.header}". `
        + (config.valueEnv
          ? `Set the "${config.valueEnv}" environment variable.`
          : 'Set "value" or "valueEnv" in the auth section.'),
      );
    }

    return { [config.header]: value };
  }

  private async formAuth(config: FormAuthConfig): Promise<Record<string, string>> {
    if (this.cachedCookie !== undefined) {
      return { Cookie: this.cachedCookie };
    }

    const response = await this.fetchImpl(new URL(config.url, this.appUrl).toString(), {
      method: config.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.credentials),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Detective auth: login to ${config.url} failed with status ${response.status}. `
        + 'Check the credentials in detective.local.json.',
      );
    }

    const cookie = selectCookies(readSetCookies(response.headers), config.cookieNames);

    if (cookie === '') {
      throw new Error(
        `Detective auth: login to ${config.url} returned no cookies`
        + (config.cookieNames.length > 0
          ? ` matching ${config.cookieNames.join(', ')}.`
          : '.'),
      );
    }

    this.cachedCookie = cookie;

    return { Cookie: cookie };
  }
}

function readSetCookies(headers: {
  getSetCookie?: () => string[];
  get: (name: string) => string | null;
}): string[] {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const single = headers.get('set-cookie');

  return single === null ? [] : [single];
}

function selectCookies(setCookies: string[], names: string[]): string {
  return setCookies
    .map((entry) => entry.split(';')[0]?.trim() ?? '')
    .filter((pair) => pair !== '')
    .filter((pair) => names.length === 0 || names.includes(pair.split('=')[0] ?? ''))
    .join('; ');
}
