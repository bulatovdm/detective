import type { DbgpCommandBuilder } from '../dbgp/DbgpCommandBuilder.js';
import type { BreakpointHit } from '../../../core/adapter/types.js';

export interface BreakpointStrategy {
  buildCommand(commandBuilder: DbgpCommandBuilder): string;
  readonly consumesRun: boolean;
  matches(hit: BreakpointHit): boolean;
}
