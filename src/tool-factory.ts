import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BotManager } from './bot-manager.js';

type McpResponse = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
};

export class ToolFactory {
  constructor(
    private server: McpServer,
    private botManager: BotManager
  ) {}

  /**
   * Register a tool with optional bot selection support
   * @param name Tool name
   * @param description Tool description
   * @param schema Zod schema for parameters
   * @param executor Function to execute the tool
   * @param supportsBotSelection If true, adds optional 'bot' parameter to schema
   */
  registerTool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executor: (args: any) => Promise<McpResponse>,
    supportsBotSelection = false
  ): void {
    // Add bot parameter to schema if bot selection is supported
    const finalSchema = supportsBotSelection
      ? {
          ...schema,
          bot: {
            type: 'string',
            description: 'Bot name or number (1-based index). If not specified, uses the active bot.',
            optional: true
          }
        }
      : schema;

    this.server.tool(name, description, finalSchema, async (args: unknown): Promise<McpResponse> => {
      // Only validate bot connection if the tool supports bot selection
      if (supportsBotSelection) {
        // Extract bot parameter if present
        const botParam = args && typeof args === 'object' && 'bot' in args
          ? (args as { bot?: string | number }).bot
          : undefined;

        // Get the bot connection
        const connection = botParam !== undefined
          ? this.botManager.getBotConnection(botParam)
          : this.botManager.getBotConnection(); // Uses active bot

        if (!connection) {
          const botIdentifier = botParam !== undefined ? `'${botParam}'` : 'active bot';
          return {
            content: [{ type: "text", text: `Bot ${botIdentifier} not found. Use list-bots to see available bots.` }],
            isError: true
          };
        }

        // Check connection status
        const connectionCheck = await connection.checkConnectionAndReconnect();

        if (!connectionCheck.connected) {
          return {
            content: [{ type: "text", text: connectionCheck.message! }],
            isError: true
          };
        }

        // Add selected bot instance to args for tools that need it
        try {
          if (args && typeof args === 'object') {
            const bot = connection.getBot();
            if (bot) {
              // Create a new object with the bot instance added
              const argsWithBot = { ...args, _selectedBot: bot };
              return await executor(argsWithBot);
            }
          }
        } catch (error) {
          return this.createErrorResponse(error as Error);
        }
      }

      // For tools that don't support bot selection, execute directly
      try {
        return await executor(args);
      } catch (error) {
        return this.createErrorResponse(error as Error);
      }
    });
  }

  /**
   * Get the BotManager instance
   */
  getBotManager(): BotManager {
    return this.botManager;
  }

  createResponse(text: string): McpResponse {
    return {
      content: [{ type: "text", text }]
    };
  }

  createErrorResponse(error: Error | string): McpResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    return {
      content: [{ type: "text", text: `Failed: ${errorMessage}` }],
      isError: true
    };
  }
}
