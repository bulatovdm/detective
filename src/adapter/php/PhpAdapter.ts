import type { LanguageAdapterInterface } from '../../core/adapter/LanguageAdapterInterface.js';
import type {
  DebugSessionParams,
  DebugSessionResult,
  EvalContext,
  EvalResult,
  InspectionDescriptor,
  InspectionResult,
  ProfileParams,
  ProfileResult,
} from '../../core/adapter/types.js';
import { PathMapper } from '../../core/path/PathMapper.js';
import { withTimeout } from '../../core/util/Timeout.js';
import { Logger } from '../../core/util/Logger.js';
import { PhpDebugSession } from './PhpDebugSession.js';
import { TriggerStrategyFactory } from './trigger/TriggerStrategyFactory.js';
import type { TriggerStrategy, TriggerResult } from './trigger/TriggerStrategy.js';
import type { PhpAdapterFullConfig } from './config/PhpAdapterConfig.js';

export class PhpAdapter implements LanguageAdapterInterface {
  readonly name = 'php';

  private config: PhpAdapterFullConfig | null = null;
  private pathMapper: PathMapper | null = null;
  private readonly logger = new Logger('PhpAdapter');
  private readonly triggerFactory = new TriggerStrategyFactory();

  async initialize(rawConfig: unknown): Promise<void> {
    const config = rawConfig as PhpAdapterFullConfig;
    this.config = config;
    this.pathMapper = new PathMapper(config.pathMapping, config.projectRoot);
    this.logger.info('Initialized', {
      appUrl: config.appUrl,
      xdebugPort: config.php.xdebug.port,
      pathMappings: Object.keys(config.pathMapping).length,
    });
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down');
  }

  async executeDebugSession(params: DebugSessionParams): Promise<DebugSessionResult> {
    const { config, pathMapper } = this.getInitialized();
    const timeoutMs = (params.timeout ?? config.defaults.timeout) * 1000;

    const session = new PhpDebugSession(
      pathMapper,
      config.php.xdebug.host,
      config.php.xdebug.port,
    );

    const abortController = new AbortController();
    const triggerStrategy = this.triggerFactory.create(params, config, abortController.signal);

    try {
      await session.listen();

      const triggerPromise = this.fireTrigger(session, triggerStrategy);

      const sessionOptions = {
        breakpoints: params.breakpoints,
        expressions: params.expressions,
        maxDepth: params.maxDepth ?? config.defaults.maxDepth,
        maxChildren: config.defaults.maxChildren,
        maxDataSize: config.defaults.maxDataSize,
      };

      const debugPromise = session.waitForConnectionAndConfigure(timeoutMs, sessionOptions).then(() =>
        session.runWithBreakpoints(sessionOptions),
      );

      const debugResult = await withTimeout(debugPromise, timeoutMs);

      await session.detach();

      let triggerResult: TriggerResult = {};
      try {
        const waitMs = Math.min(timeoutMs, 10000);
        const result = await Promise.race([
          triggerPromise,
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), waitMs)),
        ]);
        if (result) triggerResult = result;
      } catch {
      }

      return {
        response: triggerResult.response,
        output: triggerResult.output,
        hits: debugResult.hits,
        errors: debugResult.errors,
        meta: debugResult.meta,
      };
    } finally {
      abortController.abort();
      await session.close();
    }
  }

  async evaluate(_expression: string, _context: EvalContext): Promise<EvalResult> {
    throw new Error('Not implemented');
  }

  async inspect(_what: string, _params?: Record<string, unknown>): Promise<InspectionResult> {
    throw new Error('Not implemented');
  }

  availableInspections(): InspectionDescriptor[] {
    return [];
  }

  async profile(_params: ProfileParams): Promise<ProfileResult> {
    throw new Error('Not implemented');
  }

  private fireTrigger(session: PhpDebugSession, strategy: TriggerStrategy): Promise<TriggerResult> {
    if (strategy.acceptBeforeTrigger) {
      session.startAccepting();
      return strategy.execute();
    }
    const promise = strategy.execute();
    session.startAccepting();
    return promise;
  }

  private getInitialized(): { config: PhpAdapterFullConfig; pathMapper: PathMapper } {
    if (!this.config || !this.pathMapper) {
      throw new Error('PhpAdapter is not initialized. Call initialize() first.');
    }
    return { config: this.config, pathMapper: this.pathMapper };
  }
}
