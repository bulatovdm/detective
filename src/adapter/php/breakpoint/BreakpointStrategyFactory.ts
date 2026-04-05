import type { BreakpointDefinition, LineBreakpoint, ExceptionBreakpoint } from '../../../core/adapter/types.js';
import type { BreakpointStrategy } from './BreakpointStrategy.js';
import type { PathMapper } from '../../../core/path/PathMapper.js';
import { LineBreakpointStrategy } from './LineBreakpointStrategy.js';
import { ExceptionBreakpointStrategy } from './ExceptionBreakpointStrategy.js';

type StrategyBuilder = (definition: BreakpointDefinition) => BreakpointStrategy;

export class BreakpointStrategyFactory {
  private readonly builders: Record<string, StrategyBuilder>;

  constructor(pathMapper: PathMapper) {
    this.builders = {
      line: (def) => {
        const bp = def as LineBreakpoint;
        return new LineBreakpointStrategy(bp.file, bp.line, bp.condition, pathMapper);
      },
      exception: (def) => {
        const bp = def as ExceptionBreakpoint;
        return new ExceptionBreakpointStrategy(bp.exception);
      },
    };
  }

  create(definition: BreakpointDefinition): BreakpointStrategy {
    const type = definition.type ?? 'line';
    const builder = this.builders[type];

    if (!builder) {
      throw new Error(`Unknown breakpoint type: ${type}`);
    }

    return builder(definition);
  }
}
