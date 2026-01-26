import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type McpResponse = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
};

/**
 * Simplified ToolFactory for v3 architecture
 * Handles tool registration with the MCP server
 */
export class ToolFactory {
  constructor(private server: McpServer) {}

  /**
   * Register a tool with the MCP server
   * @param name Tool name
   * @param description Tool description
   * @param schema Zod schema for parameters
   * @param executor Function to execute the tool
   */
  registerTool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executor: (args: any) => Promise<McpResponse>
  ): void {
    this.server.tool(name, description, schema, async (args: unknown): Promise<McpResponse> => {
      try {
        return await executor(args);
      } catch (error) {
        return this.createErrorResponse(error as Error);
      }
    });
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
