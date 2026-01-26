/**
 * Minecraft MCP Server v3
 * Intelligent planner-based architecture
 *
 * Only 3 tools:
 * - bot: Manage bots (spawn, list, remove, select)
 * - observe: Get comprehensive state information
 * - do: Execute tasks with natural language
 */

import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import { registerBotTool, BotManager } from './tools/bot.tool.js';
import { registerObserveTool } from './tools/observe.tool.js';
import { registerDoTool } from './tools/do.tool.js';

export type { BotManager } from './tools/bot.tool.js';

/**
 * Register all v3 tools
 */
export function registerV3Tools(
  factory: ToolFactory,
  manager: BotManager
): void {
  const getBot = () => {
    if (!manager.defaultBot) {
      throw new Error('No bot active. Use bot("spawn", "name") first.');
    }
    return manager.defaultBot;
  };

  // Register the 3 minimal tools
  registerBotTool(factory, manager);
  registerObserveTool(factory, getBot);
  registerDoTool(factory, getBot);
}

/**
 * Create a new bot manager
 */
export function createBotManager(config: {
  host: string;
  port: number;
  version?: string;
}): BotManager {
  return {
    bots: new Map(),
    defaultBot: null,
    config,
  };
}
