import type { DbgpCommandBuilder } from '../dbgp/DbgpCommandBuilder.js';
import type { BreakpointStrategy } from './BreakpointStrategy.js';
import type { BreakpointHit } from '../../../core/adapter/types.js';

export class ExceptionBreakpointStrategy implements BreakpointStrategy {
  readonly consumesRun = false;
  private readonly normalizedName: string;

  constructor(exceptionName: string) {
    this.normalizedName = exceptionName.replaceAll('\\\\', '\\');
  }

  buildCommand(commandBuilder: DbgpCommandBuilder): string {
    return commandBuilder.breakpointSetException(this.normalizedName);
  }

  matches(_hit: BreakpointHit): boolean {
    return true;
  }
}
