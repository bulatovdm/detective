import { DbgpConnection } from './dbgp/DbgpConnection.js';
import { DbgpCommandBuilder } from './dbgp/DbgpCommandBuilder.js';
import {
  parseBreakpointResponse,
  parseStackFrames,
  parseProperties,
} from './dbgp/DbgpResponseParser.js';
import { DBGP_STATUS, type DbgpInitPacket, type DbgpProperty } from './dbgp/DbgpProtocol.js';
import { PathMapper } from '../../core/path/PathMapper.js';
import { Logger } from '../../core/util/Logger.js';
import { SessionLog } from '../../core/session/SessionLog.js';
import { BreakpointStrategyFactory } from './breakpoint/BreakpointStrategyFactory.js';
import type { BreakpointStrategy } from './breakpoint/BreakpointStrategy.js';
import type {
  BreakpointDefinition,
  BreakpointHit,
  StackFrame,
  VariableValue,
  ErrorInfo,
  SessionMeta,
} from '../../core/adapter/types.js';

export interface DebugSessionOptions {
  breakpoints: BreakpointDefinition[];
  expressions?: string[];
  maxDepth: number;
  maxChildren: number;
  maxDataSize: number;
}

export interface DebugSessionResultData {
  hits: BreakpointHit[];
  errors: ErrorInfo[];
  meta: SessionMeta;
}

const LOCAL_CONTEXT_ID = 0;
const MAX_NON_CONSUMING_HITS = 10;

export class PhpDebugSession {
  private readonly connection: DbgpConnection;
  private readonly commandBuilder = new DbgpCommandBuilder();
  private readonly logger = new Logger('PhpDebugSession');
  private readonly strategyFactory: BreakpointStrategyFactory;
  private initPacket: DbgpInitPacket | null = null;

  constructor(
    private readonly pathMapper: PathMapper,
    private readonly host: string,
    private readonly port: number,
    private readonly sessionLog: SessionLog,
  ) {
    this.connection = new DbgpConnection();
    this.strategyFactory = new BreakpointStrategyFactory(pathMapper);
  }

  async listen(): Promise<void> {
    await this.connection.listen(this.host, this.port);
  }

  startAccepting(): void {
    this.connection.startAccepting();
  }

  async waitForConnectionAndConfigure(timeoutMs: number, options: DebugSessionOptions): Promise<void> {
    this.initPacket = await this.connection.waitForConnection(timeoutMs);
    this.sessionLog.add('Xdebug connected');
    await this.configureFeatures(options);
    this.sessionLog.add('Session configured');
  }

  async runWithBreakpoints(options: DebugSessionOptions): Promise<DebugSessionResultData> {
    const startTime = Date.now();
    const hits: BreakpointHit[] = [];
    const errors: ErrorInfo[] = [];

    try {
      const strategies = options.breakpoints.map((bp) => this.strategyFactory.create(bp));
      await this.installBreakpoints(strategies);

      const consumingRunsTotal = strategies.filter((s) => s.consumesRun).length;
      const maxRuns = Math.max(consumingRunsTotal, 1);
      let consumingHits = 0;
      let nonConsumingHits = 0;
      let hitNumber = 0;

      this.sessionLog.add('Running to breakpoints');

      while (consumingHits < maxRuns && nonConsumingHits < MAX_NON_CONSUMING_HITS) {
        const runResponse = await this.connection.sendCommand(this.commandBuilder.run());

        if (runResponse.status !== DBGP_STATUS.BREAK) {
          this.sessionLog.add(`Run finished without break (status: ${runResponse.status})`);
          break;
        }

        hitNumber++;
        const hit = await this.collectBreakpointData(hitNumber, options.expressions);
        hits.push(hit);
        this.sessionLog.add(`Breakpoint hit #${hitNumber} at ${hit.file}:${hit.line}`);

        const hitStrategy = this.matchStrategy(hit, strategies);
        if (hitStrategy?.consumesRun) {
          consumingHits++;
        } else {
          nonConsumingHits++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ type: 'error', message });
    }

    const meta: SessionMeta = {
      adapterName: 'php',
      debuggerVersion: this.initPacket?.engineVersion ?? 'unknown',
      languageVersion: this.initPacket?.language ?? 'PHP',
      totalBreakpointsSet: options.breakpoints.length,
      totalHits: hits.length,
      executionTimeMs: Date.now() - startTime,
    };

    return { hits, errors, meta };
  }

