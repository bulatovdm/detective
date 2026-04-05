import { describe, it, expect } from 'vitest';
import { parseConfig } from '../../../src/core/config/ConfigLoader.js';

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
