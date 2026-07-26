import type { TriggerStrategy, TriggerResult } from './TriggerStrategy.js';
import type { RequestTrigger } from '../../../core/adapter/types.js';
import { buildRequest, mergeHeaders } from '../../../core/http/RequestBuilder.js';
import { executeRequest } from '../../../core/http/RequestExecutor.js';
import type { AuthResolver } from '../../../core/http/AuthResolver.js';

export class HttpTriggerStrategy implements TriggerStrategy {
  readonly acceptBeforeTrigger = false;

  constructor(
    private readonly trigger: RequestTrigger,
    private readonly appUrl: string,
    private readonly ideKey: string,
    private readonly maxResponseBodyLength: number,
    private readonly signal?: AbortSignal,
    private readonly auth?: AuthResolver,
  ) {}

  async execute(): Promise<TriggerResult> {
    const request = buildRequest(
      await this.withAuthHeaders(),
      this.appUrl,
      this.ideKey,
    );

    const response = await executeRequest(request, this.maxResponseBodyLength, this.signal);

    return { response };
  }

  private async withAuthHeaders(): Promise<RequestTrigger> {
    if (this.auth === undefined) {
      return this.trigger;
    }

    return {
      ...this.trigger,
      headers: mergeHeaders(await this.auth.headers(), this.trigger.headers),
    };
  }
}
