import { describe, it, expect } from 'vitest';
import { formatSnapshot } from '../../../src/core/snapshot/SnapshotFormatter.js';
import type { DebugSessionResult } from '../../../src/core/adapter/types.js';

describe('SnapshotFormatter', () => {
  it('formats a complete snapshot with HTTP response and breakpoint hits', () => {
    const result: DebugSessionResult = {
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"success": true}',
      },
      hits: [
        {
          file: 'app/Controllers/OrderController.php',
          line: 25,
          hitNumber: 1,
          stackTrace: [
            { level: 0, file: 'app/Controllers/OrderController.php', line: 25, function: 'store' },
          ],
          locals: {
            '$total': { type: 'int', value: 42 },
            '$name': { type: 'string', value: 'John' },
          },
        },
      ],
      errors: [],
      meta: {
        adapterName: 'php',
        debuggerVersion: '3.3.1',
        languageVersion: 'PHP',
        totalBreakpointsSet: 1,
        totalHits: 1,
        executionTimeMs: 150,
      },
    };

    const output = formatSnapshot(result);

    expect(output).toContain('200 OK');
    expect(output).toContain('content-type: application/json');
    expect(output).toContain('Hit #1');
    expect(output).toContain('$total: (int) 42');
    expect(output).toContain('$name: (string) "John"');
    expect(output).toContain('Adapter: php');
    expect(output).toContain('Hits: 1');
  });

  it('formats snapshot with no hits', () => {
    const result: DebugSessionResult = {
      response: {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        body: 'Not Found',
      },
      hits: [],
      errors: [],
      meta: {
        adapterName: 'php',
        debuggerVersion: '3.3.1',
        languageVersion: 'PHP',
        totalBreakpointsSet: 1,
        totalHits: 0,
        executionTimeMs: 50,
      },
    };

    const output = formatSnapshot(result);

    expect(output).toContain('404 Not Found');
    expect(output).toContain('No breakpoints were hit');
  });

  it('formats errors', () => {
    const result: DebugSessionResult = {
      hits: [],
      errors: [
        {
          type: 'exception',
          message: 'Division by zero',
          file: 'app/Service.php',
          line: 10,
        },
      ],
      meta: {
        adapterName: 'php',
        debuggerVersion: '3.3.1',
        languageVersion: 'PHP',
        totalBreakpointsSet: 0,
        totalHits: 0,
        executionTimeMs: 30,
      },
    };

    const output = formatSnapshot(result);

    expect(output).toContain('**exception**: Division by zero');
    expect(output).toContain('app/Service.php:10');
  });
});
