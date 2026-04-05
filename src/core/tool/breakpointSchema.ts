import { z } from 'zod';
import type { BreakpointDefinition } from '../adapter/types.js';

const explicitLineBreakpointSchema = z.object({
  type: z.literal('line'),
  file: z.string().describe('File path relative to project root'),
  line: z.number().int().positive(),
  condition: z.string().optional(),
});

const exceptionBreakpointSchema = z.object({
  type: z.literal('exception'),
  exception: z.string().describe('Exception class name or "*" for all exceptions'),
});

const implicitLineBreakpointSchema = z.object({
  file: z.string().describe('File path relative to project root'),
  line: z.number().int().positive(),
  condition: z.string().optional(),
});

export const breakpointSchema = z.discriminatedUnion('type', [
  explicitLineBreakpointSchema,
  exceptionBreakpointSchema,
]).or(implicitLineBreakpointSchema);

export function toBreakpointDefinitions(
  breakpoints: z.infer<typeof breakpointSchema>[],
): BreakpointDefinition[] {
  return breakpoints.map((bp) => {
    if ('type' in bp && bp.type === 'exception') {
      return { type: 'exception' as const, exception: bp.exception };
    }
    const lineBp = bp as z.infer<typeof implicitLineBreakpointSchema>;
    return {
      type: 'line' as const,
      file: lineBp.file,
      line: lineBp.line,
      condition: lineBp.condition,
    };
  });
}
