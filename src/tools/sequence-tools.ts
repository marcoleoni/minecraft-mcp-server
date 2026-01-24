import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';

/**
 * Sequence tools - Execute multiple commands in a single call
 * Reduces round-trip latency by batching operations
 */

interface SequenceCommand {
  action: string;
  [key: string]: any;
}

export function registerSequenceTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  // execute-sequence: Execute a list of commands in order
  factory.registerTool(
    "execute-sequence",
    "Execute a sequence of commands in order. Significantly reduces latency for multi-step operations. Supported actions: move, dig, place, look, attack, chat, equip, jump, wait.",
    {
      commands: z.array(z.object({
        action: z.enum(['move', 'dig', 'place', 'look', 'attack', 'chat', 'equip', 'jump', 'wait']).describe("Action to perform"),
        x: z.number().optional().describe("X coordinate (for move, dig, place, look)"),
        y: z.number().optional().describe("Y coordinate (for move, dig, place, look)"),
        z: z.number().optional().describe("Z coordinate (for move, dig, place, look)"),
        blockType: z.string().optional().describe("Block type (for place)"),
        entityName: z.string().optional().describe("Entity name (for attack)"),
        message: z.string().optional().describe("Chat message (for chat)"),
        itemName: z.string().optional().describe("Item name (for equip)"),
        duration: z.number().optional().describe("Duration in ms (for wait)")
      })).describe("Array of commands to execute in sequence")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { commands } = args as { commands: SequenceCommand[] };

      const results: string[] = [];
      const mcData = require('minecraft-data')(bot.version);
      let successCount = 0;
      let failCount = 0;

      try {
        for (let i = 0; i < commands.length; i++) {
          const cmd = commands[i];
          const stepNum = i + 1;

          try {
            switch (cmd.action) {
              case 'move':
                if (cmd.x === undefined || cmd.y === undefined || cmd.z === undefined) {
                  throw new Error("move requires x, y, z coordinates");
                }
                const moveGoal = new goals.GoalNear(cmd.x, cmd.y, cmd.z, 1);
                await bot.pathfinder.goto(moveGoal);
                results.push(`${stepNum}. Moved to (${cmd.x}, ${cmd.y}, ${cmd.z})`);
                successCount++;
                break;

              case 'dig':
                if (cmd.x === undefined || cmd.y === undefined || cmd.z === undefined) {
                  throw new Error("dig requires x, y, z coordinates");
                }
                const digPos = new Vec3(cmd.x, cmd.y, cmd.z);
                const blockToDig = bot.blockAt(digPos);
                if (!blockToDig || blockToDig.name === 'air') {
                  throw new Error(`No block at (${cmd.x}, ${cmd.y}, ${cmd.z})`);
                }
                await bot.dig(blockToDig);
                results.push(`${stepNum}. Mined ${blockToDig.name}`);
                successCount++;
                break;

              case 'place':
                if (cmd.x === undefined || cmd.y === undefined || cmd.z === undefined || !cmd.blockType) {
                  throw new Error("place requires x, y, z and blockType");
                }
                const item = mcData.itemsByName[cmd.blockType];
                if (!item) {
                  throw new Error(`Unknown block type: ${cmd.blockType}`);
                }
                const invItem = bot.inventory.items().find(i => i.type === item.id);
                if (!invItem) {
                  throw new Error(`${cmd.blockType} not in inventory`);
                }
                await bot.equip(invItem, 'hand');
                const placePos = new Vec3(cmd.x, cmd.y, cmd.z);
                const refBlock = bot.blockAt(placePos.offset(0, -1, 0));
                if (!refBlock || refBlock.name === 'air') {
                  throw new Error(`No reference block for placement`);
                }
                await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
                results.push(`${stepNum}. Placed ${cmd.blockType}`);
                successCount++;
                break;

              case 'look':
                if (cmd.x === undefined || cmd.y === undefined || cmd.z === undefined) {
                  throw new Error("look requires x, y, z coordinates");
                }
                await bot.lookAt(new Vec3(cmd.x, cmd.y, cmd.z), true);
                results.push(`${stepNum}. Looked at (${cmd.x}, ${cmd.y}, ${cmd.z})`);
                successCount++;
                break;

              case 'attack':
                if (!cmd.entityName) {
                  throw new Error("attack requires entityName");
                }
                const target = bot.nearestEntity((e: any) => e.name === cmd.entityName);
                if (!target) {
                  throw new Error(`No ${cmd.entityName} nearby`);
                }
                await bot.attack(target);
                results.push(`${stepNum}. Attacked ${cmd.entityName}`);
                successCount++;
                break;

              case 'chat':
                if (!cmd.message) {
                  throw new Error("chat requires message");
                }
                bot.chat(cmd.message);
                results.push(`${stepNum}. Said: "${cmd.message}"`);
                successCount++;
                break;

              case 'equip':
                if (!cmd.itemName) {
                  throw new Error("equip requires itemName");
                }
                const equipItem = mcData.itemsByName[cmd.itemName];
                if (!equipItem) {
                  throw new Error(`Unknown item: ${cmd.itemName}`);
                }
                const equipInvItem = bot.inventory.items().find(i => i.type === equipItem.id);
                if (!equipInvItem) {
                  throw new Error(`${cmd.itemName} not in inventory`);
                }
                await bot.equip(equipInvItem, 'hand');
                results.push(`${stepNum}. Equipped ${cmd.itemName}`);
                successCount++;
                break;

              case 'jump':
                bot.setControlState('jump', true);
                await new Promise(resolve => setTimeout(resolve, 250));
                bot.setControlState('jump', false);
                results.push(`${stepNum}. Jumped`);
                successCount++;
                break;

              case 'wait':
                const waitDuration = cmd.duration || 1000;
                await new Promise(resolve => setTimeout(resolve, waitDuration));
                results.push(`${stepNum}. Waited ${waitDuration}ms`);
                successCount++;
                break;

              default:
                throw new Error(`Unknown action: ${cmd.action}`);
            }
          } catch (error) {
            failCount++;
            results.push(`${stepNum}. FAILED (${cmd.action}): ${error}`);
            // Continue with next command instead of stopping
          }
        }

        const summary = `Executed ${commands.length} commands: ${successCount} successful, ${failCount} failed\n\n` +
                       results.join('\n');

        return factory.createResponse(summary);
      } catch (error) {
        return factory.createErrorResponse(`Sequence execution failed: ${error}\n\nCompleted steps:\n${results.join('\n')}`);
      }
    },
    true
  );

  // quick-build: Specialized sequence for building simple structures
  factory.registerTool(
    "quick-build",
    "Quickly build a simple structure (wall, floor, tower). Optimized for common building patterns.",
    {
      structure: z.enum(['wall', 'floor', 'tower', 'bridge']).describe("Type of structure to build"),
      startX: z.number().describe("Starting X coordinate"),
      startY: z.number().describe("Starting Y coordinate"),
      startZ: z.number().describe("Starting Z coordinate"),
      length: z.number().describe("Length of the structure"),
      height: z.number().optional().describe("Height (for walls and towers, default: 3)"),
      blockType: z.string().describe("Block type to use")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { structure, startX, startY, startZ, length, height = 3, blockType } = args;

      const mcData = require('minecraft-data')(bot.version);
      const item = mcData.itemsByName[blockType];

      if (!item) {
        return factory.createErrorResponse(`Unknown block type: ${blockType}`);
      }

      const invItem = bot.inventory.items().find(i => i.type === item.id);
      if (!invItem) {
        return factory.createErrorResponse(`${blockType} not in inventory`);
      }

      const positions: Vec3[] = [];

      // Generate positions based on structure type
      switch (structure) {
        case 'wall':
          for (let x = 0; x < length; x++) {
            for (let y = 0; y < height; y++) {
              positions.push(new Vec3(startX + x, startY + y, startZ));
            }
          }
          break;

        case 'floor':
          for (let x = 0; x < length; x++) {
            for (let z = 0; z < length; z++) {
              positions.push(new Vec3(startX + x, startY, startZ + z));
            }
          }
          break;

        case 'tower':
          for (let y = 0; y < height; y++) {
            positions.push(new Vec3(startX, startY + y, startZ));
          }
          break;

        case 'bridge':
          for (let x = 0; x < length; x++) {
            positions.push(new Vec3(startX + x, startY, startZ));
          }
          break;
      }

      let placed = 0;
      const startTime = Date.now();

      try {
        await bot.equip(invItem, 'hand');

        for (const pos of positions) {
          // Check if block already exists
          const existingBlock = bot.blockAt(pos);
          if (existingBlock && existingBlock.name !== 'air') {
            continue; // Skip if block already there
          }

          // Move close
          const goal = new goals.GoalNear(pos.x, pos.y, pos.z, 4);
          await bot.pathfinder.goto(goal);

          // Find reference block
          const refBlock = bot.blockAt(pos.offset(0, -1, 0));
          if (refBlock && refBlock.name !== 'air') {
            await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
            placed++;
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        return factory.createResponse(`Built ${structure}: placed ${placed}/${positions.length} blocks in ${elapsed}s`);
      } catch (error) {
        return factory.createErrorResponse(`Failed to build ${structure}: ${error}. Placed ${placed}/${positions.length} blocks`);
      }
    },
    true
  );
}
