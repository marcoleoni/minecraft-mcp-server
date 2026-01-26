#!/usr/bin/env node

/**
 * Minecraft MCP Server v3
 * Intelligent planner-based architecture with only 3 tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupStdioFiltering } from './stdio-filter.js';
import { log } from './logger.js';
import { parseConfig } from './config.js';
import { ToolFactory } from './tool-factory.js';
import { registerV3Tools, createBotManager } from './v3/index.js';

setupStdioFiltering();

process.on('unhandledRejection', (reason) => {
  log('error', `Unhandled rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  log('error', `Uncaught exception: ${error}`);
});

async function main() {
  const config = parseConfig();

  log('info', `Minecraft MCP Server v3.0.0 (Intelligent Planner) starting...`);
  log('info', `Target server: ${config.server.host}:${config.server.port}`);
  log('info', '');
  log('info', 'Available tools:');
  log('info', '  - bot     : Manage bots (spawn, list, remove)');
  log('info', '  - observe : Get comprehensive state information');
  log('info', '  - do      : Execute tasks with natural language');
  log('info', '');

  // Create bot manager with v3 architecture
  const botManager = createBotManager({
    host: config.server.host,
    port: config.server.port,
    version: (config.server as any).version,
  });

  // Create MCP server
  const server = new McpServer({
    name: "minecraft-mcp-server",
    version: "3.0.0"
  });

  // Create tool factory
  const factory = new ToolFactory(server);

  // Register only the 3 v3 tools
  registerV3Tools(factory, botManager);

  log('info', 'Tools registered. Starting MCP server...');

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('info', 'MCP Server connected and ready!');
  log('info', '');
  log('info', 'Quick start:');
  log('info', '  1. bot("spawn", "Steve")     - Create a bot');
  log('info', '  2. observe()                  - See the world');
  log('info', '  3. do("build a small house")  - Execute tasks');
}

main().catch((error) => {
  log('error', `Fatal error: ${error}`);
  process.exit(1);
});
