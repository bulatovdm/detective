import type { DebugSessionResult, BreakpointHit, VariableValue } from '../adapter/types.js';

export interface TruncationLimits {
  maxDepth: number;
  maxChildren: number;
  maxStringLength: number;
  maxLocals: number;
  maxStackFrames: number;
  maxHits: number;
}

const DEFAULT_LIMITS: TruncationLimits = {
  maxDepth: 4,
  maxChildren: 30,
  maxStringLength: 500,
  maxLocals: 30,
  maxStackFrames: 15,
  maxHits: 10,
};

const NOISE_CLASS_PATTERNS = [
  /^DI\\Container$/,
  /^DI\\Definition\\/,
  /^Invoker\\Invoker$/,
  /^Symfony\\Component\\Cache/,
  /ProxyFactory$/,
  /DefinitionSource$/,
  /ResolverDispatcher$/,
];

const LARGE_OBJECT_THRESHOLD = 50;

export function truncateSnapshot(
  result: DebugSessionResult,
  limits: Partial<TruncationLimits> = {},
): DebugSessionResult {
  const merged = { ...DEFAULT_LIMITS, ...limits };

  return {
    ...result,
    hits: result.hits.slice(0, merged.maxHits).map((hit) => truncateHit(hit, merged)),
  };
}

function truncateHit(hit: BreakpointHit, limits: TruncationLimits): BreakpointHit {
  const truncatedLocals: Record<string, VariableValue> = {};
  const entries = Object.entries(hit.locals);
  const kept = entries.slice(0, limits.maxLocals);

  for (const [name, value] of kept) {
    truncatedLocals[name] = truncateVariable(value, 0, limits);
  }

  if (entries.length > limits.maxLocals) {
    truncatedLocals[`... +${entries.length - limits.maxLocals} more`] = {
      type: 'omitted',
      value: null,
    };
  }

  let truncatedExpressions: Record<string, VariableValue> | undefined;
  if (hit.expressions) {
    truncatedExpressions = {};
    for (const [expr, value] of Object.entries(hit.expressions)) {
      truncatedExpressions[expr] = truncateVariable(value, 0, limits);
    }
  }

  return {
    ...hit,
    stackTrace: hit.stackTrace.slice(0, limits.maxStackFrames),
    locals: truncatedLocals,
    expressions: truncatedExpressions,
  };
}

function truncateVariable(
  variable: VariableValue,
  depth: number,
  limits: TruncationLimits,
): VariableValue {
  if (typeof variable.value === 'string' && variable.value.length > limits.maxStringLength) {
    return {
      ...variable,
      value: variable.value.slice(0, limits.maxStringLength),
      truncated: true,
    };
  }

  if (!variable.children) {
    return variable;
  }

  if (depth >= limits.maxDepth) {
    return {
      ...variable,
      children: undefined,
      truncated: true,
    };
  }

  if (isNoiseClass(variable) || isLargeObject(variable)) {
    return {
      type: variable.type,
      value: variable.className ?? variable.type,
      className: variable.className,
      truncated: true,
    };
  }

  const childEntries = Object.entries(variable.children);
  const keptChildren: Record<string, VariableValue> = {};
  const childLimit = Math.min(childEntries.length, limits.maxChildren);

  for (let i = 0; i < childLimit; i++) {
    const [key, child] = childEntries[i]!;
    keptChildren[key] = truncateVariable(child, depth + 1, limits);
  }

  if (childEntries.length > limits.maxChildren) {
    keptChildren[`... +${childEntries.length - limits.maxChildren} more`] = {
      type: 'omitted',
      value: null,
    };
  }

  return {
    ...variable,
    children: keptChildren,
  };
}

function isNoiseClass(variable: VariableValue): boolean {
  const className = variable.className ?? '';
  return NOISE_CLASS_PATTERNS.some((pattern) => pattern.test(className));
}

function isLargeObject(variable: VariableValue): boolean {
  if (!variable.children) return false;
  return Object.keys(variable.children).length > LARGE_OBJECT_THRESHOLD;
}
