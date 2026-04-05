export const DBGP_COMMANDS = {
  BREAKPOINT_SET: 'breakpoint_set',
  BREAKPOINT_REMOVE: 'breakpoint_remove',
  RUN: 'run',
  STEP_OVER: 'step_over',
  STEP_INTO: 'step_into',
  STEP_OUT: 'step_out',
  STOP: 'stop',
  STACK_GET: 'stack_get',
  CONTEXT_GET: 'context_get',
  CONTEXT_NAMES: 'context_names',
  PROPERTY_GET: 'property_get',
  EVAL: 'eval',
  STATUS: 'status',
  FEATURE_SET: 'feature_set',
  FEATURE_GET: 'feature_get',
} as const;

export type DbgpCommand = (typeof DBGP_COMMANDS)[keyof typeof DBGP_COMMANDS];

export interface DbgpInitPacket {
  fileUri: string;
  ideKey: string;
  language: string;
  protocolVersion: string;
  appId: string;
  engine: string;
  engineVersion: string;
}

export interface DbgpResponse {
  transactionId: string;
  command: string;
  status?: string;
  reason?: string;
  success?: boolean;
  children?: unknown;
  raw: Record<string, unknown>;
}

export interface DbgpBreakpointResponse {
  id: string;
  state: string;
}

export interface DbgpStackFrame {
  level: number;
  type: string;
  filename: string;
  lineno: number;
  where: string;
}

export interface DbgpProperty {
  name: string;
  fullname: string;
  type: string;
  encoding?: string;
  value?: string;
  numchildren?: number;
  classname?: string;
  size?: number;
  children?: DbgpProperty[];
}

export const DBGP_STATUS = {
  STARTING: 'starting',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  RUNNING: 'running',
  BREAK: 'break',
} as const;
