import type { TriggerStrategy, TriggerResult } from './TriggerStrategy.js';
import type { RequestTrigger } from '../../../core/adapter/types.js';
import { buildRequest } from '../../../core/http/RequestBuilder.js';
import { executeRequest } from '../../../core/http/RequestExecutor.js';

export class HttpTriggerStrategy implements TriggerStrategy {
  readonly acceptBeforeTrigger = false;

  constructor(
    private readonly trigger: RequestTrigger,
    private readonly appUrl: string,
    private readonly ideKey: string,
    private readonly maxResponseBodyLength: number,
    private readonly signal?: AbortSignal,
  ) {}

  async execute(): Promise<TriggerResult> {
    const request = buildRequest(this.trigger, this.appUrl, this.ideKey);
    const response = await executeRequest(request, this.maxResponseBodyLength, this.signal);
    return { response };
  }
}
