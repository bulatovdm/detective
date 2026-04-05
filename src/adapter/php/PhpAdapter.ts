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
  RequestTrigger,
} from '../../core/adapter/types.js';
import { PathMapper } from '../../core/path/PathMapper.js';
import { buildRequest } from '../../core/http/RequestBuilder.js';
import { executeRequest } from '../../core/http/RequestExecutor.js';
import { withTimeout } from '../../core/util/Timeout.js';
import { Logger } from '../../core/util/Logger.js';
import { PhpDebugSession } from './PhpDebugSession.js';
import type { PhpAdapterFullConfig } from './config/PhpAdapterConfig.js';

export class PhpAdapter implements LanguageAdapterInterface {
  readonly name = 'php';

  private config: PhpAdapterFullConfig | null = null;
  private pathMapper: PathMapper | null = null;
  private readonly logger = new Logger('PhpAdapter');

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

    try {
      await session.listen();

      const httpPromise = this.executeTrigger(params.trigger, abortController.signal);

      session.startAccepting();

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

      let httpResult;
      try {
        const httpWaitMs = Math.min(timeoutMs, 10000);
        httpResult = await Promise.race([
          httpPromise,
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), httpWaitMs)),
        ]);
      } catch {
      }

      return {
        response: params.trigger.type === 'http' ? httpResult : undefined,
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
    throw new Error('eval is not implemented in Phase 1');
  }

  async inspect(_what: string, _params?: Record<string, unknown>): Promise<InspectionResult> {
    throw new Error('inspect is not implemented in Phase 1');
  }

  availableInspections(): InspectionDescriptor[] {
    return [];
  }

  async profile(_params: ProfileParams): Promise<ProfileResult> {
    throw new Error('profile is not implemented in Phase 1');
  }

  private executeTrigger(trigger: DebugSessionParams['trigger'], signal?: AbortSignal) {
    const { config } = this.getInitialized();

    if (trigger.type === 'http') {
      const request = buildRequest(
        trigger as RequestTrigger,
        config.appUrl,
        config.php.xdebug.ideKey,
      );
      return executeRequest(request, config.defaults.maxResponseBodyLength, signal);
    }

    throw new Error('CLI trigger is not implemented in Phase 1');
  }

  private getInitialized(): { config: PhpAdapterFullConfig; pathMapper: PathMapper } {
    if (!this.config || !this.pathMapper) {
      throw new Error('PhpAdapter is not initialized. Call initialize() first.');
    }
    return { config: this.config, pathMapper: this.pathMapper };
  }
}
