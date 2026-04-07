import type { DebugSessionResult, BreakpointHit, VariableValue, StackFrame } from '../adapter/types.js';

export function formatSnapshot(result: DebugSessionResult): string {
  const parts: string[] = [];

  if (result.response) {
    parts.push(formatHttpResponse(result.response));
  }

  if (result.output) {
    parts.push(formatCommandOutput(result.output));
  }

  if (result.hits.length === 0) {
    parts.push('No breakpoints were hit.');
  } else {
    for (const hit of result.hits) {
      parts.push(formatBreakpointHit(hit));
    }
  }

  if (result.errors.length > 0) {
    parts.push(formatErrors(result.errors));
  }

  parts.push(formatMeta(result.meta));

  if (result.sessionLog) {
    parts.push(formatSessionLog(result.sessionLog));
  }

  return parts.join('\n\n---\n\n');
}

function formatHttpResponse(response: DebugSessionResult['response'] & object): string {
  const lines: string[] = [
    `## HTTP Response: ${response.status} ${response.statusText}`,
  ];

  const relevantHeaders = ['content-type', 'location', 'x-debug-token'];
  for (const [key, value] of Object.entries(response.headers)) {
    if (relevantHeaders.includes(key.toLowerCase())) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  if (response.body) {
    const body = response.body.length > 500
      ? response.body.slice(0, 500) + '...'
      : response.body;
    lines.push('', '```', body, '```');
  }

  return lines.join('\n');
}

function formatCommandOutput(output: DebugSessionResult['output'] & object): string {
  const lines = [`## Command Output (exit code: ${output.exitCode})`];

  if (output.stdout) lines.push('**stdout:**', '```', output.stdout, '```');
  if (output.stderr) lines.push('**stderr:**', '```', output.stderr, '```');

  return lines.join('\n');
}

function formatBreakpointHit(hit: BreakpointHit): string {
  const lines: string[] = [
    `## Hit #${hit.hitNumber}: ${hit.file}:${hit.line}`,
  ];

  lines.push('');
  lines.push('**Stack trace:**');
  for (const frame of hit.stackTrace.slice(0, 10)) {
    lines.push(formatStackFrame(frame));
  }
  if (hit.stackTrace.length > 10) {
    lines.push(`  ... +${hit.stackTrace.length - 10} more frames`);
  }

  const localEntries = Object.entries(hit.locals);
  if (localEntries.length > 0) {
    lines.push('');
    lines.push('**Local variables:**');
    for (const [name, variable] of localEntries) {
      lines.push(formatVariable(name, variable, 1));
    }
  }

  if (hit.expressions) {
    const exprEntries = Object.entries(hit.expressions);
    if (exprEntries.length > 0) {
      lines.push('');
      lines.push('**Expressions:**');
      for (const [expr, variable] of exprEntries) {
        lines.push(formatVariable(expr, variable, 1));
      }
    }
  }

  return lines.join('\n');
}

function formatStackFrame(frame: StackFrame): string {
  const location = `${frame.file}:${frame.line}`;
  const fn = frame.class ? `${frame.class}::${frame.function}` : frame.function;
  return `  #${frame.level} ${fn} at ${location}`;
}

function formatVariable(name: string, variable: VariableValue, depth: number): string {
  const indent = '  '.repeat(depth);
  const typeLabel = variable.className ?? variable.type;
  const truncatedMark = variable.truncated ? ' [truncated]' : '';

  if (variable.children && Object.keys(variable.children).length > 0) {
    const lines = [`${indent}${name}: (${typeLabel})${truncatedMark}`];
    if (depth < 3) {
      for (const [childName, childVar] of Object.entries(variable.children)) {
        lines.push(formatVariable(childName, childVar, depth + 1));
      }
    } else {
      lines.push(`${indent}  ... (deep nesting omitted)`);
    }
    return lines.join('\n');
  }

  const valueStr = formatScalarValue(variable.value);
  return `${indent}${name}: (${typeLabel}) ${valueStr}${truncatedMark}`;
}

function formatScalarValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    if (value.length > 200) return `"${value.slice(0, 200)}..."`;
    return `"${value}"`;
  }
  return String(value);
}

function formatErrors(errors: DebugSessionResult['errors']): string {
  const lines = ['## Errors'];
  for (const error of errors) {
    lines.push(`- **${error.type}**: ${error.message}`);
    if (error.file) lines.push(`  at ${error.file}:${error.line}`);
  }
  return lines.join('\n');
}

function formatMeta(meta: DebugSessionResult['meta']): string {
  return [
    '## Session Info',
    `  Adapter: ${meta.adapterName}`,
    `  Debugger: ${meta.debuggerVersion}`,
    `  Breakpoints set: ${meta.totalBreakpointsSet}`,
    `  Hits: ${meta.totalHits}`,
    `  Time: ${meta.executionTimeMs}ms`,
  ].join('\n');
}

function formatSessionLog(log: string): string {
  return `## Session Log\n\`\`\`\n${log}\n\`\`\``;
}
