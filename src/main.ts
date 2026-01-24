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

// Goal-driven architecture imports
import { EventQueue } from './events/event-queue.js';
import { GoalManager } from './goals/goal-manager.js';
import { BehaviorExecutor } from './behaviors/behavior-executor.js';
import { NavigateBehavior } from './behaviors/navigate.behavior.js';
import { MineBehavior } from './behaviors/mine.behavior.js';
import { EatBehavior } from './behaviors/eat.behavior.js';
import { PlaceBehavior } from './behaviors/place.behavior.js';
import { BuildStructureBehavior } from './behaviors/build-structure.behavior.js';
import { registerDelegateTaskTool } from './tools/delegate-task.tool.js';
import { registerGetStatusTool } from './tools/get-status.tool.js';
import { registerGetEventsTool } from './tools/get-events.tool.js';
import { registerCancelTaskTool } from './tools/cancel-task.tool.js';
import { registerListCapabilitiesTool } from './tools/list-capabilities.tool.js';
import { registerExecuteScriptTool } from './tools/execute-script.tool.js';

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

  log('info', `Minecraft MCP Server v2.2.1 starting...`);
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
    version: "2.2.1"
  });

  const factory = new ToolFactory(server, botManager);
  const getBot = () => botManager.getActiveBot()!;

  // Initialize goal-driven architecture
  log('info', 'Initializing goal-driven architecture...');
  const eventQueue = new EventQueue(1000); // Keep last 1000 events
  const behaviorExecutor = new BehaviorExecutor();
  const goalManager = new GoalManager(eventQueue, behaviorExecutor);

  // Register behaviors
  behaviorExecutor.registerBehavior(new NavigateBehavior());
  behaviorExecutor.registerBehavior(new MineBehavior());
  behaviorExecutor.registerBehavior(new EatBehavior());
  behaviorExecutor.registerBehavior(new PlaceBehavior());
  behaviorExecutor.registerBehavior(new BuildStructureBehavior());

  // Note: Bots will be registered with behavior executor on-demand when goals are delegated

  // Start goal manager tick loop
  goalManager.start();
  log('info', 'Goal-driven architecture initialized');

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

  // Register goal-driven architecture tools
  registerDelegateTaskTool(factory, getBot, goalManager, behaviorExecutor);
  registerGetStatusTool(factory, getBot, goalManager);
  registerGetEventsTool(factory, getBot, eventQueue);
  registerCancelTaskTool(factory, getBot, goalManager);
  registerListCapabilitiesTool(factory, getBot);

  // Register script execution tool (maximum flexibility)
  registerExecuteScriptTool(factory, getBot);

  const botCount = botManager.getBotCount();
  const activeBotName = botManager.getActiveBotName();

  log('info', `MCP Server initialized with ${botCount} bot(s)`);
  if (activeBotName) {
    log('info', `Active bot: ${activeBotName}`);
  } else {
    log('info', 'No active bot. Use spawn-bot to create bots.');
  }

  process.stdin.on('end', () => {
    goalManager.stop();
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
