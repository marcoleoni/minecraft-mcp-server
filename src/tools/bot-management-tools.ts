import { z } from "zod";
import { ToolFactory } from '../tool-factory.js';
import { BotManager } from '../bot-manager.js';

/**
 * Register multi-bot management tools
 * These tools allow spawning, listing, selecting, and removing bots
 */
export function registerBotManagementTools(factory: ToolFactory): void {
  const botManager = factory.getBotManager();

  // spawn-bot: Create and connect a new bot
  factory.registerTool(
    "spawn-bot",
    "Spawn a new bot and connect it to the configured Minecraft server. The bot will be added to the bot pool and can be selected for use. All bots connect to the same server configured at startup.",
    {
      username: z.string().describe("Bot username in Minecraft (e.g., 'MinerBot', 'BuilderBot')"),
      name: z.string().optional().describe("Optional: unique identifier for the bot (defaults to username)")
    },
    async ({ username, name }) => {
      const result = await botManager.spawnBot(username, { name });

      if (result.success) {
        return factory.createResponse(result.message);
      } else {
        return factory.createErrorResponse(result.message);
      }
    },
    false // Bot selection not supported for management tools
  );

  // list-bots: List all active bots
  factory.registerTool(
    "list-bots",
    "List all currently active bots with their connection information and status",
    {},
    async () => {
      const bots = botManager.listBots();

      if (bots.length === 0) {
        return factory.createResponse("No bots currently active. Use spawn-bot to create a new bot.");
      }

      const activeBotName = botManager.getActiveBotName();

      let response = `Active bots (${bots.length}):\n\n`;

      bots.forEach((bot, index) => {
        const activeMarker = bot.isActive ? " ⭐ [ACTIVE]" : "";
        response += `${index + 1}. ${bot.name}${activeMarker}\n`;
        response += `   Username: ${bot.username}\n`;
        response += `   Server: ${bot.host}:${bot.port}\n`;
        response += `   State: ${bot.state}\n\n`;
      });

      response += `\nCurrent active bot: ${activeBotName || 'none'}\n`;
      response += `\nTip: Use select-bot to switch the active bot, or specify the 'bot' parameter in tools to use a specific bot.`;

      return factory.createResponse(response);
    },
    false
  );

  // select-bot: Set the active bot
  factory.registerTool(
    "select-bot",
    "Set the active bot. The active bot will be used by default for all tools that support bot selection.",
    {
      bot: z.union([z.string(), z.number()]).describe("Bot name or number (1-based index) to set as active")
    },
    async ({ bot }) => {
      const result = botManager.setActiveBot(bot);

      if (result.success) {
        return factory.createResponse(result.message);
      } else {
        return factory.createErrorResponse(result.message);
      }
    },
    false
  );

  // remove-bot: Disconnect and remove a bot
  factory.registerTool(
    "remove-bot",
    "Disconnect and remove a bot from the bot pool. If the removed bot was active, another bot will be automatically selected as active.",
    {
      bot: z.union([z.string(), z.number()]).describe("Bot name or number (1-based index) to remove")
    },
    async ({ bot }) => {
      const result = botManager.removeBot(bot);

      if (result.success) {
        const remainingBots = botManager.getBotCount();
        let message = result.message;

        if (remainingBots > 0) {
          const newActiveBotName = botManager.getActiveBotName();
          message += `\n\nRemaining bots: ${remainingBots}\n`;
          message += `Active bot: ${newActiveBotName}`;
        } else {
          message += `\n\nNo bots remaining. Use spawn-bot to create a new bot.`;
        }

        return factory.createResponse(message);
      } else {
        return factory.createErrorResponse(result.message);
      }
    },
    false
  );

  // get-active-bot: Get information about the active bot
  factory.registerTool(
    "get-active-bot",
    "Get information about the currently active bot",
    {},
    async () => {
      const activeBotName = botManager.getActiveBotName();

      if (!activeBotName) {
        return factory.createResponse("No active bot. Use spawn-bot to create a bot or select-bot to activate an existing one.");
      }

      const bots = botManager.listBots();
      const activeBot = bots.find(b => b.name === activeBotName);

      if (!activeBot) {
        return factory.createErrorResponse("Active bot information not found");
      }

      let response = `Active Bot: ${activeBot.name}\n\n`;
      response += `Username: ${activeBot.username}\n`;
      response += `Server: ${activeBot.host}:${activeBot.port}\n`;
      response += `State: ${activeBot.state}\n`;

      return factory.createResponse(response);
    },
    false
  );

  // get-bot-count: Get the number of active bots
  factory.registerTool(
    "get-bot-count",
    "Get the total number of currently active bots",
    {},
    async () => {
      const count = botManager.getBotCount();
      const activeBotName = botManager.getActiveBotName();

      let response = `Total active bots: ${count}\n`;

      if (count > 0) {
        response += `Active bot: ${activeBotName}`;
      } else {
        response += `\nNo bots currently active. Use spawn-bot to create a new bot.`;
      }

      return factory.createResponse(response);
    },
    false
  );
}
