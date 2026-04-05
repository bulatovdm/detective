import type { HttpResponse, CommandOutput } from '../../../core/adapter/types.js';

export interface TriggerResult {
  response?: HttpResponse;
  output?: CommandOutput;
}

export interface TriggerStrategy {
  readonly acceptBeforeTrigger: boolean;
  execute(): Promise<TriggerResult>;
}
