import { describe, it, expect } from 'vitest';
import { BreakpointStrategyFactory } from '../../../../src/adapter/php/breakpoint/BreakpointStrategyFactory.js';
import { LineBreakpointStrategy } from '../../../../src/adapter/php/breakpoint/LineBreakpointStrategy.js';
import { ExceptionBreakpointStrategy } from '../../../../src/adapter/php/breakpoint/ExceptionBreakpointStrategy.js';
import { PathMapper } from '../../../../src/core/path/PathMapper.js';

describe('BreakpointStrategyFactory', () => {
  const pathMapper = new PathMapper({}, '/projects/myapp');
  const factory = new BreakpointStrategyFactory(pathMapper);

  it('creates LineBreakpointStrategy for explicit line type', () => {
    const strategy = factory.create({ type: 'line', file: 'app/Foo.php', line: 10 });
    expect(strategy).toBeInstanceOf(LineBreakpointStrategy);
    expect(strategy.consumesRun).toBe(true);
  });

  it('creates LineBreakpointStrategy when type is omitted', () => {
    const strategy = factory.create({ file: 'app/Foo.php', line: 10 });
    expect(strategy).toBeInstanceOf(LineBreakpointStrategy);
  });

  it('creates ExceptionBreakpointStrategy for exception type', () => {
    const strategy = factory.create({ type: 'exception', exception: '*' });
    expect(strategy).toBeInstanceOf(ExceptionBreakpointStrategy);
    expect(strategy.consumesRun).toBe(false);
  });

  it('throws on unknown breakpoint type', () => {
    expect(() => factory.create({ type: 'unknown' as never })).toThrow('Unknown breakpoint type');
  });
});

describe('LineBreakpointStrategy', () => {
  const pathMapper = new PathMapper({}, '/projects/myapp');

  it('matches hit with same file and line', () => {
    const strategy = new LineBreakpointStrategy('app/Foo.php', 10, undefined, pathMapper);
    const hit = { file: 'app/Foo.php', line: 10, hitNumber: 1, stackTrace: [], locals: {} };
    expect(strategy.matches(hit)).toBe(true);
  });

  it('does not match hit with different line', () => {
    const strategy = new LineBreakpointStrategy('app/Foo.php', 10, undefined, pathMapper);
    const hit = { file: 'app/Foo.php', line: 20, hitNumber: 1, stackTrace: [], locals: {} };
    expect(strategy.matches(hit)).toBe(false);
  });

  it('does not match hit with different file', () => {
    const strategy = new LineBreakpointStrategy('app/Foo.php', 10, undefined, pathMapper);
    const hit = { file: 'app/Bar.php', line: 10, hitNumber: 1, stackTrace: [], locals: {} };
    expect(strategy.matches(hit)).toBe(false);
  });

  it('builds correct DBGp command', () => {
    const strategy = new LineBreakpointStrategy('app/Foo.php', 10, undefined, pathMapper);
    const mockBuilder = {
      breakpointSet: (fileUri: string, line: number) => `breakpoint_set -f ${fileUri} -n ${line}`,
    };
    const cmd = strategy.buildCommand(mockBuilder as never);
    expect(cmd).toContain('breakpoint_set');
    expect(cmd).toContain('/projects/myapp/app/Foo.php');
    expect(cmd).toContain('-n 10');
  });

  it('builds command with condition', () => {
    const strategy = new LineBreakpointStrategy('app/Foo.php', 10, '$x > 5', pathMapper);
    const mockBuilder = {
      breakpointSet: (fileUri: string, line: number, condition?: string) =>
        `breakpoint_set -f ${fileUri} -n ${line}${condition ? ` -- ${condition}` : ''}`,
    };
    const cmd = strategy.buildCommand(mockBuilder as never);
    expect(cmd).toContain('$x > 5');
  });
});

describe('ExceptionBreakpointStrategy', () => {
  it('always matches any hit', () => {
    const strategy = new ExceptionBreakpointStrategy('*');
    const hit = { file: 'any.php', line: 1, hitNumber: 1, stackTrace: [], locals: {} };
    expect(strategy.matches(hit)).toBe(true);
  });

  it('builds correct DBGp command', () => {
    const strategy = new ExceptionBreakpointStrategy('RuntimeException');
    const mockBuilder = {
      breakpointSetException: (name: string) => `breakpoint_set -t exception -x ${name}`,
    };
    const cmd = strategy.buildCommand(mockBuilder as never);
    expect(cmd).toBe('breakpoint_set -t exception -x RuntimeException');
  });

  it('normalizes double-escaped backslashes in exception name', () => {
    const strategy = new ExceptionBreakpointStrategy('App\\\\Containers\\\\PageContainer\\\\Exceptions\\\\NotFoundException');
    const mockBuilder = {
      breakpointSetException: (name: string) => name,
    };
    const result = strategy.buildCommand(mockBuilder as never);
    expect(result).toBe('App\\Containers\\PageContainer\\Exceptions\\NotFoundException');
  });
});
