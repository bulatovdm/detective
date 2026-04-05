import type { TriggerStrategy, TriggerResult } from './TriggerStrategy.js';
import type { CliTrigger } from '../../../core/adapter/types.js';
import { executeCliCommand } from '../../../core/cli/CliExecutor.js';

export class CliTriggerStrategy implements TriggerStrategy {
  readonly acceptBeforeTrigger = true;

  constructor(
    private readonly trigger: CliTrigger,
    private readonly execTemplate: string,
    private readonly ideKey: string,
    private readonly timeoutMs: number,
  ) {}

  async execute(): Promise<TriggerResult> {
    const command = [this.trigger.command, ...(this.trigger.args ?? [])].join(' ');
    const env = { XDEBUG_SESSION: this.ideKey };
    const output = await executeCliCommand(this.execTemplate, command, env, this.timeoutMs);
    return { output };
  }
}
