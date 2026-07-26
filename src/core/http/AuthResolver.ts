import type {
  AuthConfig,
  AuthenticatorConfig,
  FormAuthConfig,
  HeaderAuthConfig,
} from '../config/Config.js';
import { mergeHeaders } from './RequestBuilder.js';

export interface AuthFetch {
  (url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{
    status: number;
    headers: { getSetCookie?: () => string[]; get: (name: string) => string | null };
  }>;
}

export class AuthResolver {
  private readonly cachedCookies = new Map<string, string>();

  constructor(
    private readonly config: AuthConfig | undefined,
    private readonly appUrl: string,
    private readonly fetchImpl: AuthFetch,
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  async headers(): Promise<Record<string, string>> {
    let headers: Record<string, string> = {};

    for (const authenticator of this.authenticators()) {
      headers = mergeHeaders(
        headers,
        authenticator.type === 'header'
          ? this.headerAuth(authenticator)
          : await this.formAuth(authenticator),
      );
    }

    return headers;
  }

  invalidate(): void {
    this.cachedCookies.clear();
  }

  private authenticators(): AuthenticatorConfig[] {
    if (this.config === undefined) {
      return [];
    }

    return Array.isArray(this.config) ? this.config : [this.config];
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
    const cached = this.cachedCookies.get(config.url);

    if (cached !== undefined) {
      return { Cookie: cached };
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

    this.cachedCookies.set(config.url, cookie);

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
