/**
 * Do Tool
 * The intelligent action tool that parses natural language and executes plans
 */

import { z } from 'zod';
import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import { Vec3 } from 'vec3';
import { ToolFactory } from '../../tool-factory.js';
import { parseTask, normalizeItemName, getSuggestions } from '../planner/task-parser.js';
import { planToObtain, SimulatedInventory, optimizePlan, estimatePlanTime } from '../planner/dependency-resolver.js';
import { executePlan, ExecutionResult } from '../actions/executor.js';
import { BotState, PlanAction } from '../planner/types.js';
import {
  generateHousePositions,
  generateWallPositions,
  generateFloorPositions,
  generateTowerPositions,
  calculateMaterialsNeeded,
  BlockPlacement,
} from '../knowledge/building.js';

export function registerDoTool(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot
): void {
  factory.registerTool(
    'do',
    `Execute a task using natural language. The bot will automatically figure out what it needs and do it.

Examples:
- do("build a 5x5 cobblestone house")
- do("mine 10 iron_ore")
- do("craft a diamond_pickaxe")
- do("gather 20 wood")
- do("go to 100, 64, 200")
- do("follow me")
- do("kill zombies")
- do("eat")

The bot will automatically:
- Check if it's in creative or survival mode
- Gather required materials if needed
- Craft necessary tools
- Navigate to resources
- Execute the full task`,
    {
      task: z.string().describe('What you want the bot to do (natural language)'),
    },
    async (args) => {
      const bot = getBot();
      const { task } = args;
      const mcData = minecraftData(bot.version);

      // Parse the task
      const parsed = parseTask(task);

      if (parsed.type === 'unknown') {
        const suggestions = getSuggestions(task);
        return factory.createResponse(
          `I don't understand "${task}".\n\n` +
          `Try one of these:\n` +
          suggestions.map(s => `• do("${s}")`).join('\n')
        );
      }

      // Create bot state for planning
      const inventory = new SimulatedInventory();
      for (const item of bot.inventory.items()) {
        inventory.add(item.name, item.count);
      }

      const hasCraftingTable = bot.findBlock({
        matching: mcData.blocksByName['crafting_table']?.id,
        maxDistance: 32,
      }) !== null;

      const hasFurnace = bot.findBlock({
        matching: mcData.blocksByName['furnace']?.id,
        maxDistance: 32,
      }) !== null;

      const state: BotState = {
        position: {
          x: bot.entity.position.x,
          y: bot.entity.position.y,
          z: bot.entity.position.z,
        },
        health: bot.health,
        food: bot.food,
        gameMode: bot.game.gameMode as any,
        inventory,
        nearbyBlocks: new Map(),
        hasCraftingTable,
        hasFurnace,
      };

      try {
        let plan: PlanAction[] = [];

        switch (parsed.type) {
          case 'build': {
            const { structure, material, width, depth, height, length, quantity } = parsed.params;
            const normalizedMaterial = normalizeItemName(material);

            // Calculate materials needed
            let blocks;
            switch (structure) {
              case 'house':
                blocks = generateHousePositions(width || 5, depth || 5, height || 3, normalizedMaterial);
                break;
              case 'wall':
                blocks = generateWallPositions(length || 5, height || 3, normalizedMaterial);
                break;
              case 'floor':
              case 'platform':
                blocks = generateFloorPositions(width || 5, depth || 5, normalizedMaterial);
                break;
              case 'tower':
                blocks = generateTowerPositions(height || 5, normalizedMaterial);
                break;
              default:
                blocks = [{ offset: new Vec3(0, 0, 0), block: normalizedMaterial }] as BlockPlacement[];
                for (let i = 1; i < (quantity || 1); i++) {
                  blocks.push({ offset: new Vec3(i, 0, 0), block: normalizedMaterial });
                }
            }

            const materialsNeeded = calculateMaterialsNeeded(blocks);

            // Plan to obtain materials
            for (const [mat, count] of Object.entries(materialsNeeded)) {
              plan.push(...planToObtain(mat, count, { ...state, inventory: state.inventory.clone() }, undefined, 0));
            }

            // Add build action
            plan.push({
              type: 'build',
              description: `Build ${structure} with ${normalizedMaterial}`,
              params: { structure, material: normalizedMaterial, width, depth, height, length, quantity, blockCount: blocks.length },
            });
            break;
          }

          case 'mine':
          case 'gather': {
            const { quantity, block, item } = parsed.params;
            const target = normalizeItemName(block || item);

            plan = planToObtain(target, quantity, state);
            break;
          }

          case 'craft': {
            const { quantity, item } = parsed.params;
            const target = normalizeItemName(item);

            plan = planToObtain(target, quantity, state);
            break;
          }

          case 'navigate': {
            plan.push({
              type: 'navigate',
              description: `Navigate to destination`,
              params: parsed.params,
            });
            break;
          }

          case 'follow': {
            const { target, stop } = parsed.params;

            if (stop) {
              bot.pathfinder.stop();
              return factory.createResponse('Stopped following.');
            }

            // Find target entity
            const targetEntity = bot.nearestEntity(e =>
              e.type === 'player' ||
              e.name?.toLowerCase() === target?.toLowerCase()
            );

            if (!targetEntity) {
              return factory.createErrorResponse(`Cannot find "${target || 'player'}" to follow.`);
            }

            // Start following (this is a continuous action)
            const { goals } = await import('mineflayer-pathfinder');
            const followGoal = new goals.GoalFollow(targetEntity, 3);
            bot.pathfinder.setGoal(followGoal, true);

            return factory.createResponse(`Now following ${target || 'player'}. Use do("stop follow") to stop.`);
          }

          case 'attack': {
            plan.push({
              type: 'attack',
              description: `Attack ${parsed.params.target}`,
              params: parsed.params,
            });
            break;
          }

          case 'eat': {
            plan.push({
              type: 'eat',
              description: 'Eat food',
              params: parsed.params,
            });
            break;
          }

          case 'equip': {
            plan.push({
              type: 'equip',
              description: `Equip ${parsed.params.item}`,
              params: parsed.params,
            });
            break;
          }
        }

        // Optimize and estimate time
        plan = optimizePlan(plan);
        const estimatedTime = estimatePlanTime(plan);

        // Show plan summary
        const planSummary = plan.map((a, i) => `${i + 1}. ${a.description}`).join('\n');

        // Execute the plan
        const startTime = Date.now();
        const { success, results } = await executePlan(bot, plan);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Format results
        const resultSummary = results
          .map((r, i) => `${i + 1}. ${r.success ? '✓' : '✗'} ${r.message}`)
          .join('\n');

        if (success) {
          return factory.createResponse(
            `Task completed in ${elapsed}s!\n\n` +
            `Plan executed:\n${planSummary}\n\n` +
            `Results:\n${resultSummary}`
          );
        } else {
          return factory.createResponse(
            `Task partially completed in ${elapsed}s.\n\n` +
            `Plan:\n${planSummary}\n\n` +
            `Results:\n${resultSummary}`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Provide helpful error messages
        if (errorMessage.includes("Don't know how to obtain")) {
          const item = errorMessage.match(/obtain (\w+)/)?.[1];
          return factory.createResponse(
            `I don't know how to get "${item}".\n\n` +
            `This might be because:\n` +
            `• The item name is incorrect\n` +
            `• It requires a recipe I don't know\n` +
            `• It can only be found, not crafted\n\n` +
            `Try: observe() to see what's available nearby.`
          );
        }

        return factory.createErrorResponse(`Task failed: ${errorMessage}`);
      }
    }
  );
}
