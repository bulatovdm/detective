import { z } from 'zod';
import type { ToolInterface, ToolDefinition } from './ToolInterface.js';
import type { LanguageAdapterInterface } from '../adapter/LanguageAdapterInterface.js';
import type { CliTrigger } from '../adapter/types.js';
import { formatSnapshot } from '../snapshot/SnapshotFormatter.js';
import { truncateSnapshot } from '../snapshot/SnapshotTruncator.js';
import { breakpointSchema, toBreakpointDefinitions } from './breakpointSchema.js';
import { Logger } from '../util/Logger.js';

const inputSchema = z.object({
  command: z.string().describe('CLI command to execute (e.g. "php bin/console db:find pages 1")'),
  args: z.array(z.string()).optional(),
  breakpoints: z.array(breakpointSchema).min(1),
  expressions: z.array(z.string()).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  timeout: z.number().min(1).max(120).optional(),
});

type DebugCommandInput = z.infer<typeof inputSchema>;

export class DebugCommandTool implements ToolInterface {
  private readonly logger = new Logger('DebugCommandTool');

  constructor(private readonly adapter: LanguageAdapterInterface) {}

  definition(): ToolDefinition {
    return {
      name: 'debug_command',
      description:
        'Execute a CLI command (artisan, console, any PHP script) with breakpoints set. ' +
        'Returns a snapshot with command output (stdout/stderr), breakpoint hits ' +
        '(local variables, stack trace), and evaluated expressions. ' +
        'The command is executed via the configured cli.exec template in detective.json. ' +
        'Supports line and exception breakpoints.',
      inputSchema,
    };
  }

  async execute(rawInput: unknown): Promise<string> {
    this.logger.info('Received', JSON.stringify(rawInput));
    const input = inputSchema.parse(rawInput) as DebugCommandInput;

    const trigger: CliTrigger = {
      type: 'cli',
      command: input.command,
      args: input.args,
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
