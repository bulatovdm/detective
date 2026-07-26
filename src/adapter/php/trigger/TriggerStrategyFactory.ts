import type { DebugSessionParams, RequestTrigger, CliTrigger } from '../../../core/adapter/types.js';
import type { TriggerStrategy } from './TriggerStrategy.js';
import type { PhpAdapterFullConfig } from '../config/PhpAdapterConfig.js';
import { HttpTriggerStrategy } from './HttpTriggerStrategy.js';
import { CliTriggerStrategy } from './CliTriggerStrategy.js';
import { AuthResolver, type AuthFetch } from '../../../core/http/AuthResolver.js';

type TriggerBuilder = (params: DebugSessionParams, config: PhpAdapterFullConfig, signal?: AbortSignal) => TriggerStrategy;

export class TriggerStrategyFactory {
  private auth?: AuthResolver;

  private authResolver(config: PhpAdapterFullConfig): AuthResolver | undefined {
    if (config.auth === undefined) {
      return undefined;
    }

    this.auth ??= new AuthResolver(
      config.auth,
      config.appUrl,
      fetch as unknown as AuthFetch,
    );

    return this.auth;
  }

  private readonly builders: Record<string, TriggerBuilder> = {
    http: (params, config, signal) =>
      new HttpTriggerStrategy(
        params.trigger as RequestTrigger,
        config.appUrl,
        config.php.xdebug.ideKey,
        config.defaults.maxResponseBodyLength,
        signal,
        this.authResolver(config),
      ),
    cli: (params, config) => {
      const timeoutMs = (params.timeout ?? config.defaults.timeout) * 1000;
      return new CliTriggerStrategy(
        params.trigger as CliTrigger,
        config.php.cli.exec,
        config.php.xdebug.ideKey,
        timeoutMs,
      );
    },
  };

  create(params: DebugSessionParams, config: PhpAdapterFullConfig, signal?: AbortSignal): TriggerStrategy {
    const type = params.trigger.type;
    const builder = this.builders[type];

    if (!builder) {
      throw new Error(`Unknown trigger type: ${type}`);
    }

    return builder(params, config, signal);
  }
}
