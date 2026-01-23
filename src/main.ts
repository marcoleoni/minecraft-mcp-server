#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupStdioFiltering } from './stdio-filter.js';
import { log } from './logger.js';
import { parseConfig } from './config.js';
import { BotManager } from './bot-manager.js';
import { ToolFactory } from './tool-factory.js';
import { MessageStore } from './message-store.js';
import { registerPositionTools } from './tools/position-tools.js';
import { registerInventoryTools } from './tools/inventory-tools.js';
import { registerBlockTools } from './tools/block-tools.js';
import { registerEntityTools } from './tools/entity-tools.js';
import { registerChatTools } from './tools/chat-tools.js';
import { registerFlightTools } from './tools/flight-tools.js';
import { registerGameStateTools } from './tools/gamestate-tools.js';
import { registerCraftingTools } from './tools/crafting-tools.js';
import { registerBotManagementTools } from './tools/bot-management-tools.js';
import { registerCompositeTools } from './tools/composite-tools.js';
import { registerSequenceTools } from './tools/sequence-tools.js';
import { registerContextTools } from './tools/context-tools.js';

setupStdioFiltering();

process.on('unhandledRejection', (reason) => {
  log('error', `Unhandled rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  log('error', `Uncaught exception: ${error}`);
});

async function main() {
  const config = parseConfig();
  const messageStore = new MessageStore();

  log('info', `Minecraft MCP Server v2.1.0 starting...`);
  log('info', `Target server: ${config.server.host}:${config.server.port}`);

  // Create BotManager with server configuration
  const botManager = new BotManager(
    {
      onLog: log,
      onChatMessage: (botName, username, message) => messageStore.addMessage(username, message, botName)
    },
    config.server
  );

  // Optionally spawn initial bot if username provided
  if (config.initialBot) {
    log('info', `Spawning initial bot with username: ${config.initialBot}`);
    const result = await botManager.spawnBot(config.initialBot);

    if (!result.success) {
      log('error', `Failed to spawn initial bot: ${result.message}`);
      log('info', 'Server will continue without initial bot. Use spawn-bot tool to add bots.');
    }
  } else {
    log('info', 'No initial bot specified. Use spawn-bot tool to add bots to the server.');
  }

  const server = new McpServer({
    name: "minecraft-mcp-server",
    version: "2.1.0"
  });

  const factory = new ToolFactory(server, botManager);
  const getBot = () => botManager.getActiveBot()!;

  // Register all existing tools
  registerPositionTools(factory, getBot);
  registerInventoryTools(factory, getBot);
  registerBlockTools(factory, getBot);
  registerEntityTools(factory, getBot);
  registerChatTools(factory, getBot, messageStore);
  registerFlightTools(factory, getBot);
  registerGameStateTools(factory, getBot);
  registerCraftingTools(factory, getBot);

  // Register multi-bot management tools
  registerBotManagementTools(factory);

  // Register performance-optimized tools
  registerCompositeTools(factory, getBot);
  registerSequenceTools(factory, getBot);
  registerContextTools(factory, getBot);

  const botCount = botManager.getBotCount();
  const activeBotName = botManager.getActiveBotName();

  log('info', `MCP Server initialized with ${botCount} bot(s)`);
  if (activeBotName) {
    log('info', `Active bot: ${activeBotName}`);
  } else {
    log('info', 'No active bot. Use spawn-bot to create bots.');
  }

  process.stdin.on('end', () => {
    botManager.cleanup();
    log('info', 'MCP Client has disconnected. Shutting down...');
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  log('error', `Fatal error in main(): ${error}`);
  process.exit(1);
});
