import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { DetectiveConfig } from './config/Config.js';
import { AdapterRegistry } from './adapter/AdapterRegistry.js';
import { ToolRegistry } from './tool/ToolRegistry.js';
import { DebugRequestTool } from './tool/DebugRequestTool.js';
import { DebugCommandTool } from './tool/DebugCommandTool.js';
import { PhpAdapter } from '../adapter/php/PhpAdapter.js';
import { extractPhpConfig } from '../adapter/php/config/PhpAdapterConfig.js';
import { Logger } from './util/Logger.js';

export class DetectiveServer {
  private readonly mcpServer: McpServer;
  private readonly adapterRegistry = new AdapterRegistry();
  private readonly toolRegistry = new ToolRegistry();
  private readonly logger = new Logger('DetectiveServer');

  constructor(
    private readonly config: DetectiveConfig,
    private readonly projectRoot: string,
  ) {
    this.mcpServer = new McpServer({
      name: 'detective',
      version: '0.1.0',
    });
  }

  async start(): Promise<void> {
    await this.initializeAdapters();
    this.registerTools();
    this.registerMcpTools();

    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    this.logger.info('Detective MCP server started');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down');
    const adapter = this.adapterRegistry.get(this.config.adapter);
    await adapter.shutdown();
  }

  private async initializeAdapters(): Promise<void> {
    const phpAdapter = new PhpAdapter();
    this.adapterRegistry.register(phpAdapter);

    const adapter = this.adapterRegistry.get(this.config.adapter);
    const adapterConfig = this.buildAdapterConfig();
    await adapter.initialize(adapterConfig);
  }

  private registerTools(): void {
    const adapter = this.adapterRegistry.get(this.config.adapter);
    this.toolRegistry.register(new DebugRequestTool(adapter));
    this.toolRegistry.register(new DebugCommandTool(adapter));
  }

  private registerMcpTools(): void {
    for (const tool of this.toolRegistry.all()) {
      const def = tool.definition();

      this.mcpServer.registerTool(
        def.name,
        {
          description: def.description,
          inputSchema: def.inputSchema,
        },
        async (params) => {
          try {
            const result = await tool.execute(params);
            return { content: [{ type: 'text' as const, text: result }] };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Tool ${def.name} failed`, { error: message });
            return {
              content: [{ type: 'text' as const, text: `Error: ${message}` }],
              isError: true,
            };
          }
        },
      );
    }
  }

  private buildAdapterConfig(): unknown {
    if (this.config.adapter === 'php') {
      return extractPhpConfig(this.config, this.projectRoot);
    }
    throw new Error(`Unknown adapter: ${this.config.adapter}`);
  }
}
