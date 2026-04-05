import { DBGP_COMMANDS } from './DbgpProtocol.js';

export class DbgpCommandBuilder {
  private transactionId = 0;

  nextTransactionId(): number {
    return ++this.transactionId;
  }

  featureSet(name: string, value: string): string {
    const tid = this.nextTransactionId();
    return `feature_set -i ${tid} -n ${name} -v ${value}`;
  }

  breakpointSet(fileUri: string, line: number, condition?: string): string {
    const tid = this.nextTransactionId();
    let cmd = `${DBGP_COMMANDS.BREAKPOINT_SET} -i ${tid} -t line -f ${fileUri} -n ${line}`;

    if (condition) {
      const encoded = Buffer.from(condition).toString('base64');
      cmd += ` -- ${encoded}`;
    }

    return cmd;
  }

  breakpointRemove(breakpointId: string): string {
    const tid = this.nextTransactionId();
    return `${DBGP_COMMANDS.BREAKPOINT_REMOVE} -i ${tid} -d ${breakpointId}`;
  }

  run(): string {
    const tid = this.nextTransactionId();
    return `${DBGP_COMMANDS.RUN} -i ${tid}`;
  }

  stop(): string {
    const tid = this.nextTransactionId();
    return `${DBGP_COMMANDS.STOP} -i ${tid}`;
  }

  stackGet(): string {
    const tid = this.nextTransactionId();
    return `${DBGP_COMMANDS.STACK_GET} -i ${tid}`;
  }

  contextGet(depth: number, contextId: number): string {
    const tid = this.nextTransactionId();
    return `${DBGP_COMMANDS.CONTEXT_GET} -i ${tid} -d ${depth} -c ${contextId}`;
  }

  eval(expression: string): string {
    const tid = this.nextTransactionId();
    const encoded = Buffer.from(expression).toString('base64');
    return `${DBGP_COMMANDS.EVAL} -i ${tid} -- ${encoded}`;
  }

  propertyGet(name: string, depth: number, contextId: number, maxDepth?: number): string {
    const tid = this.nextTransactionId();
    let cmd = `${DBGP_COMMANDS.PROPERTY_GET} -i ${tid} -n ${name} -d ${depth} -c ${contextId}`;
    if (maxDepth !== undefined) {
      cmd += ` -m ${maxDepth}`;
    }
    return cmd;
  }
}