  async detach(): Promise<void> {
    try {
      if (this.connection.isConnected) {
        await this.connection.sendCommand(this.commandBuilder.detach());
      }
    } catch (err) {
      this.logger.warn('Error during session detach', err instanceof Error ? err.message : err);
    }
  }

  async close(): Promise<void> {
    try {
      if (this.connection.isConnected) {
        await this.connection.sendCommand(this.commandBuilder.stop());
      }
    } catch {
    } finally {
      await this.connection.close();
    }
  }

  private async installBreakpoints(strategies: BreakpointStrategy[]): Promise<void> {
    for (const strategy of strategies) {
      const cmd = strategy.buildCommand(this.commandBuilder);
      this.logger.info(`Breakpoint: ${cmd}`);
      const response = await this.connection.sendCommand(cmd);
      parseBreakpointResponse(response);
    }
    this.sessionLog.add(`Breakpoints installed (${strategies.length})`);
  }

  private matchStrategy(hit: BreakpointHit, strategies: BreakpointStrategy[]): BreakpointStrategy | undefined {
    return strategies.find((s) => s.consumesRun && s.matches(hit))
      ?? strategies.find((s) => !s.consumesRun && s.matches(hit));
  }

  private async configureFeatures(options: DebugSessionOptions): Promise<void> {
    await this.connection.sendCommand(this.commandBuilder.featureSet('max_depth', String(options.maxDepth)));
    await this.connection.sendCommand(this.commandBuilder.featureSet('max_children', String(options.maxChildren)));
    await this.connection.sendCommand(this.commandBuilder.featureSet('max_data', String(options.maxDataSize)));
  }

  private async collectBreakpointData(
    hitNumber: number,
    expressions?: string[],
  ): Promise<BreakpointHit> {
    const stackResponse = await this.connection.sendCommand(this.commandBuilder.stackGet());
    const dbgpFrames = parseStackFrames(stackResponse);

    const stackTrace: StackFrame[] = dbgpFrames.map((f) => {
      const hostPath = this.pathMapper.toHost(this.fromFileUri(f.filename));
      return {
        level: f.level,
        file: this.pathMapper.toRelative(hostPath),
        line: f.lineno,
        function: f.where,
      };
    });

    const localsResponse = await this.connection.sendCommand(
      this.commandBuilder.contextGet(0, LOCAL_CONTEXT_ID),
    );
    const dbgpProperties = parseProperties(localsResponse);
    const locals: Record<string, VariableValue> = {};
    for (const prop of dbgpProperties) {
      locals[prop.name] = this.convertProperty(prop);
    }

    let evaluatedExpressions: Record<string, VariableValue> | undefined;
    if (expressions && expressions.length > 0) {
      evaluatedExpressions = {};
      for (const expr of expressions) {
        try {
          const evalResponse = await this.connection.sendCommand(
            this.commandBuilder.eval(expr),
          );
          const evalProps = parseProperties(evalResponse);
          const firstProp = evalProps[0];
          if (firstProp) {
            evaluatedExpressions[expr] = this.convertProperty(firstProp);
          }
        } catch (err) {
          this.logger.warn(`Expression eval failed: ${expr}`, err instanceof Error ? err.message : err);
          evaluatedExpressions[expr] = { type: 'error', value: 'eval failed' };
        }
      }
    }

    const topFrame = stackTrace[0];
    return {
      file: topFrame?.file ?? 'unknown',
      line: topFrame?.line ?? 0,
      hitNumber,
      stackTrace,
      locals,
      expressions: evaluatedExpressions,
    };
  }

  private convertProperty(prop: DbgpProperty): VariableValue {
    const result: VariableValue = {
      type: prop.type,
      value: this.extractValue(prop),
    };

    if (prop.classname) result.className = prop.classname;
    if (prop.size !== undefined) result.size = prop.size;

    if (prop.children && prop.children.length > 0) {
      result.children = {};
      for (const child of prop.children) {
        result.children[child.name] = this.convertProperty(child);
      }
    }

    return result;
  }

  private extractValue(prop: DbgpProperty): unknown {
    switch (prop.type) {
      case 'int':
        return prop.value !== undefined ? parseInt(prop.value, 10) : null;
      case 'float':
        return prop.value !== undefined ? parseFloat(prop.value) : null;
      case 'bool':
        return prop.value === '1' || prop.value === 'true';
      case 'null':
        return null;
      case 'string':
        return prop.value ?? '';
      case 'array':
      case 'object':
        return prop.classname ?? prop.type;
      default:
        return prop.value ?? null;
    }
  }

  private fromFileUri(uri: string): string {
    return uri.replace(/^file:\/\//, '');
  }
}
