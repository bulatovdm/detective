import { describe, it, expect, vi } from 'vitest';
import { AuthResolver, type AuthFetch } from '../../../src/core/http/AuthResolver.js';
import type { AuthConfig } from '../../../src/core/config/Config.js';

const loginResponse = (cookies: string[], status = 200) => ({
  status,
  headers: {
    getSetCookie: () => cookies,
    get: () => cookies[0] ?? null,
  },
});

const formConfig: AuthConfig = {
  type: 'form',
  url: '/api/login',
  method: 'POST',
  credentials: { login: 'user', password: 'secret' },
  cookieNames: ['session'],
};

describe('AuthResolver', () => {
  it('returns no headers when auth is not configured', async () => {
    const resolver = new AuthResolver(undefined, 'http://app.test', vi.fn() as unknown as AuthFetch);

    expect(await resolver.headers()).toEqual({});
  });

  it('logs in and returns the session cookie', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      loginResponse(['session=abc123; Path=/; HttpOnly']),
    ) as unknown as AuthFetch;

    const resolver = new AuthResolver(formConfig, 'http://app.test', fetchImpl);

    expect(await resolver.headers()).toEqual({ Cookie: 'session=abc123' });
  });

  it('caches the cookie so repeated calls do not log in again', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(loginResponse(['session=abc123']));
    const resolver = new AuthResolver(formConfig, 'http://app.test', fetchImpl as unknown as AuthFetch);

    await resolver.headers();
    await resolver.headers();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('logs in again after the cache is invalidated', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(loginResponse(['session=abc123']));
    const resolver = new AuthResolver(formConfig, 'http://app.test', fetchImpl as unknown as AuthFetch);

    await resolver.headers();
    resolver.invalidate();
    await resolver.headers();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps only the cookies listed in cookieNames', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      loginResponse(['session=abc123; Path=/', 'tracking=xyz; Path=/']),
    ) as unknown as AuthFetch;

    const resolver = new AuthResolver(formConfig, 'http://app.test', fetchImpl);

    expect(await resolver.headers()).toEqual({ Cookie: 'session=abc123' });
  });

  it('reports a failed login with its status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(loginResponse([], 401)) as unknown as AuthFetch;
    const resolver = new AuthResolver(formConfig, 'http://app.test', fetchImpl);

    await expect(resolver.headers()).rejects.toThrow(/status 401/);
  });

  it('reports when a successful login returned no matching cookie', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      loginResponse(['other=1']),
    ) as unknown as AuthFetch;

    const resolver = new AuthResolver(formConfig, 'http://app.test', fetchImpl);

    await expect(resolver.headers()).rejects.toThrow(/no cookies/);
  });

  it('reads a header token from the environment', async () => {
    const resolver = new AuthResolver(
      { type: 'header', header: 'X-Auth-Token', valueEnv: 'TOKEN' },
      'http://app.test',
      vi.fn() as unknown as AuthFetch,
      { TOKEN: 'secret-key' },
    );

    expect(await resolver.headers()).toEqual({ 'X-Auth-Token': 'secret-key' });
  });

  it('names the missing environment variable in the error', async () => {
    const resolver = new AuthResolver(
      { type: 'header', header: 'X-Auth-Token', valueEnv: 'TOKEN' },
      'http://app.test',
      vi.fn() as unknown as AuthFetch,
      {},
    );

    await expect(resolver.headers()).rejects.toThrow(/TOKEN/);
  });
});
