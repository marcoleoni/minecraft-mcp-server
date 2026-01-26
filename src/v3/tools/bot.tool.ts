/**
 * Bot Management Tool
 * Handles spawning, listing, and removing bots
 */

import { z } from 'zod';
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { ToolFactory } from '../../tool-factory.js';

const { pathfinder, Movements } = pathfinderPkg;

export interface BotManager {
  bots: Map<string, mineflayer.Bot>;
  defaultBot: mineflayer.Bot | null;
  config: {
    host: string;
    port: number;
    version?: string;
  };
}

export function registerBotTool(
  factory: ToolFactory,
  manager: BotManager
): void {
  factory.registerTool(
    'bot',
    `Manage Minecraft bots. Actions:
- spawn: Create a new bot and connect to the server
- list: List all active bots
- remove: Disconnect and remove a bot
- select: Set the active bot for commands`,
    {
      action: z.enum(['spawn', 'list', 'remove', 'select']).describe('Action to perform'),
      name: z.string().optional().describe('Bot name (for spawn/remove/select)'),
    },
    async (args) => {
      const { action, name } = args;

      switch (action) {
        case 'spawn': {
          if (!name) {
            return factory.createErrorResponse('Bot name is required for spawn');
          }

          if (manager.bots.has(name)) {
            return factory.createErrorResponse(`Bot "${name}" already exists`);
          }

          try {
            const bot = mineflayer.createBot({
              host: manager.config.host,
              port: manager.config.port,
              username: name,
              version: manager.config.version,
            });

            // Wait for spawn
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Bot spawn timeout'));
              }, 30000);

              bot.once('spawn', () => {
                clearTimeout(timeout);
                resolve();
              });

              bot.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
              });
            });

            // Load pathfinder
            bot.loadPlugin(pathfinder);

            manager.bots.set(name, bot);
            if (!manager.defaultBot) {
              manager.defaultBot = bot;
            }

            const pos = bot.entity.position;
            return factory.createResponse(
              `Bot "${name}" spawned at (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})\n` +
              `Game mode: ${bot.game.gameMode}\n` +
              `Health: ${bot.health}/20`
            );
          } catch (error) {
            return factory.createErrorResponse(
              `Failed to spawn bot: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        case 'list': {
          if (manager.bots.size === 0) {
            return factory.createResponse('No bots currently active. Use bot(spawn, "name") to create one.');
          }

          const lines: string[] = ['Active bots:'];
          for (const [botName, bot] of manager.bots) {
            const pos = bot.entity?.position;
            const isDefault = bot === manager.defaultBot ? ' (active)' : '';
            if (pos) {
              lines.push(
                `- ${botName}${isDefault}: (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}) ` +
                `HP: ${bot.health}/20, Food: ${bot.food}/20`
              );
            } else {
              lines.push(`- ${botName}${isDefault}: connecting...`);
            }
          }

          return factory.createResponse(lines.join('\n'));
        }

        case 'remove': {
          if (!name) {
            return factory.createErrorResponse('Bot name is required for remove');
          }

          const bot = manager.bots.get(name);
          if (!bot) {
            return factory.createErrorResponse(`Bot "${name}" not found`);
          }

          bot.quit();
          manager.bots.delete(name);

          if (manager.defaultBot === bot) {
            manager.defaultBot = manager.bots.size > 0
              ? manager.bots.values().next().value ?? null
              : null;
          }

          return factory.createResponse(`Bot "${name}" removed`);
        }

        case 'select': {
          if (!name) {
            return factory.createErrorResponse('Bot name is required for select');
          }

          const bot = manager.bots.get(name);
          if (!bot) {
            return factory.createErrorResponse(`Bot "${name}" not found`);
          }

          manager.defaultBot = bot;
          return factory.createResponse(`Active bot set to "${name}"`);
        }

        default:
          return factory.createErrorResponse(`Unknown action: ${action}`);
      }
    }
  );
}
