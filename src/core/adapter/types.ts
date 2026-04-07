export interface RequestTrigger {
  type: 'http';
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface CliTrigger {
  type: 'cli';
  command: string;
  args?: string[];
}

export type Trigger = RequestTrigger | CliTrigger;

export interface LineBreakpoint {
  type?: 'line';
  file: string;
  line: number;
  condition?: string;
  hitCount?: number;
}

export interface ExceptionBreakpoint {
  type: 'exception';
  exception: string;
}

export type BreakpointDefinition = LineBreakpoint | ExceptionBreakpoint;

export interface DebugSessionParams {
  trigger: Trigger;
  breakpoints: BreakpointDefinition[];
  expressions?: string[];
  maxDepth?: number;
  timeout?: number;
  verbose?: boolean;
}

export interface DebugSessionResult {
  response?: HttpResponse;
  output?: CommandOutput;
  hits: BreakpointHit[];
  errors: ErrorInfo[];
  meta: SessionMeta;
  sessionLog?: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export interface CommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface BreakpointHit {
  file: string;
  line: number;
  hitNumber: number;
  stackTrace: StackFrame[];
  locals: Record<string, VariableValue>;
  expressions?: Record<string, VariableValue>;
}

export interface StackFrame {
  level: number;
  file: string;
  line: number;
  function: string;
  class?: string;
}

export interface VariableValue {
  type: string;
  value: unknown;
  className?: string;
  size?: number;
  truncated?: boolean;
  children?: Record<string, VariableValue>;
}

export interface ErrorInfo {
  type: string;
  message: string;
  file?: string;
  line?: number;
  trace?: StackFrame[];
}

export interface SessionMeta {
  adapterName: string;
  debuggerVersion: string;
  languageVersion: string;
  totalBreakpointsSet: number;
  totalHits: number;
  executionTimeMs: number;
}

export type EvalContext = 'runtime' | 'breakpoint';

export interface EvalResult {
  success: boolean;
  value?: VariableValue;
  output?: string;
  error?: string;
}

export interface InspectionDescriptor {
  name: string;
  description: string;
  params?: Record<string, string>;
}

export interface InspectionResult {
  name: string;
  data: unknown;
}

export interface ProfileParams {
  trigger: RequestTrigger;
  topN?: number;
}

export interface ProfileResult {
  response: HttpResponse;
  totalTimeMs: number;
  calls: ProfileCall[];
}

export interface ProfileCall {
  function: string;
  file: string;
  line: number;
  selfTimeMs: number;
  cumulativeTimeMs: number;
  callCount: number;
}