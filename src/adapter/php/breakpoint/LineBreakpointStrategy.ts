import type { DbgpCommandBuilder } from '../dbgp/DbgpCommandBuilder.js';
import type { BreakpointStrategy } from './BreakpointStrategy.js';
import type { BreakpointHit } from '../../../core/adapter/types.js';
import type { PathMapper } from '../../../core/path/PathMapper.js';

export class LineBreakpointStrategy implements BreakpointStrategy {
  readonly consumesRun = true;

  constructor(
    private readonly file: string,
    private readonly line: number,
    private readonly condition: string | undefined,
    private readonly pathMapper: PathMapper,
  ) {}

  buildCommand(commandBuilder: DbgpCommandBuilder): string {
    const fileUri = `file://${this.pathMapper.toDebugger(this.file)}`;
    return commandBuilder.breakpointSet(fileUri, this.line, this.condition);
  }

  matches(hit: BreakpointHit): boolean {
    return hit.file === this.file && hit.line === this.line;
  }
}
