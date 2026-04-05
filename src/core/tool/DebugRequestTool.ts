import { z } from 'zod';
import type { ToolInterface, ToolDefinition } from './ToolInterface.js';
import type { LanguageAdapterInterface } from '../adapter/LanguageAdapterInterface.js';
import type { BreakpointDefinition, RequestTrigger } from '../adapter/types.js';
import { formatSnapshot } from '../snapshot/SnapshotFormatter.js';

const breakpointSchema = z.object({
  file: z.string().describe('File path relative to project root'),
  line: z.number().int().positive(),
  condition: z.string().optional(),
});

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
  constructor(private readonly adapter: LanguageAdapterInterface) {}

  definition(): ToolDefinition {
    return {
      name: 'debug_request',
      description:
        'Execute an HTTP request to the application with breakpoints set. ' +
        'Returns a snapshot with HTTP response, breakpoint hits (local variables, stack trace), ' +
        'and evaluated expressions. Paths are relative to the project root.',
      inputSchema,
    };
  }

  async execute(rawInput: unknown): Promise<string> {
    const input = inputSchema.parse(rawInput) as DebugRequestInput;

    const trigger: RequestTrigger = {
      type: 'http',
      url: input.url,
      method: input.method,
      headers: input.headers,
      body: input.body,
    };

    const breakpoints: BreakpointDefinition[] = input.breakpoints.map((bp) => ({
      file: bp.file,
      line: bp.line,
      condition: bp.condition,
    }));

    const result = await this.adapter.executeDebugSession({
      trigger,
      breakpoints,
      expressions: input.expressions,
      maxDepth: input.maxDepth,
      timeout: input.timeout,
    });

    return formatSnapshot(result);
  }
}
