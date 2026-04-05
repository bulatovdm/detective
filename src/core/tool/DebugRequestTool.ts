import { z } from 'zod';
import type { ToolInterface, ToolDefinition } from './ToolInterface.js';
import type { LanguageAdapterInterface } from '../adapter/LanguageAdapterInterface.js';
import type { RequestTrigger } from '../adapter/types.js';
import { formatSnapshot } from '../snapshot/SnapshotFormatter.js';
import { truncateSnapshot } from '../snapshot/SnapshotTruncator.js';
import { breakpointSchema, toBreakpointDefinitions } from './breakpointSchema.js';
import { Logger } from '../util/Logger.js';

const inputSchema = z.object({
  url: z.string().describe('URL path to request (e.g. /api/orders)'),
  method: z.string().default('GET'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  breakpoints: z.array(breakpointSchema).min(1),
  expressions: z.array(z.string()).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  timeout: z.number().min(1).max(120).optional(),
});

type DebugRequestInput = z.infer<typeof inputSchema>;

export class DebugRequestTool implements ToolInterface {
  private readonly logger = new Logger('DebugRequestTool');

  constructor(private readonly adapter: LanguageAdapterInterface) {}

  definition(): ToolDefinition {
    return {
      name: 'debug_request',
      description:
        'Execute an HTTP request to the application with breakpoints set. ' +
        'Returns a snapshot with HTTP response, breakpoint hits (local variables, stack trace), ' +
        'and evaluated expressions. Paths are relative to the project root. ' +
        'Two breakpoint types: line breakpoints {file, line} stop at specific code locations; ' +
        'exception breakpoints {type: "exception", exception: "ExceptionClass"} catch thrown exceptions ' +
        '(use "*" for all exceptions). Both types can be combined — exception breakpoints collect data ' +
        'without consuming runs, so line breakpoints still fire after exceptions.',
      inputSchema,
    };
  }

  async execute(rawInput: unknown): Promise<string> {
    this.logger.info('Received', JSON.stringify(rawInput));
    const input = inputSchema.parse(rawInput) as DebugRequestInput;

    const trigger: RequestTrigger = {
      type: 'http',
      url: input.url,
      method: input.method,
      headers: input.headers,
      body: input.body,
    };

    const result = await this.adapter.executeDebugSession({
      trigger,
      breakpoints: toBreakpointDefinitions(input.breakpoints),
      expressions: input.expressions,
      maxDepth: input.maxDepth,
      timeout: input.timeout,
    });

    const truncated = truncateSnapshot(result);
    return formatSnapshot(truncated);
  }
}
