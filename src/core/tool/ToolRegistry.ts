import type { ToolInterface } from './ToolInterface.js';

export class ToolRegistry {
  private tools = new Map<string, ToolInterface>();

  register(tool: ToolInterface): void {
    const def = tool.definition();
    this.tools.set(def.name, tool);
  }

  get(name: string): ToolInterface {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found. Available: ${[...this.tools.keys()].join(', ')}`);
    }
    return tool;
  }

  all(): ToolInterface[] {
    return [...this.tools.values()];
  }
}
