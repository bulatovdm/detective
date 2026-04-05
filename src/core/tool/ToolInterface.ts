import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

export interface ToolInterface {
  definition(): ToolDefinition;
  execute(input: unknown): Promise<string>;
}
