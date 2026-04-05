import { describe, it, expect } from 'vitest';
import { DbgpCommandBuilder } from '../../../../src/adapter/php/dbgp/DbgpCommandBuilder.js';

describe('DbgpCommandBuilder', () => {
  it('builds breakpoint_set line command', () => {
    const builder = new DbgpCommandBuilder();
    const cmd = builder.breakpointSet('file:///app/Foo.php', 10);
    expect(cmd).toBe('breakpoint_set -i 1 -t line -f file:///app/Foo.php -n 10');
  });

  it('builds breakpoint_set line command with condition', () => {
    const builder = new DbgpCommandBuilder();
    const cmd = builder.breakpointSet('file:///app/Foo.php', 10, '$x > 5');
    expect(cmd).toContain('-t line');
    expect(cmd).toContain('-- ' + Buffer.from('$x > 5').toString('base64'));
  });

  it('builds breakpoint_set exception command', () => {
    const builder = new DbgpCommandBuilder();
    const cmd = builder.breakpointSetException('RuntimeException');
    expect(cmd).toBe('breakpoint_set -i 1 -t exception -x RuntimeException');
  });

  it('builds breakpoint_set exception command with namespace', () => {
    const builder = new DbgpCommandBuilder();
    const cmd = builder.breakpointSetException('App\\Exceptions\\NotFoundException');
    expect(cmd).toBe('breakpoint_set -i 1 -t exception -x App\\Exceptions\\NotFoundException');
  });

  it('builds run command', () => {
    const builder = new DbgpCommandBuilder();
    expect(builder.run()).toBe('run -i 1');
  });

  it('builds stop command', () => {
    const builder = new DbgpCommandBuilder();
    expect(builder.stop()).toBe('stop -i 1');
  });

  it('builds detach command', () => {
    const builder = new DbgpCommandBuilder();
    expect(builder.detach()).toBe('detach -i 1');
  });

  it('increments transaction id across commands', () => {
    const builder = new DbgpCommandBuilder();
    expect(builder.run()).toContain('-i 1');
    expect(builder.run()).toContain('-i 2');
    expect(builder.stop()).toContain('-i 3');
    expect(builder.detach()).toContain('-i 4');
  });

  it('builds stack_get command', () => {
    const builder = new DbgpCommandBuilder();
    expect(builder.stackGet()).toBe('stack_get -i 1');
  });

  it('builds context_get command', () => {
    const builder = new DbgpCommandBuilder();
    expect(builder.contextGet(0, 0)).toBe('context_get -i 1 -d 0 -c 0');
  });

  it('builds eval command with base64 encoding', () => {
    const builder = new DbgpCommandBuilder();
    const cmd = builder.eval('$foo->bar()');
    const encoded = Buffer.from('$foo->bar()').toString('base64');
    expect(cmd).toBe(`eval -i 1 -- ${encoded}`);
  });

  it('builds feature_set command', () => {
    const builder = new DbgpCommandBuilder();
    expect(builder.featureSet('max_depth', '3')).toBe('feature_set -i 1 -n max_depth -v 3');
  });
});
