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
import { withTimeout, TimeoutError } from '../../core/util/Timeout.js';
import { Logger } from '../../core/util/Logger.js';
import { SessionLog } from '../../core/session/SessionLog.js';
import { PhpDebugSession } from './PhpDebugSession.js';
import { TriggerStrategyFactory } from './trigger/TriggerStrategyFactory.js';
import type { TriggerStrategy, TriggerResult } from './trigger/TriggerStrategy.js';
import type { PhpAdapterFullConfig } from './config/PhpAdapterConfig.js';

export class PhpAdapter implements LanguageAdapterInterface {
  readonly name = 'php';

  private config: PhpAdapterFullConfig | null = null;
  private pathMapper: PathMapper | null = null;
  private activeSession: PhpDebugSession | null = null;
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
    if (this.activeSession) {
      this.logger.info('Closing active session on shutdown');
      await this.activeSession.close().catch(() => {});
      this.activeSession = null;
    }
    this.logger.info('Shutting down');
  }

  async executeDebugSession(params: DebugSessionParams): Promise<DebugSessionResult> {
    const { config, pathMapper } = this.getInitialized();
    const timeoutMs = (params.timeout ?? config.defaults.timeout) * 1000;
    const sessionLog = new SessionLog();
    const includeLog = params.verbose ?? false;

    this.logger.debug(`executeDebugSession start (timeoutMs=${timeoutMs}, breakpoints=${params.breakpoints.length}, verbose=${includeLog})`);

    if (this.activeSession) {
      this.logger.warn('Previous session still active, force-closing');
      sessionLog.add('Force-closing previous active session');
      await this.activeSession.close().catch(() => {});
      this.activeSession = null;
    }

    const session = new PhpDebugSession(
      pathMapper,
      config.php.xdebug.host,
      config.php.xdebug.port,
      sessionLog,
    );
    this.activeSession = session;

    const abortController = new AbortController();
    const triggerStrategy = this.triggerFactory.create(params, config, abortController.signal);

    sessionLog.add(`Starting debug session (timeout: ${timeoutMs}ms, breakpoints: ${params.breakpoints.length})`);

    let sessionStage = 'waiting for Xdebug connection';

    try {
      await session.listen();
      sessionLog.add(`TCP server listening on ${config.php.xdebug.host}:${config.php.xdebug.port}`);

      const triggerPromise = this.fireTrigger(session, triggerStrategy, sessionLog);

      const sessionOptions = {
        breakpoints: params.breakpoints,
        expressions: params.expressions,
        maxDepth: params.maxDepth ?? config.defaults.maxDepth,
        maxChildren: config.defaults.maxChildren,
        maxDataSize: config.defaults.maxDataSize,
      };

      sessionLog.add('Waiting for Xdebug connection');

      const debugPromise = session.waitForConnectionAndConfigure(timeoutMs, sessionOptions).then(() => {
        sessionStage = 'running with breakpoints';
        return session.runWithBreakpoints(sessionOptions);
      });

      let debugResult;
      try {
        debugResult = await withTimeout(debugPromise, timeoutMs);
      } catch (err) {
        if (err instanceof TimeoutError) {
          sessionLog.add(`Timeout during: ${sessionStage}`);
        } else {
          sessionLog.add(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`${message}\n\nSession log:\n${sessionLog.format()}`);
      }

      sessionLog.add(`Debug session completed (hits: ${debugResult.hits.length})`);

      await session.detach();
      sessionLog.add('Detached from Xdebug');

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
        sessionLog: includeLog ? sessionLog.format() : undefined,
      };
    } finally {
      this.logger.debug('executeDebugSession finally: aborting trigger and closing session');
      abortController.abort();
      await session.close();
      this.activeSession = null;
      this.logger.debug('executeDebugSession done');
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

  private fireTrigger(session: PhpDebugSession, strategy: TriggerStrategy, sessionLog: SessionLog): Promise<TriggerResult> {
    const triggerName = strategy.constructor.name.replace('Strategy', '');
    sessionLog.add(`Firing trigger: ${triggerName}`);

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
