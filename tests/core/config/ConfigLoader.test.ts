import { describe, it, expect } from 'vitest';
import { parseConfig, mergeConfigLayers } from '../../../src/core/config/ConfigLoader.js';

describe('ConfigLoader', () => {
  it('parses minimal config with defaults', () => {
    const config = parseConfig({
      app: { url: 'http://localhost:8000' },
    });

    expect(config.adapter).toBe('php');
    expect(config.app.url).toBe('http://localhost:8000');
    expect(config.php.xdebug.host).toBe('127.0.0.1');
    expect(config.php.xdebug.port).toBe(9003);
    expect(config.php.xdebug.ideKey).toBe('detective');
    expect(config.defaults.maxDepth).toBe(3);
    expect(config.defaults.timeout).toBe(30);
    expect(config.pathMapping).toEqual({});
  });

  it('parses full config with overrides', () => {
    const config = parseConfig({
      adapter: 'php',
      app: {
        url: 'http://myapp.orb.local',
        basePath: '/var/www/app',
      },
      php: {
        xdebug: {
          host: '0.0.0.0',
          port: 9004,
          ideKey: 'mykey',
        },
        binary: '/usr/bin/php',
        artisanPath: '/var/www/app/artisan',
      },
      pathMapping: {
        '/var/www/app': '/Users/dima/projects/myapp',
      },
      defaults: {
        maxDepth: 5,
        timeout: 60,
        maxDataSize: 131072,
        maxChildren: 256,
        maxResponseBodyLength: 20000,
      },
    });

    expect(config.php.xdebug.host).toBe('0.0.0.0');
    expect(config.php.xdebug.port).toBe(9004);
    expect(config.pathMapping['/var/www/app']).toBe('/Users/dima/projects/myapp');
    expect(config.defaults.maxDepth).toBe(5);
  });

  it('throws on invalid config', () => {
    expect(() => parseConfig({} as never)).toThrow();
  });
});

describe('ConfigLoader auth', () => {
  it('accepts a form auth section', () => {
    const config = parseConfig({
      app: { url: 'http://localhost:8000' },
      auth: {
        type: 'form',
        url: '/api/login',
        credentials: { login: 'user', password: 'secret' },
        cookieNames: ['session'],
      },
    });

    expect(config.auth?.type).toBe('form');
  });

  it('accepts a header auth section', () => {
    const config = parseConfig({
      app: { url: 'http://localhost:8000' },
      auth: {
        type: 'header',
        header: 'X-Auth-Token',
        valueEnv: 'DETECTIVE_TOKEN',
      },
    });

    expect(config.auth?.type).toBe('header');
  });

  it('leaves auth undefined when the section is absent', () => {
    const config = parseConfig({
      app: { url: 'http://localhost:8000' },
    });

    expect(config.auth).toBeUndefined();
  });
});

describe('mergeConfigLayers', () => {
  it('overlays local values onto the base config', () => {
    const merged = mergeConfigLayers(
      { app: { url: 'http://localhost:8000' }, php: { binary: 'php' } },
      { auth: { type: 'form', url: '/api/login', credentials: { login: 'u', password: 'p' } } },
    );

    expect(merged).toMatchObject({
      app: { url: 'http://localhost:8000' },
      php: { binary: 'php' },
      auth: { type: 'form' },
    });
  });

  it('merges nested objects instead of replacing them wholesale', () => {
    const merged = mergeConfigLayers(
      { app: { url: 'http://localhost:8000', basePath: '/srv' } },
      { app: { url: 'https://app.local' } },
    ) as { app: Record<string, unknown> };

    expect(merged.app.url).toBe('https://app.local');
    expect(merged.app.basePath).toBe('/srv');
  });

  it('returns the base config when there is no local layer', () => {
    const merged = mergeConfigLayers({ app: { url: 'http://localhost:8000' } }, undefined);

    expect(merged).toEqual({ app: { url: 'http://localhost:8000' } });
  });
});

describe('ConfigLoader auth list', () => {
  it('accepts a list of authenticators', () => {
    const config = parseConfig({
      app: { url: 'http://localhost:8000' },
      auth: [
        { type: 'header', header: 'Authorization', valueEnv: 'BASIC_AUTH' },
        { type: 'form', url: '/api/login', credentials: { login: 'u', password: 'p' } },
      ],
    });

    expect(Array.isArray(config.auth)).toBe(true);
    expect(config.auth).toHaveLength(2);
  });

  it('still accepts a single authenticator object', () => {
    const config = parseConfig({
      app: { url: 'http://localhost:8000' },
      auth: { type: 'header', header: 'X-Auth-Token', value: 'k' },
    });

    expect(Array.isArray(config.auth)).toBe(false);
  });
});
