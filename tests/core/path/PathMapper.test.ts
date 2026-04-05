import { describe, it, expect } from 'vitest';
import { PathMapper } from '../../../src/core/path/PathMapper.js';

describe('PathMapper', () => {
  describe('identity mapping (no pathMapping)', () => {
    const mapper = new PathMapper({}, '/Users/dima/projects/myapp');

    it('isIdentity returns true', () => {
      expect(mapper.isIdentity).toBe(true);
    });

    it('toDebugger resolves relative path to absolute', () => {
      expect(mapper.toDebugger('app/Controllers/OrderController.php')).toBe(
        '/Users/dima/projects/myapp/app/Controllers/OrderController.php',
      );
    });

    it('toDebugger keeps absolute path as-is', () => {
      expect(mapper.toDebugger('/Users/dima/projects/myapp/app/Foo.php')).toBe(
        '/Users/dima/projects/myapp/app/Foo.php',
      );
    });

    it('toHost returns path unchanged', () => {
      expect(mapper.toHost('/Users/dima/projects/myapp/app/Foo.php')).toBe(
        '/Users/dima/projects/myapp/app/Foo.php',
      );
    });
  });

  describe('Docker/OrbStack mapping', () => {
    const mapper = new PathMapper(
      { '/var/www/app': '/Users/dima/projects/myapp' },
      '/Users/dima/projects/myapp',
    );

    it('isIdentity returns false', () => {
      expect(mapper.isIdentity).toBe(false);
    });

    it('toDebugger converts relative path to container path', () => {
      expect(mapper.toDebugger('app/Controllers/OrderController.php')).toBe(
        '/var/www/app/app/Controllers/OrderController.php',
      );
    });

    it('toDebugger converts absolute host path to container path', () => {
      expect(
        mapper.toDebugger('/Users/dima/projects/myapp/app/Controllers/OrderController.php'),
      ).toBe('/var/www/app/app/Controllers/OrderController.php');
    });

    it('toHost converts container path to host path', () => {
      expect(mapper.toHost('/var/www/app/app/Controllers/OrderController.php')).toBe(
        '/Users/dima/projects/myapp/app/Controllers/OrderController.php',
      );
    });

    it('toHost returns unmapped path as-is', () => {
      expect(mapper.toHost('/some/other/path/file.php')).toBe('/some/other/path/file.php');
    });
  });

  describe('toRelative', () => {
    const mapper = new PathMapper({}, '/Users/dima/projects/myapp');

    it('converts absolute host path to relative', () => {
      expect(
        mapper.toRelative('/Users/dima/projects/myapp/app/Controllers/OrderController.php'),
      ).toBe('app/Controllers/OrderController.php');
    });
  });

  describe('multiple mappings', () => {
    const mapper = new PathMapper(
      {
        '/var/www/app': '/Users/dima/projects/myapp',
        '/var/www/app/vendor': '/Users/dima/projects/myapp/vendor',
      },
      '/Users/dima/projects/myapp',
    );

    it('uses longest matching prefix for toHost', () => {
      expect(mapper.toHost('/var/www/app/vendor/autoload.php')).toBe(
        '/Users/dima/projects/myapp/vendor/autoload.php',
      );
    });
  });
});
