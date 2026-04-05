import { describe, it, expect } from 'vitest';
import { truncateSnapshot } from '../../../src/core/snapshot/SnapshotTruncator.js';
import type { DebugSessionResult, VariableValue } from '../../../src/core/adapter/types.js';

function makeResult(locals: Record<string, VariableValue>): DebugSessionResult {
  return {
    hits: [{
      file: 'test.php',
      line: 1,
      hitNumber: 1,
      stackTrace: Array.from({ length: 30 }, (_, i) => ({
        level: i,
        file: `frame${i}.php`,
        line: i + 1,
        function: `fn${i}`,
      })),
      locals,
    }],
    errors: [],
    meta: {
      adapterName: 'php',
      debuggerVersion: '3.2.0',
      languageVersion: 'PHP',
      totalBreakpointsSet: 1,
      totalHits: 1,
      executionTimeMs: 10,
    },
  };
}

describe('SnapshotTruncator', () => {
  it('limits stack trace frames', () => {
    const result = makeResult({});
    const truncated = truncateSnapshot(result);
    expect(truncated.hits[0]!.stackTrace.length).toBe(15);
  });

  it('limits number of local variables', () => {
    const locals: Record<string, VariableValue> = {};
    for (let i = 0; i < 50; i++) {
      locals[`$var${i}`] = { type: 'int', value: i };
    }
    const result = makeResult(locals);
    const truncated = truncateSnapshot(result, { maxLocals: 10 });
    const keys = Object.keys(truncated.hits[0]!.locals);
    expect(keys.length).toBe(11);
    expect(keys[10]).toContain('... +40 more');
  });

  it('truncates long strings', () => {
    const longString = 'x'.repeat(1000);
    const result = makeResult({
      '$text': { type: 'string', value: longString },
    });
    const truncated = truncateSnapshot(result, { maxStringLength: 100 });
    const val = truncated.hits[0]!.locals['$text']!;
    expect((val.value as string).length).toBe(100);
    expect(val.truncated).toBe(true);
  });

  it('truncates deep nesting', () => {
    const deep: VariableValue = {
      type: 'object',
      value: 'Obj',
      className: 'MyClass',
      children: {
        level1: {
          type: 'object',
          value: 'Obj',
          children: {
            level2: {
              type: 'object',
              value: 'Obj',
              children: {
                level3: {
                  type: 'object',
                  value: 'Obj',
                  children: {
                    level4: { type: 'string', value: 'too deep' },
                  },
                },
              },
            },
          },
        },
      },
    };
    const result = makeResult({ '$obj': deep });
    const truncated = truncateSnapshot(result, { maxDepth: 2 });
    const obj = truncated.hits[0]!.locals['$obj']!;
    const level1 = obj.children!['level1']!;
    const level2 = level1.children!['level2']!;
    expect(level2.truncated).toBe(true);
    expect(level2.children).toBeUndefined();
  });

  it('truncates DI container noise', () => {
    const result = makeResult({
      '$container': {
        type: 'object',
        value: 'DI\\Container',
        className: 'DI\\Container',
        children: {
          resolvedEntries: { type: 'array', value: 'array', children: {} },
        },
      },
    });
    const truncated = truncateSnapshot(result);
    const container = truncated.hits[0]!.locals['$container']!;
    expect(container.truncated).toBe(true);
    expect(container.children).toBeUndefined();
  });

  it('collapses objects with 50+ children as large objects', () => {
    const children: Record<string, VariableValue> = {};
    for (let i = 0; i < 60; i++) {
      children[`prop${i}`] = { type: 'string', value: `val${i}` };
    }
    const result = makeResult({
      '$big': {
        type: 'object',
        value: 'SomeHugeClass',
        className: 'SomeHugeClass',
        children,
      },
    });
    const truncated = truncateSnapshot(result);
    const big = truncated.hits[0]!.locals['$big']!;
    expect(big.truncated).toBe(true);
    expect(big.children).toBeUndefined();
    expect(big.value).toBe('SomeHugeClass');
  });

  it('limits children count', () => {
    const children: Record<string, VariableValue> = {};
    for (let i = 0; i < 50; i++) {
      children[`key${i}`] = { type: 'string', value: `val${i}` };
    }
    const result = makeResult({
      '$arr': { type: 'array', value: 'array', children },
    });
    const truncated = truncateSnapshot(result, { maxChildren: 5 });
    const arr = truncated.hits[0]!.locals['$arr']!;
    const keys = Object.keys(arr.children!);
    expect(keys.length).toBe(6);
    expect(keys[5]).toContain('... +45 more');
  });

  it('preserves scalar values unchanged', () => {
    const result = makeResult({
      '$int': { type: 'int', value: 42 },
      '$bool': { type: 'bool', value: true },
      '$null': { type: 'null', value: null },
      '$str': { type: 'string', value: 'short' },
    });
    const truncated = truncateSnapshot(result);
    const locals = truncated.hits[0]!.locals;
    expect(locals['$int']!.value).toBe(42);
    expect(locals['$bool']!.value).toBe(true);
    expect(locals['$null']!.value).toBeNull();
    expect(locals['$str']!.value).toBe('short');
  });

  it('limits number of hits', () => {
    const result: DebugSessionResult = {
      hits: Array.from({ length: 20 }, (_, i) => ({
        file: 'test.php',
        line: i,
        hitNumber: i + 1,
        stackTrace: [],
        locals: {},
      })),
      errors: [],
      meta: {
        adapterName: 'php',
        debuggerVersion: '3.2.0',
        languageVersion: 'PHP',
        totalBreakpointsSet: 1,
        totalHits: 20,
        executionTimeMs: 10,
      },
    };
    const truncated = truncateSnapshot(result, { maxHits: 3 });
    expect(truncated.hits.length).toBe(3);
  });
});
